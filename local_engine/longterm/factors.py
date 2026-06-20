import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime

def compute_raw_factors(symbol, db_client):
    """
    Computes raw long-term factors for a given symbol.
    Uses ohlcv_daily and fundamentals_weekly.
    """
    # 1. Fetch Fundamentals
    fund_res = db_client.table("fundamentals_weekly").select("*").eq("symbol", symbol).order("as_of_date", desc=True).limit(1).execute()
    fund_data = fund_res.data[0] if fund_res.data else {}

    trailing_pe = fund_data.get("trailing_pe")
    return_on_equity = fund_data.get("return_on_equity")
    debt_equity = fund_data.get("debt_equity")

    # 2. Fetch OHLCV
    ohlcv_res = db_client.table("ohlcv_daily").select("trade_date, close, volume").eq("symbol", symbol).order("trade_date", desc=True).limit(260).execute()
    
    df = pd.DataFrame(ohlcv_res.data)
    
    # Fallback to yfinance if ohlcv_daily is empty (for testing and robust execution tonight)
    if df.empty:
        yf_symbol = f"{symbol}.NS"
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period="1y")
        if not hist.empty:
            df = pd.DataFrame({
                "trade_date": hist.index.strftime("%Y-%m-%d"),
                "close": hist["Close"].values,
                "volume": hist["Volume"].values
            })
            df = df.sort_values("trade_date", ascending=False).reset_index(drop=True)

    if df.empty or len(df) < 60:
        return None  # Not enough data

    # Sort chronological for calculations
    df = df.sort_values("trade_date", ascending=True).reset_index(drop=True)
    
    current_close = df["close"].iloc[-1]
    
    # Momentum 6m (~126 days)
    if len(df) >= 126:
        close_6m = df["close"].iloc[-126]
        momentum_6m = (current_close / close_6m) - 1
    else:
        momentum_6m = None

    # Momentum 12m (~252 days)
    if len(df) >= 252:
        close_12m = df["close"].iloc[-252]
        momentum_12m = (current_close / close_12m) - 1
    else:
        momentum_12m = None

    # Low Volatility (60d) - standard deviation of daily returns
    df_60d = df.tail(60).copy()
    df_60d["return"] = df_60d["close"].pct_change()
    realized_vol_60d = df_60d["return"].std()

    # Delivery EMA (20d) - using volume as proxy if delivery isn't available
    df_20d = df.tail(20).copy()
    delivery_ema_20d = df_20d["volume"].ewm(span=20, adjust=False).mean().iloc[-1]
    
    # 30d Average Turnover (for risk gate)
    df_30d = df.tail(30).copy()
    df_30d["turnover"] = df_30d["close"] * df_30d["volume"]
    avg_turnover_30d = df_30d["turnover"].mean()

    return {
        "symbol": symbol,
        "momentum_6m": momentum_6m,
        "momentum_12m": momentum_12m,
        "realized_vol_60d": realized_vol_60d,
        "delivery_ema_20d": delivery_ema_20d,
        "trailing_pe": trailing_pe,
        "return_on_equity": return_on_equity,
        "debt_equity": debt_equity,
        "avg_turnover_30d": avg_turnover_30d
    }

if __name__ == "__main__":
    import os
    from supabase import create_client
    from dotenv import load_dotenv

    # Test execution for evidence
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(env_path)
    client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

    test_symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"]
    print("--- RAW FACTOR OUTPUT FOR 5 RECOGNIZABLE STOCKS ---")
    for sym in test_symbols:
        factors = compute_raw_factors(sym, client)
        print(f"\\n[{sym}]")
        if factors:
            for k, v in factors.items():
                if isinstance(v, float):
                    print(f"  {k}: {v:.4f}")
                else:
                    print(f"  {k}: {v}")
        else:
            print("  Not enough data")
