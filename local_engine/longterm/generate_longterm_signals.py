import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import lightgbm as lgb
from supabase import create_client
from loguru import logger
import math
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_recent_ohlcv(days_back=200):
    logger.info(f"Fetching recent ohlcv_daily data (last {days_back} calendar days)...")
    cutoff = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
    limit = 1000
    offset = 0
    all_data = []
    while True:
        res = supabase.table("ohlcv_daily").select("symbol, trade_date, close, delivery_pct, volume").gte("trade_date", cutoff).order("trade_date").range(offset, offset + limit - 1).execute()
        data = res.data
        if not data:
            break
        all_data.extend(data)
        offset += limit
        
    df = pd.DataFrame(all_data)
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df = df.sort_values(['symbol', 'trade_date']).reset_index(drop=True)
    return df

def generate_features(df):
    logger.info("Computing 3 price-based factors...")
    df = df.sort_values(by=['symbol', 'trade_date'])
    
    # Raw factors
    df['momentum_126'] = df.groupby('symbol')['close'].transform(lambda x: x / x.shift(126) - 1)
    df['ret_1d'] = df.groupby('symbol')['close'].transform(lambda x: x.pct_change())
    df['vol_126'] = df.groupby('symbol')['ret_1d'].transform(lambda x: x.rolling(126).std() * math.sqrt(252))
    df['lowvol_126'] = -df['vol_126']
    df['delivery_20'] = df.groupby('symbol')['delivery_pct'].transform(lambda x: x.rolling(20).mean())
    df['avg_turnover_30d'] = df.groupby('symbol').apply(lambda g: (g['close'] * g['volume']).rolling(30).mean()).reset_index(level=0, drop=True)
    
    # Cross-sectional Z-score for the latest date
    def zscore(x):
        if len(x.dropna()) < 2: return x
        return (x - x.mean()) / (x.std() + 1e-9)
        
    df['momentum_z'] = df.groupby('trade_date')['momentum_126'].transform(zscore)
    df['lowvol_z'] = df.groupby('trade_date')['lowvol_126'].transform(zscore)
    df['delivery_z'] = df.groupby('trade_date')['delivery_20'].transform(zscore)
    
    return df

from longterm.risk_gate import apply_hard_gate

def generate_longterm_signals_for_today():
    logger.info("Starting signal generation...")
    reg_res = supabase.table("longterm_model_registry").select("*").order("trained_at", desc=True).limit(1).execute()
    if not reg_res.data:
        logger.error("No model found in registry.")
        return
        
    artifact_path = reg_res.data[0]['backtest_metrics_json'].get('artifact_path')
    if not artifact_path or not os.path.exists(artifact_path):
        logger.error("Artifact path missing or invalid.")
        return
        
    model = lgb.Booster(model_file=artifact_path)
    
    df = fetch_recent_ohlcv(200)
    if df.empty: return
    df = generate_features(df)
    
    latest_df = df.groupby('symbol').last().reset_index()
    
    fund_res = supabase.table("fundamentals_weekly").select("symbol, debt_equity, trailing_pe, return_on_equity").execute()
    fund_df = pd.DataFrame(fund_res.data)
    if not fund_df.empty:
        latest_df = pd.merge(latest_df, fund_df, on='symbol', how='left')
    else:
        for c in ['debt_equity', 'trailing_pe', 'return_on_equity']:
            latest_df[c] = np.nan
            
    gates = latest_df.apply(apply_hard_gate, axis=1)
    latest_df['hard_gate_passed'] = [g[0] for g in gates]
    latest_df['hard_gate_reasons'] = [", ".join(g[1]) if g[1] else None for g in gates]
    
    features = ['momentum_z', 'lowvol_z', 'delivery_z']
    X = latest_df[features]
    latest_df['composite_score'] = model.predict(X)
    
    passing = latest_df[latest_df['hard_gate_passed']].copy()
    passing['rank_in_universe'] = passing['composite_score'].rank(ascending=False, method='min')
    
    univ_res = supabase.table("universe").select("symbol, sector").execute()
    univ_df = pd.DataFrame(univ_res.data)
    passing = pd.merge(passing, univ_df, on='symbol', how='left')
    if 'sector' in passing.columns:
        passing['rank_in_sector'] = passing.groupby('sector')['composite_score'].rank(ascending=False, method='min')
    else:
        passing['rank_in_sector'] = np.nan
    
    latest_df['rank_in_universe'] = latest_df['symbol'].map(passing.set_index('symbol')['rank_in_universe'])
    if 'rank_in_sector' in passing.columns:
        latest_df['rank_in_sector'] = latest_df['symbol'].map(passing.set_index('symbol')['rank_in_sector'])
    else:
        latest_df['rank_in_sector'] = np.nan
    
    records = []
    signal_date = latest_df['trade_date'].max()
    if pd.isna(signal_date):
        signal_date = datetime.now()
    signal_date_str = signal_date.strftime('%Y-%m-%d')
    
    for _, row in latest_df.iterrows():
        def clean(val):
            if val is None: return None
            if pd.isna(val): return None
            try:
                v = float(val)
                if math.isnan(v) or math.isinf(v): return None
                return v
            except:
                return None
                
        reason = row.get('hard_gate_reasons')
        if pd.isna(reason): reason = None
            
        rec = {
            "symbol": str(row['symbol']),
            "signal_date": signal_date_str,
            "momentum_6m": clean(row.get('momentum_126')),
            "realized_vol_60d": clean(row.get('vol_126')),
            "delivery_ema_20d": clean(row.get('delivery_20')),
            "trailing_pe": clean(row.get('trailing_pe')),
            "return_on_equity": clean(row.get('return_on_equity')),
            "debt_equity": clean(row.get('debt_equity')),
            "momentum_z": clean(row.get('momentum_z')),
            "lowvol_z": clean(row.get('lowvol_z')),
            "delivery_z": clean(row.get('delivery_z')),
            "composite_score": clean(row.get('composite_score')),
            "rank_in_universe": None if pd.isna(row.get('rank_in_universe')) else int(row['rank_in_universe']),
            "rank_in_sector": None if pd.isna(row.get('rank_in_sector')) else int(row['rank_in_sector']),
            "hard_gate_passed": bool(row.get('hard_gate_passed', False)),
            "hard_gate_reasons": reason,
            "model_version": reg_res.data[0]['version_tag']
        }
        records.append(rec)
        
    try:
        supabase.table("longterm_signals").upsert(records, on_conflict="symbol,signal_date").execute()
        logger.info(f"Upserted {len(records)} signals for {signal_date_str}")
    except Exception as e:
        logger.error(f"Error upserting: {e}")

if __name__ == "__main__":
    generate_longterm_signals_for_today()
