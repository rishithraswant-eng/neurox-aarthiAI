import pandas as pd
import numpy as np

def calculate_cross_sectional_zscores(factors_df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame of raw factors for the universe and computes cross-sectional Z-scores.
    Winsorizes extreme outliers at 1st and 99th percentiles before Z-scoring to prevent skew.
    """
    if factors_df.empty:
        return factors_df
        
    df = factors_df.copy()
    
    # Columns to Z-score
    factor_cols = [
        "momentum_6m", 
        "momentum_12m", 
        "realized_vol_60d", 
        "delivery_ema_20d", 
        "trailing_pe", 
        "return_on_equity", 
        "debt_equity"
    ]
    
    # We invert 'trailing_pe', 'debt_equity', 'realized_vol_60d' so that higher Z-score is ALWAYS better
    invert_cols = ["trailing_pe", "debt_equity", "realized_vol_60d"]
    
    zscore_cols = {}
    
    for col in factor_cols:
        if col not in df.columns:
            continue
            
        # Drop NaNs for the calculation
        s = df[col].dropna()
        if s.empty:
            df[f"{col}_z"] = np.nan
            continue
            
        # Winsorize at 1% and 99%
        p1 = s.quantile(0.01)
        p99 = s.quantile(0.99)
        s_clipped = s.clip(lower=p1, upper=p99)
        
        # Calculate mean and std
        mean_val = s_clipped.mean()
        std_val = s_clipped.std()
        
        if std_val == 0 or pd.isna(std_val):
            z = s_clipped * 0 # All zeros
        else:
            z = (s_clipped - mean_val) / std_val
            
        # Invert if lower is better
        if col in invert_cols:
            z = -z
            
        # Re-assign back to the df
        df[f"{col}_z"] = z
        
    # Combine factor Z-scores into composite conceptual Z-scores based on PRD:
    # Value = trailing_pe_z (inverted)
    # Quality = mean(roe_z, debt_equity_z (inverted))
    # Low Vol = realized_vol_60d_z (inverted)
    # Momentum = mean(momentum_6m_z, momentum_12m_z)
    # Delivery = delivery_ema_20d_z
    
    if "trailing_pe_z" in df.columns:
        df["value_z"] = df["trailing_pe_z"]
        
    if "return_on_equity_z" in df.columns and "debt_equity_z" in df.columns:
        df["quality_z"] = df[["return_on_equity_z", "debt_equity_z"]].mean(axis=1)
        
    if "realized_vol_60d_z" in df.columns:
        df["lowvol_z"] = df["realized_vol_60d_z"]
        
    if "momentum_6m_z" in df.columns and "momentum_12m_z" in df.columns:
        df["momentum_z"] = df[["momentum_6m_z", "momentum_12m_z"]].mean(axis=1)
        
    if "delivery_ema_20d_z" in df.columns:
        df["delivery_z"] = df["delivery_ema_20d_z"]
        
    return df

if __name__ == "__main__":
    import os
    import yfinance as yf
    from supabase import create_client
    from dotenv import load_dotenv

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(env_path)
    client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

    print("Fetching universe for Z-scoring test...")
    res = client.table("universe").select("symbol").execute()
    symbols = [r["symbol"] for r in res.data]
    
    if not symbols:
        print("Universe is empty. Using fundamentals_weekly symbols.")
        res = client.table("fundamentals_weekly").select("symbol").execute()
        symbols = list(set([r["symbol"] for r in res.data]))

    # We fetch fundamentals directly from DB for these symbols
    print(f"Fetching fundamentals for {len(symbols)} symbols...")
    fund_res = client.table("fundamentals_weekly").select("*").execute()
    fund_df = pd.DataFrame(fund_res.data)
    
    print(f"Bulk downloading 1Y OHLCV for {len(symbols)} symbols via yfinance for momentum/volatility calculation...")
    yf_symbols = [f"{s}.NS" for s in symbols]
    
    # Bulk download is incredibly fast compared to sequential
    data = yf.download(yf_symbols, period="1y", group_by="ticker", progress=False)
    
    raw_factors = []
    
    for symbol in symbols:
        yf_sym = f"{symbol}.NS"
        
        # Fundamentals
        f_row = fund_df[fund_df["symbol"] == symbol]
        trailing_pe = f_row["trailing_pe"].values[0] if not f_row.empty else np.nan
        roce = f_row["return_on_equity"].values[0] if not f_row.empty else np.nan
        de = f_row["debt_equity"].values[0] if not f_row.empty else np.nan
        
        # OHLCV
        mom_6m = np.nan
        mom_12m = np.nan
        vol_60d = np.nan
        deliv_20d = np.nan
        
        if yf_sym in data.columns.levels[0]:
            df_sym = data[yf_sym].dropna(subset=["Close"])
            if not df_sym.empty and len(df_sym) >= 60:
                current_close = df_sym["Close"].iloc[-1]
                
                if len(df_sym) >= 126:
                    mom_6m = (current_close / df_sym["Close"].iloc[-126]) - 1
                if len(df_sym) >= 240: # relaxed slightly to ensure we get a 12m reading
                    mom_12m = (current_close / df_sym["Close"].iloc[-240]) - 1
                    
                df_60d = df_sym.tail(60).copy()
                df_60d["return"] = df_60d["Close"].pct_change()
                vol_60d = df_60d["return"].std()
                
                df_20d = df_sym.tail(20).copy()
                deliv_20d = df_20d["Volume"].ewm(span=20, adjust=False).mean().iloc[-1]
                
        raw_factors.append({
            "symbol": symbol,
            "momentum_6m": mom_6m,
            "momentum_12m": mom_12m,
            "realized_vol_60d": vol_60d,
            "delivery_ema_20d": deliv_20d,
            "trailing_pe": trailing_pe,
            "return_on_equity": roce,
            "debt_equity": de
        })
        
    df_raw = pd.DataFrame(raw_factors)
    
    print("\\n--- Calculating Z-Scores ---")
    df_z = calculate_cross_sectional_zscores(df_raw)
    
    print("\\n--- UNIVERSE Z-SCORE MEAN & STD ---")
    z_cols = ["momentum_z", "lowvol_z", "delivery_z", "value_z", "quality_z"]
    for col in z_cols:
        if col in df_z.columns:
            s = df_z[col].dropna()
            print(f"{col:<15} | Mean: {s.mean():>7.4f} | Std: {s.std():>7.4f} | Count: {len(s)}")
        else:
            print(f"{col:<15} | Missing")
