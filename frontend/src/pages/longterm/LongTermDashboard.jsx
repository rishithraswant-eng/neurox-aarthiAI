import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import HonestyBanner from '../../components/longterm/HonestyBanner';
import LongTermSignalCard from '../../components/longterm/LongTermSignalCard';
import { Activity } from 'lucide-react';

export default function LongTermDashboard() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true);
        // Find latest signal date
        const { data: dateData, error: dateError } = await supabase
          .from('longterm_signals')
          .select('signal_date')
          .order('signal_date', { ascending: false })
          .limit(1);

        if (dateError) throw dateError;
        if (!dateData || dateData.length === 0) {
          setLoading(false);
          return;
        }

        const latestDate = dateData[0].signal_date;

        // Fetch passing signals for that date
        const { data, error } = await supabase
          .from('longterm_signals')
          .select('*')
          .eq('signal_date', latestDate)
          .eq('hard_gate_passed', true)
          .order('rank_in_universe', { ascending: true });

        if (error) throw error;
        
        const validSignals = data || [];
        if (validSignals.length > 0) {
          const scores = validSignals.map(s => s.composite_score).filter(s => s != null);
          const maxScore = Math.max(...scores);
          const minScore = Math.min(...scores);
          
          validSignals.forEach(s => {
            if (s.composite_score != null) {
              s.display_score = maxScore === minScore ? 100 : ((s.composite_score - minScore) / (maxScore - minScore)) * 100;
            }
          });
        }
        
        setSignals(validSignals);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSignals();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-display text-[var(--text-primary)] mb-2">Long-Term (60-Day) Rankings</h1>
        <p className="text-[var(--text-secondary)] font-data text-sm">
          Aarthi AI Experimental Model
        </p>
        <p className="mt-4 text-[var(--text-primary)] text-sm leading-relaxed bg-[var(--bg-card)] p-4 rounded-lg border border-[var(--text-caption)]/20 shadow-sm">
          Long-Term Mode ranks all Nifty 500 stocks against each other using three factors that tend to matter over a 60-trading-day (about 3-month) horizon: price Momentum, low recent Volatility, and Institutional Delivery activity (a proxy for genuine accumulation vs. speculative trading). This is fundamentally different from Short-Term Mode, which predicts a specific 5-day price forecast for one stock using a quantile regression model trained on technicals, sentiment, and fundamentals. Long-Term Mode doesn't predict a price — it ranks stocks relative to each other, answering 'which stocks look strongest on these three factors right now,' not 'what will this stock's price be.'
        </p>
      </div>

      <HonestyBanner />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Activity className="w-8 h-8 text-[var(--color-positive)] animate-pulse" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          No long-term signals available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {signals.map(signal => (
            <LongTermSignalCard key={signal.symbol} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}
