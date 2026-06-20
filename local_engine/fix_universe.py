import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

# Get distinct symbols from fundamentals_weekly
res = client.table("fundamentals_weekly").select("symbol").execute()
symbols = set(r['symbol'] for r in res.data)

print(f"Found {len(symbols)} symbols in fundamentals_weekly.")

# Insert into universe
updates = [{"symbol": sym, "is_active": True, "sector": "Unknown"} for sym in symbols]

if updates:
    client.table("universe").upsert(updates).execute()
    print("Successfully populated universe table.")
else:
    print("No symbols to insert.")
