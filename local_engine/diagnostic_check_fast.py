import os
import pandas as pd
import lightgbm as lgb
import yfinance as yf
from dotenv import load_dotenv
from supabase import create_client, Client

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def main():
    print("--- 1. FEATURE IMPORTANCE CHECK ---")
    model_path = "models/longterm_lgbm_lambdarank.txt"
    if not os.path.exists(model_path):
        print(f"Model file not found at {model_path}")
    else:
        model = lgb.Booster(model_file=model_path)
        importances = model.feature_importance(importance_type='gain')
        features = ['momentum_z', 'lowvol_z', 'delivery_z']
        
        total_gain = sum(importances)
        if total_gain > 0:
            for feat, imp in zip(features, importances):
                print(f"{feat}: {imp/total_gain*100:.2f}% (Gain: {imp:.2f})")
        else:
            print("Total gain is 0.")

    print("\n--- 2. MARKET REGIME FOR HOLDOUT PERIOD ---")
    # Fetch distinct trade_dates
    res = supabase.table("ohlcv_daily").select("trade_date").order("trade_date").execute()
    dates = sorted(list(set(r['trade_date'] for r in res.data)))
    
    if not dates:
        print("No dates found.")
        return
        
    dates_s = pd.Series(pd.to_datetime(dates))
    
    # max_date in clean_df is the date that has 60 trading days AFTER it
    clean_max_date = dates_s.iloc[-61] if len(dates_s) > 60 else dates_s.iloc[0]
    split_date = clean_max_date - pd.Timedelta(days=180)
    
    val_dates = dates_s[dates_s > split_date]
    val_dates = val_dates[val_dates <= clean_max_date]
    
    val_start = val_dates.min()
    val_end = val_dates.max()
    
    print(f"Total Date Range in DB: {dates_s.min().strftime('%Y-%m-%d')} to {dates_s.max().strftime('%Y-%m-%d')}")
    print(f"Validation Holdout Period: {val_start.strftime('%Y-%m-%d')} to {val_end.strftime('%Y-%m-%d')}")
    
    try:
        nifty = yf.download("^NSEI", start=val_start.strftime('%Y-%m-%d'), end=(val_end + pd.Timedelta(days=1)).strftime('%Y-%m-%d'), progress=False)
        vix = yf.download("^INDIAVIX", start=val_start.strftime('%Y-%m-%d'), end=(val_end + pd.Timedelta(days=1)).strftime('%Y-%m-%d'), progress=False)
        
        if not nifty.empty:
            start_price = float(nifty['Close'].iloc[0].iloc[0])
            end_price = float(nifty['Close'].iloc[-1].iloc[0])
            nifty_ret = (end_price / start_price) - 1
            print(f"Nifty 50 Return over period: {nifty_ret*100:.2f}%")
        
        if not vix.empty:
            vix_closes = vix['Close'].squeeze()
            avg_vix = float(vix_closes.mean())
            max_vix = float(vix_closes.max())
            start_vix = float(vix_closes.iloc[0])
            end_vix = float(vix_closes.iloc[-1])
            print(f"India VIX: Start={start_vix:.2f}, End={end_vix:.2f}, Avg={avg_vix:.2f}, Peak={max_vix:.2f}")
    except Exception as e:
        print(f"Failed to fetch yfinance data: {e}")

if __name__ == "__main__":
    main()
