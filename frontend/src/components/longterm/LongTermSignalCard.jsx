import React from 'react';
import { useNavigate } from 'react-router-dom';
import FactorBreakdown from './FactorBreakdown';
import { ChevronRight } from 'lucide-react';

export default function LongTermSignalCard({ signal }) {
  const navigate = useNavigate();

  const getExplanation = (signal) => {
    const factors = [
      { name: 'strong recent momentum', val: signal.momentum_z || 0 },
      { name: 'low volatility', val: signal.lowvol_z || 0 },
      { name: 'high delivery accumulation', val: signal.delivery_z || 0 }
    ];
    factors.sort((a, b) => b.val - a.val);
    
    const top = factors[0];
    const second = factors[1];
    
    if (top.val < 0) return "Ranked based on composite factor profile.";
    if (top.val >= 0.5 && second.val >= 0) return `Led by ${top.name} & ${second.name}.`;
    return `Led primarily by ${top.name}.`;
  };

  return (
    <div 
      onClick={() => navigate(`/longterm/stock/${signal.symbol}`)}
      className="bg-[#221d18] border border-[var(--text-caption)]/10 rounded-xl p-5 hover:border-[var(--color-positive)]/50 transition-all cursor-pointer group flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-display text-[var(--text-primary)] group-hover:text-[var(--color-positive)] transition-colors">
            {signal.symbol}
          </h3>
          {signal.rank_in_sector && (
             <p className="text-xs font-label text-[var(--text-secondary)] mt-1">Sector Rank: #{signal.rank_in_sector}</p>
          )}
        </div>
        <div className="flex flex-col items-end">
          <div className="bg-[var(--bg-highlight)] px-3 py-1 rounded-full text-sm font-data text-[var(--text-primary)] border border-[var(--text-caption)]/20 shadow-sm">
            #{signal.rank_in_universe}
          </div>
          <span className="text-[10px] text-[var(--text-caption)] mt-1 uppercase tracking-wider font-label">
            Ranking Score: {signal.display_score != null ? signal.display_score.toFixed(1) : 'N/A'}
          </span>
        </div>
      </div>

      <div className="mb-4 bg-emerald-500/5 border border-emerald-500/10 rounded px-3 py-2 text-xs text-emerald-200/80 font-data">
        <span className="font-semibold text-emerald-400">Why # {signal.rank_in_universe}: </span>
        {getExplanation(signal)}
      </div>

      <div className="flex-grow flex items-center justify-center py-2">
        <FactorBreakdown signal={signal} />
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--text-caption)]/10 flex justify-between items-center text-xs font-label text-[var(--text-caption)] group-hover:text-[var(--text-secondary)] transition-colors">
        <span>View full factor details</span>
        <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-[var(--color-positive)] transition-all" />
      </div>
    </div>
  );
}
