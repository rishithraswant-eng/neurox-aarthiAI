import os
from dotenv import load_dotenv
from supabase import create_client

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

print("--- Data Depth Check ---")

for table in ["ohlcv_daily", "fundamentals_weekly"]:
    try:
        # Get count
        res_count = supabase.table(table).select("*", count="exact").limit(1).execute()
        count = res_count.count if hasattr(res_count, 'count') else 0
        
        # Get min date
        res_min = supabase.table(table).select("trade_date").order("trade_date", desc=False).limit(1).execute()
        min_date = res_min.data[0]['trade_date'] if res_min.data else 'N/A'
        
        # Get max date
        res_max = supabase.table(table).select("trade_date").order("trade_date", desc=True).limit(1).execute()
        max_date = res_max.data[0]['trade_date'] if res_max.data else 'N/A'
        
        print(f"{table}: {count} rows. Date range: {min_date} to {max_date}")
    except Exception as e:
        print(f"{table}: Error - {e}")

# Clean up the garbage from longterm_model_registry and delete the file
try:
    print("Deleting garbage from longterm_model_registry...")
    supabase.table("longterm_model_registry").delete().neq("id", 0).execute()
    print("Deleted registry rows.")
except Exception as e:
    print(f"Error cleaning registry: {e}")

model_path = os.path.join(os.path.dirname(__file__), "models", "longterm_lgbm_lambdarank.txt")
if os.path.exists(model_path):
    os.remove(model_path)
    print(f"Deleted model artifact: {model_path}")
