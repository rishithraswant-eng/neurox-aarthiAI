import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import HonestyBanner from '../../components/longterm/HonestyBanner';
import FactorBreakdown from '../../components/longterm/FactorBreakdown';
import { Activity, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function LongTermStockDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('longterm_signals')
          .select('*')
          .eq('symbol', symbol)
          .order('signal_date', { ascending: false })
          .limit(1);

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Signal not found for this symbol.');
        }

        const { data: rangeData } = await supabase
          .from('longterm_signals')
          .select('composite_score')
          .eq('signal_date', data[0].signal_date)
          .eq('hard_gate_passed', true);
        
        let display_score = null;
        if (rangeData && rangeData.length > 0) {
          const scores = rangeData.map(s => s.composite_score).filter(s => s != null);
          const maxScore = Math.max(...scores);
          const minScore = Math.min(...scores);
          if (data[0].composite_score != null) {
            display_score = maxScore === minScore ? 100 : ((data[0].composite_score - minScore) / (maxScore - minScore)) * 100;
          }
        }
        data[0].display_score = display_score;

        setSignal(data[0]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="w-8 h-8 text-[var(--color-positive)] animate-pulse" />
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => navigate('/longterm')} className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Rankings</span>
        </button>
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
          {error || 'Not found'}
        </div>
      </div>
    );
  }

  const formatRaw = (val, isPct = false, needsMult = true) => {
    if (val === null || val === undefined) return 'N/A';
    if (isPct) {
      const v = needsMult ? val * 100 : val;
      return v.toFixed(2) + '%';
    }
    return val.toFixed(2);
  };

  const formatZ = (val) => {
    if (val === null || val === undefined) return 'N/A';
    return (val > 0 ? '+' : '') + val.toFixed(2) + 'z';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <button onClick={() => navigate('/longterm')} className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Rankings</span>
      </button>

      <HonestyBanner />

      <div className="bg-[var(--bg-card)] border border-[var(--text-caption)]/20 rounded-xl p-6 mb-6 mt-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-[var(--text-caption)]/10 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-display text-[var(--text-primary)]">{signal.symbol}</h1>
            <div className="flex items-center space-x-3 mt-2">
              <span className="text-sm font-label text-[var(--text-secondary)]">Long-Term (60-Day) Horizon</span>
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-label uppercase tracking-wider">
                <ShieldAlert className="w-3 h-3" />
                <span>Challenger Model (Unvalidated)</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm text-[var(--text-secondary)] font-label mb-1 uppercase tracking-wider">Universe Rank</div>
            <div className="text-4xl font-data text-[var(--color-positive)]">#{signal.rank_in_universe || 'N/A'}</div>
            {signal.rank_in_sector && (
              <div className="text-xs text-[var(--text-caption)] font-label mt-1">Sector Rank: #{signal.rank_in_sector}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-display text-[var(--text-primary)] mb-4 border-b border-[var(--text-caption)]/10 pb-2">Factor Visualization</h3>
            <div className="bg-[#1a1612] rounded-lg p-6 flex justify-center items-center border border-[var(--text-caption)]/10 min-h-[160px]">
              <div className="scale-150">
                <FactorBreakdown signal={signal} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-display text-[var(--text-primary)] mb-4 border-b border-[var(--text-caption)]/10 pb-2">Metrics Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)] font-label text-sm">Ranking Score (0-100)</span>
                <span className="text-[var(--text-primary)] font-data font-medium">{signal.display_score != null ? signal.display_score.toFixed(1) : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)] font-label text-sm flex flex-col">
                  <span>Momentum</span>
                  <span className="text-[10px] text-[var(--text-caption)]">6M Returns</span>
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-[var(--text-primary)] font-data font-medium">{formatZ(signal.momentum_z)}</span>
                  <span className="text-[10px] text-[var(--text-caption)] font-data">{formatRaw(signal.momentum_6m, true, true)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)] font-label text-sm flex flex-col">
                  <span>Low Volatility</span>
                  <span className="text-[10px] text-[var(--text-caption)]">60D Realized</span>
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-[var(--text-primary)] font-data font-medium">{formatZ(signal.lowvol_z)}</span>
                  <span className="text-[10px] text-[var(--text-caption)] font-data">{formatRaw(signal.realized_vol_60d, true, true)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)] font-label text-sm flex flex-col">
                  <span>Delivery</span>
                  <span className="text-[10px] text-[var(--text-caption)]">20D EMA</span>
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-[var(--text-primary)] font-data font-medium">{formatZ(signal.delivery_z)}</span>
                  <span className="text-[10px] text-[var(--text-caption)] font-data">{formatRaw(signal.delivery_ema_20d, true, false)}</span>
                </div>
              </div>
              
              <div className="pt-2 mt-2 border-t border-[var(--text-caption)]/10">
                <h4 className="text-[10px] uppercase tracking-wider font-label text-[var(--text-caption)] mb-2">Display Only (Missing History)</h4>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--text-secondary)] font-label text-sm flex flex-col">
                    <span>Value</span>
                    <span className="text-[10px] text-[var(--text-caption)]">Trailing P/E</span>
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-[var(--text-caption)] font-data italic">{formatZ(signal.value_z)}</span>
                    <span className="text-[10px] text-[var(--text-caption)] font-data">{formatRaw(signal.trailing_pe)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--text-secondary)] font-label text-sm flex flex-col">
                    <span>Quality</span>
                    <span className="text-[10px] text-[var(--text-caption)]">ROE & D/E</span>
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-[var(--text-caption)] font-data italic">{formatZ(signal.quality_z)}</span>
                    <span className="text-[10px] text-[var(--text-caption)] font-data">ROE {formatRaw(signal.return_on_equity, true, false)} | D/E {formatRaw(signal.debt_equity)}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
