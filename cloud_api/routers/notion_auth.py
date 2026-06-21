"""
notion_auth.py  —  FastAPI router mounted at /api/notion
─────────────────────────────────────────────────────────
Auth:      POST /login   POST /signup   POST /sso
Watchlist: GET/POST /watchlist   DELETE /watchlist/{page_id}
Trades:    GET/POST /trades   PATCH /trades/{page_id}/close   DELETE /trades/{page_id}

Uses raw httpx calls to https://api.notion.com/v1 — NOT the notion-client SDK.
"""

import os
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

NOTION_API_KEY    = os.environ.get("NOTION_API_KEY", "")
NOTION_VERSION    = "2022-06-28"
NOTION_BASE       = "https://api.notion.com/v1"
USERS_DB_ID       = os.environ.get("NOTION_USERS_DB_ID", "")
WATCHLIST_DB_ID   = os.environ.get("NOTION_WATCHLIST_DB_ID", "")
TRADELOG_DB_ID    = os.environ.get("NOTION_TRADELOG_DB_ID", "")
SSO_SECRET_KEY    = os.environ.get("SSO_SECRET_KEY", "change_me")

router = APIRouter()

# ── HTTP helpers ─────────────────────────────────────────────────────────────

def _headers() -> dict:
    return {
        "Authorization":  f"Bearer {NOTION_API_KEY}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type":   "application/json",
    }

def _get(endpoint: str) -> dict:
    r = httpx.get(f"{NOTION_BASE}{endpoint}", headers=_headers(), timeout=15)
    r.raise_for_status()
    return r.json()

def _post(endpoint: str, body: dict) -> dict:
    r = httpx.post(f"{NOTION_BASE}{endpoint}", headers=_headers(), json=body, timeout=15)
    r.raise_for_status()
    return r.json()

def _patch(endpoint: str, body: dict) -> dict:
    r = httpx.patch(f"{NOTION_BASE}{endpoint}", headers=_headers(), json=body, timeout=15)
    r.raise_for_status()
    return r.json()

# ── Property extraction helpers ──────────────────────────────────────────────

def _title(prop: dict) -> Optional[str]:
    items = prop.get("title", [])
    return items[0]["text"]["content"] if items else None

def _rich(prop: dict) -> Optional[str]:
    items = prop.get("rich_text", [])
    return items[0]["text"]["content"] if items else None

def _select(prop: dict) -> Optional[str]:
    s = prop.get("select")
    return s["name"] if s else None

def _date(prop: dict) -> Optional[str]:
    d = prop.get("date")
    return d["start"] if d else None

def _num(prop: dict) -> Optional[float]:
    return prop.get("number")

def _email_prop(prop: dict) -> Optional[str]:
    return prop.get("email")

def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

# ── Notion Users DB helpers ──────────────────────────────────────────────────

def _query_users(email: str) -> list:
    body = {
        "filter": {
            "property": "Email",
            "title": {"equals": email}
        }
    }
    res = _post(f"/databases/{USERS_DB_ID}/query", body)
    return res.get("results", [])

def _parse_user(page: dict) -> dict:
    props = page.get("properties", {})
    # Find Name — look for rich_text field case-insensitively
    name = None
    for key, val in props.items():
        if key.lower() == "name" and val.get("type") == "rich_text":
            name = _rich(val)
            break
    # Find Password
    password_hash = None
    for key, val in props.items():
        if key.lower() == "password" and val.get("type") == "rich_text":
            password_hash = _rich(val)
            break
    return {
        "id": page["id"],
        "notionPageId": page["id"],
        "email": _title(props.get("Email", {})),
        "name": name or "",
        "password_hash": password_hash or "",
    }

def _create_user(email: str, name: str, password_hash: str) -> dict:
    page = _post("/pages", {
        "parent": {"database_id": USERS_DB_ID},
        "properties": {
            "Email": {"title": [{"text": {"content": email}}]},
            "Name":  {"rich_text": [{"text": {"content": name or email.split("@")[0]}}]},
            "Password": {"rich_text": [{"text": {"content": password_hash}}]},
        },
    })
    return _parse_user(page)

# ══════════════════════════════════════════════════════════════════════════════
# Auth models
# ══════════════════════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class SSORequest(BaseModel):
    token: str   # HS256 JWT signed with SSO_SECRET_KEY, payload has { "email": "..." }

# ── Auth endpoints ────────────────────────────────────────────────────────────

@router.post("/login", tags=["Auth"])
def notion_login(body: LoginRequest):
    email = body.email.strip().lower()
    try:
        pages = _query_users(email)
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")

    if not pages:
        raise HTTPException(401, "Invalid email or password.")

    user = _parse_user(pages[0])
    if user["password_hash"] != _hash(body.password):
        raise HTTPException(401, "Invalid email or password.")

    return {"user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.post("/signup", tags=["Auth"])
def notion_signup(body: SignupRequest):
    email = body.email.strip().lower()
    try:
        existing = _query_users(email)
        if existing:
            raise HTTPException(409, "An account with that email already exists.")
        user = _create_user(email, body.name.strip(), _hash(body.password))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")

    return {"success": True, "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.post("/sso", tags=["Auth"])
def notion_sso(body: SSORequest):
    try:
        payload = jwt.decode(body.token, SSO_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "SSO token has expired.")
    except jwt.PyJWTError as exc:
        raise HTTPException(401, f"Invalid SSO token: {exc}")

    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(422, "JWT payload missing 'email' claim.")

    try:
        pages = _query_users(email)
        if pages:
            user = _parse_user(pages[0])
        else:
            random_pw = secrets.token_urlsafe(16)
            user = _create_user(email, "", _hash(random_pw))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")

    return {"user": {k: v for k, v in user.items() if k != "password_hash"}}


# ══════════════════════════════════════════════════════════════════════════════
# Watchlist endpoints
# Schema: Symbol (title), User Email (email property), Added at (date)
# ══════════════════════════════════════════════════════════════════════════════

def _parse_watchlist(page: dict) -> dict:
    props = page.get("properties", {})
    # Symbol is a title-type property — find it dynamically
    symbol = None
    for key, val in props.items():
        if val.get("type") == "title":
            symbol = _title(val)
            break
    return {
        "id":     page["id"],
        "symbol": symbol or "",
    }


@router.get("/watchlist", tags=["Notion"])
def get_watchlist(email: str):
    try:
        res = _post(f"/databases/{WATCHLIST_DB_ID}/query", {
            "filter": {"property": "User Email", "email": {"equals": email}}
        })
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")
    return [_parse_watchlist(p) for p in res.get("results", [])]


class WatchlistAddRequest(BaseModel):
    email: str
    symbol: str


@router.post("/watchlist", tags=["Notion"])
def add_watchlist(body: WatchlistAddRequest):
    symbol = body.symbol.strip().upper()
    email  = body.email.strip().lower()

    # Duplicate guard
    try:
        existing = _post(f"/databases/{WATCHLIST_DB_ID}/query", {
            "filter": {
                "and": [
                    {"property": "User Email", "email": {"equals": email}},
                    {"property": "Symbol",     "title": {"equals": symbol}},
                ]
            }
        })
        if existing.get("results"):
            return _parse_watchlist(existing["results"][0])

        page = _post("/pages", {
            "parent": {"database_id": WATCHLIST_DB_ID},
            "properties": {
                "Symbol":     {"title": [{"text": {"content": symbol}}]},
                "User Email": {"email": email},
                "Added at":   {"date": {"start": _today()}},
            },
        })
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")

    return _parse_watchlist(page)


@router.delete("/watchlist/{page_id}", tags=["Notion"])
def remove_watchlist(page_id: str):
    try:
        _patch(f"/pages/{page_id}", {"archived": True})
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")
    return {"status": "archived", "id": page_id}


# ══════════════════════════════════════════════════════════════════════════════
# Trade Log endpoints
# Schema:
#   Title       (title)       — auto-generated
#   User Email  (email)
#   Symbol      (rich_text)
#   Side        (select)      BUY | SELL
#   Entry Price (number)
#   Qty         (number)
#   Entry Date  (date)
#   Exit Price  (number)
#   Exit Date   (date)
#   Status      (select)      Open | Closed
#   Notes       (rich_text)
# ══════════════════════════════════════════════════════════════════════════════

def _parse_trade(page: dict) -> dict:
    props = page.get("properties", {})
    return {
        "id":         page["id"],
        "symbol":     _rich(props.get("Symbol", {})),
        "userEmail":  _email_prop(props.get("User Email", {})),
        "side":       _select(props.get("Side", {})),
        "entryPrice": _num(props.get("Entry Price", {})),
        "qty":        _num(props.get("Qty", {})),
        "entryDate":  _date(props.get("Entry Date", {})),
        "exitPrice":  _num(props.get("Exit Price", {})),
        "exitDate":   _date(props.get("Exit Date", {})),
        "status":     _select(props.get("Status", {})),
        "notes":      _rich(props.get("Notes", {})),
    }


@router.get("/trades", tags=["Notion"])
def get_trades(email: str, limit: int = 50):
    try:
        res = _post(f"/databases/{TRADELOG_DB_ID}/query", {
            "filter":    {"property": "User Email", "email": {"equals": email}},
            "sorts":     [{"timestamp": "created_time", "direction": "descending"}],
            "page_size": limit,
        })
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")
    return [_parse_trade(p) for p in res.get("results", [])]


class TradeAddRequest(BaseModel):
    email:       str
    symbol:      str
    side:        str          # "BUY" | "SELL"
    entry_price: float
    qty:         float
    entry_date:  str          # "YYYY-MM-DD"
    notes:       Optional[str] = ""


@router.post("/trades", tags=["Notion"])
def add_trade(body: TradeAddRequest):
    symbol = body.symbol.strip().upper()
    email  = body.email.strip().lower()
    # Build auto-title
    username = email.split("@")[0]
    title_str = f"{username} · {symbol} · {body.entry_date}"

    try:
        page = _post("/pages", {
            "parent": {"database_id": TRADELOG_DB_ID},
            "properties": {
                "Title":       {"title": [{"text": {"content": title_str}}]},
                "User Email":  {"email": email},
                "Symbol":      {"rich_text": [{"text": {"content": symbol}}]},
                "Side":        {"select": {"name": body.side.upper()}},
                "Entry Price": {"number": body.entry_price},
                "Qty":         {"number": body.qty},
                "Entry Date":  {"date": {"start": body.entry_date}},
                "Status":      {"select": {"name": "Open"}},
                "Notes":       {"rich_text": [{"text": {"content": body.notes or ""}}]},
            },
        })
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")
    return _parse_trade(page)


class TradeCloseRequest(BaseModel):
    exit_price: float
    exit_date:  str   # "YYYY-MM-DD"


@router.patch("/trades/{page_id}/close", tags=["Notion"])
def close_trade(page_id: str, body: TradeCloseRequest):
    try:
        page = _patch(f"/pages/{page_id}", {
            "properties": {
                "Exit Price": {"number": body.exit_price},
                "Exit Date":  {"date": {"start": body.exit_date}},
                "Status":     {"select": {"name": "Closed"}},
            }
        })
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")
    return _parse_trade(page)


@router.delete("/trades/{page_id}", tags=["Notion"])
def delete_trade(page_id: str):
    try:
        _patch(f"/pages/{page_id}", {"archived": True})
    except Exception as exc:
        raise HTTPException(502, f"Notion error: {exc}")
    return {"status": "archived", "id": page_id}
