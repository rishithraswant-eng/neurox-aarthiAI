import os
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)
import jwt
token = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
try:
    role = jwt.decode(token, options={'verify_signature': False}).get('role') if token else 'unknown'
except:
    role = 'error_decoding'
print(f"ENV LOADED FROM {env_path}")
print(f"SUPABASE_SERVICE_ROLE_KEY DECODED ROLE: {role}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import forecasts, stocks, market, notion_auth

app = FastAPI(title="TradeSignal Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For local testing, allow all
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecasts.router,   prefix="/api/forecasts", tags=["Forecasts"])
app.include_router(stocks.router,      prefix="/api/stocks",    tags=["Stocks"])
app.include_router(market.router,      prefix="/api/market",    tags=["Market"])
app.include_router(notion_auth.router, prefix="/api/notion",    tags=["Notion"])

@app.get("/")
def health_check():
    return {"status": "ok", "service": "TradeSignal Pro API"}
