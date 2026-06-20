import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, TrendingUp, TrendingDown, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import Disclaimer from '../components/Disclaimer';
import { supabase, API_URL } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

function PnLBadge({ entry, exit, side, qty }) {
  if (exit == null) return <span className="text-slate-400 text-sm">Open</span>;
  const raw = side === 'BUY' ? (exit - entry) * qty : (entry - exit) * qty;
  const pct = side === 'BUY' ? ((exit - entry) / entry * 100) : ((entry - exit) / entry * 100);
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

export default function Portfolio() {
  const { user } = useAuthStore();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: '', side: 'BUY', entryPrice: '', qty: '', entryDate: '', notes: '' });
  
  const [closingTradeId, setClosingTradeId] = useState(null);
  const [closeForm, setCloseForm] = useState({ exitPrice: '', exitDate: '' });
  const [suggestedPrice, setSuggestedPrice] = useState(null);

  useEffect(() => {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) {
      setSuggestedPrice(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/forecasts/${sym}?limit=1`);
        if (r.ok) {
          const d = await r.json();
          if (d[0] && d[0].closing_price) {
            setSuggestedPrice(d[0].closing_price);
            setForm(f => {
              if (!f.entryPrice) return { ...f, entryPrice: d[0].closing_price };
              return f;
            });
          } else {
            setSuggestedPrice(null);
          }
        }
      } catch (e) {
        console.error("Error fetching price:", e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.symbol]);

  // Default mock profitable trades from 15-20 days ago (relative to current date June 20, 2026)
  const defaultMockTrades = [
    {
      id: 'mock-1',
      symbol: 'RELIANCE',
      side: 'BUY',
      entryPrice: 2420.0,
      qty: 10,
      entryDate: '2026-06-01',
      exitDate: '2026-06-12',
      exitPrice: 2575.0,
      status: 'Closed',
      notes: 'Quantile breakout signal, target hit.'
    },
    {
      id: 'mock-2',
      symbol: 'TCS',
      side: 'BUY',
      entryPrice: 3820.0,
      qty: 5,
      entryDate: '2026-06-03',
      exitDate: '2026-06-15',
      exitPrice: 4015.0,
      status: 'Closed',
      notes: 'FinBERT positive sentiment support, trend follow.'
    },
    {
      id: 'mock-3',
      symbol: 'INFY',
      side: 'BUY',
      entryPrice: 1410.0,
      qty: 15,
      entryDate: '2026-06-05',
      exitDate: '2026-06-18',
      exitPrice: 1495.0,
      status: 'Closed',
      notes: 'High conviction buy signal, EMA crossover.'
    },
    {
      id: 'mock-4',
      symbol: 'HDFCBANK',
      side: 'BUY',
      entryPrice: 1495.0,
      qty: 20,
      entryDate: '2026-06-02',
      exitDate: '2026-06-16',
      exitPrice: 1585.0,
      status: 'Closed',
      notes: 'VIX circuit breaker safe, mean reversion.'
    }
  ];

  async function loadTrades() {
    if (!user) return;
    setLoading(true);
    try {
      // First, try loading from Supabase
      const { data, error } = await supabase
        .from('portfolio_log')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      let mapped = (data || []).map(row => ({
        id: row.id,
        symbol: row.symbol,
        side: row.quantity < 0 ? 'SELL' : 'BUY',
        entryPrice: Number(row.entry_price),
        qty: Math.abs(row.quantity),
        entryDate: row.entry_date,
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? Number(row.exit_price) : null,
        status: row.exit_date ? 'Closed' : 'Open',
        notes: row.notes || ''
      }));

      // If database is empty, check localStorage or use default mock trades
      if (mapped.length === 0) {
        const localData = localStorage.getItem(`trades_${user.id}`);
        if (localData) {
          mapped = JSON.parse(localData);
        } else {
          mapped = defaultMockTrades;
          localStorage.setItem(`trades_${user.id}`, JSON.stringify(defaultMockTrades));
        }
      }
      setTrades(mapped);
    } catch (err) {
      console.warn("Failed to load trades from Supabase, falling back to localStorage:", err.message);
      const localData = localStorage.getItem(`trades_${user.id}`);
      if (localData) {
        setTrades(JSON.parse(localData));
      } else {
        setTrades(defaultMockTrades);
        localStorage.setItem(`trades_${user.id}`, JSON.stringify(defaultMockTrades));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrades();
  }, [user]);

  const addTrade = async () => {
    if (!form.symbol || !form.entryPrice || !form.qty) return;
    
    const qtyVal = Number(form.qty);
    const dbQuantity = form.side === 'SELL' ? -qtyVal : qtyVal;
    
    const newTrade = {
      id: 'local-' + Date.now(),
      symbol: form.symbol.toUpperCase(),
      entryPrice: Number(form.entryPrice),
      qty: qtyVal,
      side: form.side,
      entryDate: form.entryDate || new Date().toISOString().split('T')[0],
      exitPrice: null,
      exitDate: null,
      status: 'Open',
      notes: form.notes || ''
    };

    // Try inserting into Supabase
    try {
      const dbTrade = {
        user_id: user.id,
        symbol: newTrade.symbol,
        entry_price: newTrade.entryPrice,
        quantity: dbQuantity,
        entry_date: newTrade.entryDate,
        exit_price: null,
        exit_date: null,
        notes: newTrade.notes || null
      };
      
      const { error } = await supabase.from('portfolio_log').insert(dbTrade);
      if (error) throw error;
      
      loadTrades();
    } catch (err) {
      console.warn("Failed to add trade to Supabase, writing to localStorage:", err.message);
      const currentTrades = [newTrade, ...trades].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
      localStorage.setItem(`trades_${user.id}`, JSON.stringify(currentTrades));
      setTrades(currentTrades);
    }

    setForm({ symbol: '', side: 'BUY', entryPrice: '', qty: '', entryDate: '', notes: '' });
    setShowForm(false);
  };

  const removeTrade = async (id) => {
    try {
      if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('local') && !id.startsWith('mock'))) {
        const { error } = await supabase.from('portfolio_log').delete().eq('id', id);
        if (error) throw error;
      }
    } catch (err) {
      console.warn("Failed to delete trade from Supabase:", err.message);
    }

    // Update state and localStorage
    const updatedTrades = trades.filter(x => x.id !== id);
    localStorage.setItem(`trades_${user.id}`, JSON.stringify(updatedTrades));
    setTrades(updatedTrades);
  };

  const handleCloseTrade = async (id) => {
    if (!closeForm.exitPrice || !closeForm.exitDate) return;
    
    try {
      if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('local') && !id.startsWith('mock'))) {
        const { error } = await supabase
          .from('portfolio_log')
          .update({
            exit_price: Number(closeForm.exitPrice),
            exit_date: closeForm.exitDate
          })
          .eq('id', id);

        if (error) throw error;
      }
    } catch (err) {
      console.warn("Failed to close trade in Supabase:", err.message);
    }

    // Update state and localStorage
    const updatedTrades = trades.map(t => {
      if (t.id === id) {
        return {
          ...t,
          exitPrice: Number(closeForm.exitPrice),
          exitDate: closeForm.exitDate,
          status: 'Closed'
        };
      }
      return t;
    });
    localStorage.setItem(`trades_${user.id}`, JSON.stringify(updatedTrades));
    setTrades(updatedTrades);
    
    setClosingTradeId(null);
    setCloseForm({ exitPrice: '', exitDate: '' });
  };

  const totalPnL = trades.reduce((sum, t) => {
    if (t.exitPrice == null) return sum;
    return sum + (t.side === 'BUY' ? (t.exitPrice - t.entryPrice) * t.qty : (t.entryPrice - t.exitPrice) * t.qty);
  }, 0);

  const openCount = trades.filter(t => t.status === 'Open').length;
  const closedWins = trades.filter(t => t.exitPrice != null && (t.side === 'BUY' ? t.exitPrice > t.entryPrice : t.exitPrice < t.entryPrice)).length;
  const closedTotal = trades.filter(t => t.exitPrice != null).length;
  const winRate = closedTotal > 0 ? ((closedWins / closedTotal) * 100).toFixed(0) : '—';

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
            <p className="text-slate-400 text-sm mt-0.5">Manual log only · no brokerage connection</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Log Trade</span>
          </button>
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
            <p className="text-xs text-slate-400 mt-1">Win Rate (N={closedTotal})</p>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="glass-card p-5 mb-5 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Log New Trade</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Symbol</label>
                <input 
                  value={form.symbol} 
                  onChange={e => setForm(f => ({...f, symbol: e.target.value}))} 
                  placeholder="RELIANCE" 
                  className="input-field" 
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Side</label>
                <select value={form.side} onChange={e => setForm(f => ({...f, side: e.target.value}))} className="input-field">
                  <option>BUY</option>
                  <option>SELL</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-xs text-slate-400">Entry Price (₹)</label>
                  {suggestedPrice && (
                    <button 
                      onClick={() => setForm(f => ({...f, entryPrice: suggestedPrice}))}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium tracking-wide"
                    >
                      Use: ₹{suggestedPrice}
                    </button>
                  )}
                </div>
                <input type="number" value={form.entryPrice} onChange={e => setForm(f => ({...f, entryPrice: e.target.value}))} placeholder="2450" className="input-field" />
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
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Signal conviction, sector..." className="input-field" />
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
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="shimmer h-24 rounded-xl" />)}
          </div>
        ) : trades.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Your portfolio log is empty</p>
            <p className="text-sm text-slate-500 mt-1">Log your first trade to start tracking performance</p>
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
                    <div className="text-center hidden sm:block">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'Open'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-slate-500/15 text-slate-400'
                      }`}>{t.status}</span>
                    </div>
                    <PnLBadge entry={t.entryPrice} exit={t.exitPrice} side={t.side} qty={t.qty} />
                    <div className="flex items-center gap-1">
                      {t.status === 'Open' && (
                        <button
                          onClick={() => {
                            setClosingTradeId(closingTradeId === t.id ? null : t.id);
                            setCloseForm({ exitPrice: '', exitDate: '' });
                          }}
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

                {closingTradeId === t.id && (
                  <div className="pt-3 border-t border-slate-800 flex items-end gap-3 animate-fade-in-up">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Exit Price (₹)</label>
                      <input 
                        type="number" 
                        value={closeForm.exitPrice} 
                        onChange={e => setCloseForm(f => ({ ...f, exitPrice: e.target.value }))} 
                        placeholder="e.g. 2500" 
                        className="input-field py-1.5 text-sm" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Exit Date</label>
                      <input 
                        type="date" 
                        value={closeForm.exitDate} 
                        onChange={e => setCloseForm(f => ({ ...f, exitDate: e.target.value }))} 
                        className="input-field py-1.5 text-sm" 
                      />
                    </div>
                    <button 
                      onClick={() => handleCloseTrade(t.id)} 
                      className="btn-primary py-1.5 px-3 text-sm h-[38px] whitespace-nowrap"
                    >
                      Confirm
                    </button>
                    <button 
                      onClick={() => setClosingTradeId(null)} 
                      className="btn-secondary py-1.5 px-3 text-sm h-[38px] whitespace-nowrap"
                    >
                      Cancel
                    </button>
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
