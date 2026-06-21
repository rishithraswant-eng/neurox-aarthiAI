import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Clock, Plus, Search, Trash2, ChevronRight } from 'lucide-react';
import { API_URL } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import Disclaimer from '../components/Disclaimer';

export default function Watchlist() {
  const { user }     = useAuthStore();
  const navigate     = useNavigate();
  const [items, setItems]       = useState([]);  // [{ id, symbol }]
  const [forecasts, setForecasts] = useState({});
  const [search, setSearch]     = useState('');
  const [addSymbol, setAddSymbol] = useState('');
  const [adding, setAdding]     = useState(false);
  const [loading, setLoading]   = useState(true);

  // ── Load watchlist from Notion ────────────────────────────────────────────
  async function loadWatchlist() {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notion/watchlist?email=${encodeURIComponent(user.email)}`);
      const data = res.ok ? await res.json() : [];
      setItems(data);

      // Fetch forecast for each symbol in parallel
      const fmap = {};
      await Promise.all(data.map(async ({ symbol }) => {
        try {
          const r = await fetch(`${API_URL}/forecasts/${symbol}?limit=1`);
          if (r.ok) {
            const d = await r.json();
            if (d[0]) fmap[symbol] = d[0];
          }
        } catch (_) {}
      }));
      setForecasts(fmap);
    } catch (err) {
      console.error('Watchlist load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWatchlist(); }, [user]);

  // ── Add to watchlist ──────────────────────────────────────────────────────
  const addToWatchlist = async () => {
    const sym = addSymbol.trim().toUpperCase();
    if (!sym || !user?.email) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/notion/watchlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: user.email, symbol: sym }),
      });
      if (res.ok) {
        setAddSymbol('');
        loadWatchlist();
      }
    } catch (err) {
      console.error('Add watchlist error:', err);
    } finally {
      setAdding(false);
    }
  };

  // ── Remove from watchlist ─────────────────────────────────────────────────
  const removeFromWatchlist = async (pageId, symbol) => {
    // Optimistic update
    setItems(prev => prev.filter(i => i.id !== pageId));
    try {
      await fetch(`${API_URL}/notion/watchlist/${pageId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Remove watchlist error:', err);
      loadWatchlist(); // re-sync on failure
    }
  };

  const filtered = items.filter(i => !search || i.symbol.includes(search.toUpperCase()));

  return (
    <div className="bg-mesh min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Star className="w-6 h-6 text-amber-400" />
              <span>Watchlist</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Track your favourite Nifty 500 stocks · Notion-synced</p>
          </div>
        </div>

        {/* Add symbol */}
        <div className="glass-card p-4 mb-5 flex gap-3">
          <input
            id="watchlist-add-input"
            value={addSymbol}
            onChange={e => setAddSymbol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addToWatchlist()}
            placeholder="Add symbol (e.g. RELIANCE)"
            className="input-field flex-1"
          />
          <button
            id="watchlist-add-btn"
            onClick={addToWatchlist}
            disabled={adding}
            className="btn-primary flex items-center space-x-1 disabled:opacity-60"
          >
            {adding
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Plus className="w-4 h-4" /><span>Add</span></>
            }
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter watchlist..."
            className="input-field pl-9"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="shimmer h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Star className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Your watchlist is empty</p>
            <p className="text-sm text-slate-500 mt-1">Add symbols above to track their signals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ id, symbol }) => {
              const f      = forecasts[symbol];
              const stance = f?.signal_stance || null;
              return (
                <div
                  key={id}
                  className="glass-card p-4 flex items-center justify-between cursor-pointer hover:border-blue-500/30 transition-all"
                  onClick={() => navigate(`/stock/${symbol}`)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{symbol[0]}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{symbol}</p>
                      {f && <p className="text-xs text-slate-400">₹{f.closing_price} · {f.forecast_date}</p>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {stance && (
                      <span className={`badge-${stance.toLowerCase()} px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1`}>
                        {stance === 'BUY'  && <TrendingUp   className="w-3 h-3" />}
                        {stance === 'SELL' && <TrendingDown  className="w-3 h-3" />}
                        {stance === 'HOLD' && <Clock         className="w-3 h-3" />}
                        <span>{stance}</span>
                      </span>
                    )}
                    {f && <span className="text-xs font-mono-num text-slate-400">{f.conviction_score}/10</span>}
                    <button
                      onClick={e => { e.stopPropagation(); removeFromWatchlist(id, symbol); }}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8"><Disclaimer /></div>
      </div>
    </div>
  );
}
