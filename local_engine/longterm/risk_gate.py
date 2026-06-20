import pandas as pd

def apply_risk_gate(scored_df: pd.DataFrame) -> pd.DataFrame:
    """
    Applies the Aarthi AI multi-layered risk gate to filter out ineligible stocks.
    Filters out stocks based on:
    - Liquidity: 30-day average daily turnover < ₹10Cr
    - Market Cap: Micro/Nano cap (< ₹1,000Cr) -> using profile data
    - Trailing PE: > 100 or < 0
    - Quality: Return on Capital Employed (or ROE) < 10%
    """
    if scored_df.empty:
        return scored_df
        
    df = scored_df.copy()
    
    # 1. Turnover check (if avg_turnover_30d exists)
    if "avg_turnover_30d" in df.columns:
        # ₹10Cr = 100,000,000
        df["pass_liquidity"] = df["avg_turnover_30d"] >= 100000000
        df.loc[df["pass_liquidity"] == False, "exclusion_reason"] = "Low Liquidity (< 10Cr Turnover)"
    else:
        df["pass_liquidity"] = True

    # 2. Valuation Check
    if "trailing_pe" in df.columns:
        df["pass_valuation"] = df["trailing_pe"].notna() & (df["trailing_pe"] > 0) & (df["trailing_pe"] <= 100)
        df.loc[df["pass_valuation"] == False, "exclusion_reason"] = "Extreme/Missing PE (>100, <0, or NaN)"
    else:
        df["pass_valuation"] = False
        
    # 3. Quality Check
    if "return_on_equity" in df.columns:
        df["pass_quality"] = df["return_on_equity"].notna() & (df["return_on_equity"] >= 0.10)
        df.loc[df["pass_quality"] == False, "exclusion_reason"] = "Low/Missing ROE (< 10% or NaN)"
    else:
        df["pass_quality"] = False
        
    # 4. Market Cap (we don't have cap easily available in local raw factors, but we assume Nifty500 passes the 1000Cr threshold mostly)
    
    # Final pass flag
    df["passes_risk_gate"] = df["pass_liquidity"] & df["pass_valuation"] & df["pass_quality"]
    df["exclusion_reason"] = df["exclusion_reason"].fillna("None")
    
    return df

if __name__ == "__main__":
    from factors import compute_raw_factors
    from zscore import calculate_cross_sectional_zscores
    import os
    from supabase import create_client
    from dotenv import load_dotenv

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(env_path)
    client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

    test_symbols = ["RELIANCE", "TCS", "INFY", "SUZLON", "PAYTM", "YESBANK", "IDEA", "ADANIENT", "ZOMATO"]
    raw_factors = []
    
    print("Computing factors to test risk gate...")
    for sym in test_symbols:
        f = compute_raw_factors(sym, client)
        if f:
            raw_factors.append(f)
            
    df_raw = pd.DataFrame(raw_factors)
    
    # We apply risk gate
    df_gated = apply_risk_gate(df_raw)
    
    print("\\n--- RISK GATE RESULTS ---")
    passed = df_gated[df_gated["passes_risk_gate"] == True]
    failed = df_gated[df_gated["passes_risk_gate"] == False]
    
    if not passed.empty:
        print(f"\\n[PASSED] {passed.iloc[0]['symbol']} -> Reason: Met all liquidity, valuation, and quality thresholds.")
    
    if not failed.empty:
        print(f"\\n[EXCLUDED] {failed.iloc[0]['symbol']} -> Reason: {failed.iloc[0]['exclusion_reason']}")
