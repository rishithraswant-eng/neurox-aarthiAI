import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, TrendingUp, TrendingDown, Trash2, CheckCircle, ExternalLink } from 'lucide-react';
import Disclaimer from '../components/Disclaimer';
import { API_URL } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// ── P&L display helper ────────────────────────────────────────────────────────
function PnLBadge({ entry, exit, side, qty }) {
  if (exit == null) return <span className="text-slate-400 text-sm">Open</span>;
  const raw = side === 'BUY' ? (exit - entry) * qty : (entry - exit) * qty;
  const pct = side === 'BUY'
    ? ((exit - entry) / entry * 100)
    : ((entry - exit) / entry * 100);
  const isPos = raw >= 0;
  return (
    <div className="text-right">
      <p className={`text-sm font-bold font-mono-num ${isPos ? 'text-positive' : 'text-negative'}`}>
        {isPos ? '+' : ''}₹{raw.toFixed(0)}
      </p>
      <p className={`text-xs ${isPos ? 'text-positive' : 'text-negative'}`}>
        {isPos ? '+' : ''}{pct.toFixed(2)}%
      </p>
    </div>
  );
}

// ── Mock trades (shown when Notion + localStorage are both empty) ─────────────
const DEFAULT_MOCK_TRADES = [
  { id: 'mock-1', symbol: 'RELIANCE', side: 'BUY', entryPrice: 2420, qty: 10, entryDate: '2026-06-01', exitDate: '2026-06-12', exitPrice: 2575, status: 'Closed', notes: 'Quantile breakout signal, target hit.' },
  { id: 'mock-2', symbol: 'TCS',      side: 'BUY', entryPrice: 3820, qty: 5,  entryDate: '2026-06-03', exitDate: '2026-06-15', exitPrice: 4015, status: 'Closed', notes: 'FinBERT positive sentiment support.' },
  { id: 'mock-3', symbol: 'INFY',     side: 'BUY', entryPrice: 1410, qty: 15, entryDate: '2026-06-05', exitDate: '2026-06-18', exitPrice: 1495, status: 'Closed', notes: 'High conviction buy signal.' },
  { id: 'mock-4', symbol: 'HDFCBANK', side: 'BUY', entryPrice: 1495, qty: 20, entryDate: '2026-06-02', exitDate: '2026-06-16', exitPrice: 1585, status: 'Closed', notes: 'VIX safe zone, mean reversion.' },
];

// ── Map Notion trade response to local shape ──────────────────────────────────
function mapNotionTrade(t) {
  return {
    id:         t.id,
    symbol:     t.symbol || '',
    side:       t.side   || 'BUY',
    entryPrice: t.entryPrice || 0,
    qty:        t.qty || 0,
    entryDate:  t.entryDate || '',
    exitPrice:  t.exitPrice ?? null,
    exitDate:   t.exitDate  ?? null,
    status:     t.status   || 'Open',
    notes:      t.notes    || '',
  };
}

export default function Portfolio() {
  const { user }  = useAuthStore();
  const [trades, setTrades]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ symbol: '', side: 'BUY', entryPrice: '', qty: '', entryDate: '', notes: '' });
  const [suggestedPrice, setSuggested] = useState(null);
  const [closingId, setClosingId]   = useState(null);
  const [closeForm, setCloseForm]   = useState({ exitPrice: '', exitDate: '' });

  // ── Price suggestion when typing symbol ─────────────────────────────────────
  useEffect(() => {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) { setSuggested(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/forecasts/${sym}?limit=1`);
        if (r.ok) {
          const d = await r.json();
          if (d[0]?.closing_price) {
            setSuggested(d[0].closing_price);
            setForm(f => f.entryPrice ? f : { ...f, entryPrice: d[0].closing_price });
          } else setSuggested(null);
        }
      } catch (_) {}
    }, 400);
    return () => clearTimeout(t);
  }, [form.symbol]);

  // ── Load trades: Notion → localStorage → mock ────────────────────────────────
  async function loadTrades() {
    if (!user) return;
    setLoading(true);
    const localKey = `trades_${user.id || user.email}`;

    try {
      const res  = await fetch(`${API_URL}/notion/trades?email=${encodeURIComponent(user.email)}`);
      const data = res.ok ? await res.json() : null;

      if (data !== null) {
        setTrades(data.map(mapNotionTrade));
        localStorage.setItem(localKey, JSON.stringify(data.map(mapNotionTrade)));
      } else {
        // Notion fetch failed (!res.ok) → check localStorage
        const local = localStorage.getItem(localKey);
        if (local) {
          setTrades(JSON.parse(local));
        } else {
          // Fallback if absolutely nothing works
          setTrades(DEFAULT_MOCK_TRADES);
          localStorage.setItem(localKey, JSON.stringify(DEFAULT_MOCK_TRADES));
        }
      }
    } catch (err) {
      console.warn('Notion trades failed, falling back to localStorage:', err.message);
      const local = localStorage.getItem(localKey);
      setTrades(local ? JSON.parse(local) : DEFAULT_MOCK_TRADES);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrades(); }, [user]);

  // ── Add trade ─────────────────────────────────────────────────────────────────
  const addTrade = async () => {
    if (!form.symbol || !form.entryPrice || !form.qty || !user?.email) return;

    const payload = {
      email:       user.email,
      symbol:      form.symbol.toUpperCase(),
      side:        form.side,
      entry_price: Number(form.entryPrice),
      qty:         Number(form.qty),
      entry_date:  form.entryDate || new Date().toISOString().split('T')[0],
      notes:       form.notes || '',
    };

    const localKey = `trades_${user.id || user.email}`;

    try {
      const res = await fetch(`${API_URL}/notion/trades`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (res.ok) {
        loadTrades();
      } else throw new Error('Notion failed');
    } catch (err) {
      console.warn('Notion add trade failed, writing locally:', err.message);
      const newTrade = {
        id: 'local-' + Date.now(),
        symbol:     payload.symbol,
        side:       payload.side,
        entryPrice: payload.entry_price,
        qty:        payload.qty,
        entryDate:  payload.entry_date,
        exitPrice: null, exitDate: null, status: 'Open',
        notes: payload.notes,
      };
      const updated = [newTrade, ...trades];
      localStorage.setItem(localKey, JSON.stringify(updated));
      setTrades(updated);
    }

    setForm({ symbol: '', side: 'BUY', entryPrice: '', qty: '', entryDate: '', notes: '' });
    setShowForm(false);
  };

  // ── Close trade ───────────────────────────────────────────────────────────────
  const handleClose = async (id) => {
    if (!closeForm.exitPrice || !closeForm.exitDate) return;
    const localKey = `trades_${user.id || user.email}`;
    const isLocal  = typeof id === 'string' && (id.startsWith('local-') || id.startsWith('mock-'));

    if (!isLocal) {
      try {
        await fetch(`${API_URL}/notion/trades/${id}/close`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ exit_price: Number(closeForm.exitPrice), exit_date: closeForm.exitDate }),
        });
      } catch (err) {
        console.warn('Notion close trade failed:', err.message);
      }
    }

    const updated = trades.map(t => t.id === id
      ? { ...t, exitPrice: Number(closeForm.exitPrice), exitDate: closeForm.exitDate, status: 'Closed' }
      : t
    );
    localStorage.setItem(localKey, JSON.stringify(updated));
    setTrades(updated);
    setClosingId(null);
    setCloseForm({ exitPrice: '', exitDate: '' });
  };

  // ── Remove trade ──────────────────────────────────────────────────────────────
  const removeTrade = async (id) => {
    const localKey = `trades_${user.id || user.email}`;
    const isLocal  = typeof id === 'string' && (id.startsWith('local-') || id.startsWith('mock-'));

    if (!isLocal) {
      try {
        await fetch(`${API_URL}/notion/trades/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Notion delete trade failed:', err.message);
      }
    }

    const updated = trades.filter(t => t.id !== id);
    localStorage.setItem(localKey, JSON.stringify(updated));
    setTrades(updated);
  };

  // ── Summary stats ──────────────────────────────────────────────────────────────
  const totalPnL   = trades.reduce((s, t) => t.exitPrice == null ? s : s + (t.side === 'BUY' ? (t.exitPrice - t.entryPrice) * t.qty : (t.entryPrice - t.exitPrice) * t.qty), 0);
  const openCount  = trades.filter(t => t.status === 'Open').length;
  const closed     = trades.filter(t => t.exitPrice != null);
  const wins       = closed.filter(t => t.side === 'BUY' ? t.exitPrice > t.entryPrice : t.exitPrice < t.entryPrice).length;
  const winRate    = closed.length > 0 ? ((wins / closed.length) * 100).toFixed(0) : '—';

  return (
    <div className="bg-mesh min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
              <BookOpen className="w-6 h-6 text-violet-400" />
              <span>Trade Log</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Manual log · Notion-synced</p>
          </div>
          <div className="flex items-center space-x-3">
            <a 
              href="https://www.notion.so/385c2d8e16e780eeab3ce93c2a7397dc" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-secondary flex items-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Log Summary</span>
            </a>
            <button id="add-trade-btn" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center space-x-2">
              <Plus className="w-4 h-4" /><span>Log Trade</span>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="glass-card p-4 text-center">
            <p className={`text-2xl font-bold font-mono-num ${totalPnL >= 0 ? 'text-positive' : 'text-negative'}`}>
              {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Total P&L (closed)</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{openCount}</p>
            <p className="text-xs text-slate-400 mt-1">Open Positions</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{winRate}%</p>
            <p className="text-xs text-slate-400 mt-1">Win Rate (N={closed.length})</p>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="glass-card p-5 mb-5 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Log New Trade</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Symbol</label>
                <input id="trade-symbol" value={form.symbol} onChange={e => setForm(f => ({...f, symbol: e.target.value}))} placeholder="RELIANCE" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Side</label>
                <select value={form.side} onChange={e => setForm(f => ({...f, side: e.target.value}))} className="input-field">
                  <option>BUY</option><option>SELL</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-xs text-slate-400">Entry Price (₹)</label>
                  {suggestedPrice && (
                    <button onClick={() => setForm(f => ({...f, entryPrice: suggestedPrice}))} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium">
                      Use: ₹{suggestedPrice}
                    </button>
                  )}
                </div>
                <input id="trade-entry-price" type="number" value={form.entryPrice} onChange={e => setForm(f => ({...f, entryPrice: e.target.value}))} placeholder="2450" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                <input type="number" value={form.qty} onChange={e => setForm(f => ({...f, qty: e.target.value}))} placeholder="5" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Entry Date</label>
                <input type="date" value={form.entryDate} onChange={e => setForm(f => ({...f, entryDate: e.target.value}))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Signal, sector..." className="input-field" />
              </div>
            </div>
            <div className="flex space-x-2 mt-4">
              <button onClick={addTrade} className="btn-primary flex-1">Add Trade</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* Trade list */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-xl" />)}</div>
        ) : trades.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Your trade log is empty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map(t => (
              <div key={t.id} className="glass-card p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.side === 'BUY' ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                      {t.side === 'BUY' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{t.symbol}</p>
                      <p className="text-xs text-slate-400">{t.side} · {t.qty} shares · ₹{t.entryPrice}</p>
                      <p className="text-xs text-slate-500">{t.entryDate}{t.exitDate ? ` → ${t.exitDate}` : ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full hidden sm:block ${t.status === 'Open' ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-500/15 text-slate-400'}`}>
                      {t.status}
                    </span>
                    <PnLBadge entry={t.entryPrice} exit={t.exitPrice} side={t.side} qty={t.qty} />
                    <div className="flex items-center gap-1">
                      {t.status === 'Open' && (
                        <button
                          onClick={() => { setClosingId(closingId === t.id ? null : t.id); setCloseForm({ exitPrice: '', exitDate: '' }); }}
                          className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-slate-600 hover:text-emerald-400 transition-colors"
                          title="Close Position"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => removeTrade(t.id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Close form */}
                {closingId === t.id && (
                  <div className="pt-3 border-t border-slate-800 flex items-end gap-3 animate-fade-in-up">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Exit Price (₹)</label>
                      <input type="number" value={closeForm.exitPrice} onChange={e => setCloseForm(f => ({...f, exitPrice: e.target.value}))} placeholder="e.g. 2500" className="input-field py-1.5 text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Exit Date</label>
                      <input type="date" value={closeForm.exitDate} onChange={e => setCloseForm(f => ({...f, exitDate: e.target.value}))} className="input-field py-1.5 text-sm" />
                    </div>
                    <button onClick={() => handleClose(t.id)} className="btn-primary py-1.5 px-3 text-sm h-[38px] whitespace-nowrap">Confirm</button>
                    <button onClick={() => setClosingId(null)} className="btn-secondary py-1.5 px-3 text-sm h-[38px] whitespace-nowrap">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8"><Disclaimer /></div>
      </div>
    </div>
  );
}
