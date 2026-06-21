from supabase import create_client
import os
import numpy as np
from dotenv import load_dotenv

load_dotenv('.env')
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

res = sb.table('macro_daily').select('*').gte('trade_date', '2025-09-29').lte('trade_date', '2026-03-27').order('trade_date').execute().data

print('ROWS:', len(res))
if res:
    print('NIFTY START DATE:', res[0]['trade_date'])
    print('NIFTY END DATE:', res[-1]['trade_date'])
    print('NIFTY START:', res[0]['nifty_50'])
    print('NIFTY END:', res[-1]['nifty_50'])
    print('NIFTY RET:', (res[-1]['nifty_50']/res[0]['nifty_50'] - 1)*100, '%')
    vixs = [r['india_vix'] for r in res if r['india_vix']]
    if vixs:
        print('VIX AVG:', np.mean(vixs))
        print('VIX MAX:', np.max(vixs))
        print('VIX MIN:', np.min(vixs))
else:
    print("No data found in macro_daily for this date range.")
