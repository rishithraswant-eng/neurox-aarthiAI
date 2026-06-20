import os
from dotenv import load_dotenv
from supabase import create_client

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials in .env")
    exit(1)

supabase = create_client(url, key)

tables = [
    "universe",
    "ohlcv_daily",
    "fundamentals_weekly",
    "market_health",
    "signals",
    "forecasts",
    "portfolio_log",
    "portfolio_snapshots",
    "model_registry",
    "pipeline_runs",
    "signal_outcomes"
]

print("--- Existing Tables Row Counts ---")
for t in tables:
    try:
        res = supabase.table(t).select("*", count="exact").limit(1).execute()
        count = res.count if hasattr(res, 'count') else 0
        print(f"{t}: {count} rows")
    except Exception as e:
        print(f"{t}: Error reading table -> {e}")

print("\n--- New Tables Check ---")
new_tables = ["longterm_signals", "longterm_model_registry"]
for t in new_tables:
    try:
        res = supabase.table(t).select("*", count="exact").limit(1).execute()
        print(f"{t} exists: Yes")
    except Exception as e:
        print(f"{t} exists: No (Error: {e})")
