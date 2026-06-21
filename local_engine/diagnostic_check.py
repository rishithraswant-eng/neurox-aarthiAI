import os
import pandas as pd
import lightgbm as lgb
import yfinance as yf
from longterm.train_longterm import fetch_all_ohlcv, generate_features_and_target

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
    df = fetch_all_ohlcv()
    df = generate_features_and_target(df)
    features = ['momentum_z', 'lowvol_z', 'delivery_z']
    clean_df = df.dropna(subset=features + ['target']).copy()
    
    if clean_df.empty:
        print("clean_df is empty.")
        return
        
    max_date = clean_df['trade_date'].max()
    split_date = max_date - pd.Timedelta(days=180)
    
    val_df = clean_df[clean_df['trade_date'] > split_date].copy()
    val_start = val_df['trade_date'].min()
    val_end = val_df['trade_date'].max()
    
    print(f"Validation Holdout Period: {val_start.strftime('%Y-%m-%d')} to {val_end.strftime('%Y-%m-%d')}")
    
    # Fetch Nifty 50 and India VIX from yfinance
    try:
        nifty = yf.download("^NSEI", start=val_start.strftime('%Y-%m-%d'), end=(val_end + pd.Timedelta(days=1)).strftime('%Y-%m-%d'), progress=False)
        vix = yf.download("^INDIAVIX", start=val_start.strftime('%Y-%m-%d'), end=(val_end + pd.Timedelta(days=1)).strftime('%Y-%m-%d'), progress=False)
        
        if not nifty.empty:
            start_price = nifty['Close'].iloc[0].values[0]
            end_price = nifty['Close'].iloc[-1].values[0]
            nifty_ret = (end_price / start_price) - 1
            print(f"Nifty 50 Return over period: {nifty_ret*100:.2f}%")
        
        if not vix.empty:
            avg_vix = vix['Close'].mean().values[0]
            max_vix = vix['Close'].max().values[0]
            start_vix = vix['Close'].iloc[0].values[0]
            end_vix = vix['Close'].iloc[-1].values[0]
            print(f"India VIX: Start={start_vix:.2f}, End={end_vix:.2f}, Avg={avg_vix:.2f}, Peak={max_vix:.2f}")
    except Exception as e:
        print(f"Failed to fetch yfinance data: {e}")

if __name__ == "__main__":
    main()
