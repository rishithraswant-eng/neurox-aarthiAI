import os
import time
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import lightgbm as lgb
from dotenv import load_dotenv
from supabase import create_client, Client
from loguru import logger
import math

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Supabase credentials missing.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_all_ohlcv():
    logger.info("Fetching real ohlcv_daily data from database...")
    limit = 1000
    offset = 0
    all_data = []
    while True:
        res = supabase.table("ohlcv_daily").select("symbol, trade_date, close, delivery_pct").order("trade_date").range(offset, offset + limit - 1).execute()
        data = res.data
        if not data:
            break
        all_data.extend(data)
        offset += limit
    
    df = pd.DataFrame(all_data)
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df = df.sort_values(['symbol', 'trade_date']).reset_index(drop=True)
    logger.info(f"Fetched {len(df)} rows of ohlcv_daily.")
    return df

def generate_features_and_target(df):
    logger.info("Computing 3 price-based factors (Momentum, LowVol, Delivery) and 60-day forward target...")
    
    # Sort for rolling ops
    df = df.sort_values(by=['symbol', 'trade_date'])
    
    # 1. Momentum: 126-day return (6 months)
    df['momentum_126'] = df.groupby('symbol')['close'].transform(lambda x: x / x.shift(126) - 1)
    
    # 2. Low Volatility: 126-day std dev of daily returns (inverted)
    df['ret_1d'] = df.groupby('symbol')['close'].transform(lambda x: x.pct_change())
    df['vol_126'] = df.groupby('symbol')['ret_1d'].transform(lambda x: x.rolling(126).std() * math.sqrt(252))
    df['lowvol_126'] = -df['vol_126']
    
    # 3. Delivery: 20-day mean of delivery pct
    df['delivery_20'] = df.groupby('symbol')['delivery_pct'].transform(lambda x: x.rolling(20).mean())
    
    # Cross-sectional Z-scoring per day
    def zscore(x):
        if len(x.dropna()) < 2: return x
        return (x - x.mean()) / (x.std() + 1e-9)
        
    df['momentum_z'] = df.groupby('trade_date')['momentum_126'].transform(zscore)
    df['lowvol_z'] = df.groupby('trade_date')['lowvol_126'].transform(zscore)
    df['delivery_z'] = df.groupby('trade_date')['delivery_20'].transform(zscore)
    
    # Target: 60-day forward return relative to universe median
    df['fwd_60d_ret'] = df.groupby('symbol')['close'].transform(lambda x: np.log(x.shift(-60) / x))
    df['universe_median_fwd_ret'] = df.groupby('trade_date')['fwd_60d_ret'].transform('median')
    df['target'] = df['fwd_60d_ret'] - df['universe_median_fwd_ret']
    
    return df

def train_model():
    logger.info("Starting Aarthi AI Long-Term Model Training (3-Factor Real Data Build)...")
    
    df = fetch_all_ohlcv()
    if df.empty:
        logger.error("No data fetched. Cannot train.")
        return False
        
    df = generate_features_and_target(df)
    
    # Drop rows without features or target
    features = ['momentum_z', 'lowvol_z', 'delivery_z']
    clean_df = df.dropna(subset=features + ['target']).copy()
    
    # Split into train and validation (walk-forward fold)
    # The max date with a valid target is ~60 trading days ago
    min_date = clean_df['trade_date'].min()
    max_date = clean_df['trade_date'].max()
    
    # Let's say train is everything before max_date - 6 months (approx 126 trading days)
    # Val is the remaining period up to max_date
    split_date = max_date - pd.Timedelta(days=180)
    
    train_df = clean_df[clean_df['trade_date'] <= split_date].copy()
    val_df = clean_df[clean_df['trade_date'] > split_date].copy()
    
    fold_count = 1 if not val_df.empty else 0
    
    print("\n--- ACTUAL DATA STATS BEFORE REGISTRY WRITE ---")
    print(f"Total rows after feature generation and target dropna: {len(clean_df)}")
    print(f"Valid Target Date Range: {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")
    print(f"Walk-Forward Folds Computed: {fold_count}")
    print(f"Training rows (Train Set): {len(train_df)}")
    print(f"Validation rows (Val Set): {len(val_df)}")
    print(f"Features used: {features}")
    print("-----------------------------------------------\n")
    
    if train_df.empty:
        logger.error("Train dataframe is empty. Not enough historical data.")
        return False
    
    logger.info("Binning target into 5 relevance buckets for LambdaRank...")
    
    def bin_group(group):
        try:
            return pd.qcut(group['target'], 5, labels=[0, 1, 2, 3, 4], duplicates='drop')
        except ValueError:
            return pd.cut(group['target'], 5, labels=[0, 1, 2, 3, 4])
            
    train_df['relevance'] = train_df.groupby('trade_date', group_keys=False).apply(bin_group).astype(int)
    val_df['relevance'] = val_df.groupby('trade_date', group_keys=False).apply(bin_group).astype(int)
    
    X_train = train_df[features]
    y_train = train_df['relevance']
    group_train = train_df.groupby('trade_date').size().values
    
    X_val = val_df[features]
    y_val = val_df['relevance']
    group_val = val_df.groupby('trade_date').size().values
    
    lgb_train = lgb.Dataset(X_train, y_train, group=group_train, free_raw_data=False)
    lgb_val = lgb.Dataset(X_val, y_val, group=group_val, free_raw_data=False, reference=lgb_train)
    
    params = {
        'objective': 'lambdarank',
        'metric': 'ndcg',
        'ndcg_eval_at': [10, 20],
        'learning_rate': 0.05,
        'num_leaves': 31,
        'min_data_in_leaf': 20,
        'verbose': -1
    }
    
    logger.info("Training LightGBM LambdaRank model...")
    model = lgb.train(
        params,
        lgb_train,
        valid_sets=[lgb_train, lgb_val],
        num_boost_round=100
    )
    
    logger.info("Training completed.")
    
    # --- EVALUATION ---
    val_df['pred_score'] = model.predict(X_val)
    
    top_20_returns = []
    bot_20_returns = []
    
    # Compute average realized target (60d relative return) for top 20 and bottom 20 per day
    for date, group in val_df.groupby('trade_date'):
        if len(group) >= 40:
            top_20_mean = group.nlargest(20, 'pred_score')['target'].mean()
            bot_20_mean = group.nsmallest(20, 'pred_score')['target'].mean()
            top_20_returns.append(top_20_mean)
            bot_20_returns.append(bot_20_mean)
            
    avg_top_20 = np.mean(top_20_returns) if top_20_returns else 0.0
    avg_bot_20 = np.mean(bot_20_returns) if bot_20_returns else 0.0
    
    # Get NDCG@20 from evaluation
    ndcg_20 = model.best_score['valid_1']['ndcg@20'] if 'valid_1' in model.best_score else 0.0
    
    print("\n--- VALIDATION METRICS (Holdout Fold) ---")
    print(f"NDCG@20: {ndcg_20:.4f}")
    print(f"Top-20 Average 60d Rel Return: {avg_top_20:.4%}")
    print(f"Bottom-20 Average 60d Rel Return: {avg_bot_20:.4%}")
    print(f"Spread (Top - Bottom): {(avg_top_20 - avg_bot_20):.4%}")
    print("------------------------------------------\n")
    
    # Save model artifact
    models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, "longterm_lgbm_lambdarank.txt")
    
    model.save_model(model_path)
    logger.info(f"Model saved to {model_path}")
    
    # Write to registry
    try:
        registry_data = {
            "version_tag": f"v1.1_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "trained_at": datetime.now().isoformat(),
            "objective_used": "lambdarank",
            "training_row_count": len(train_df),
            "walk_forward_folds_completed": 1,
            "backtest_metrics_json": {
                "features_used": features,
                "artifact_path": model_path,
                "ndcg_20": ndcg_20,
                "top_20_avg_return": avg_top_20,
                "bottom_20_avg_return": avg_bot_20,
                "spread": avg_top_20 - avg_bot_20
            }
        }
        
        # We delete older artifacts for simplicity, but let's just insert
        supabase.table("longterm_model_registry").insert(registry_data).execute()
        logger.info("Successfully registered model in longterm_model_registry.")
    except Exception as e:
        logger.error(f"Failed to insert into longterm_model_registry: {e}")
        
    return True

if __name__ == "__main__":
    train_model()
