import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HonestyBanner({ detailed = false }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start space-x-3 mb-6">
      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-200 leading-relaxed space-y-3">
        <p>
          Aarthi AI validates every model against real historical outcomes before calling it production-ready — including this one. Our long-term ranking model's first backtest fold did not yet show a reliable edge, so we're displaying it as an experimental, in-progress signal rather than a finished recommendation.
        </p>
        {detailed ? (
          <p className="pl-3 border-l-2 border-amber-500/30">
            Our only available validation window (Sept 2025–Mar 2026) coincided with a sharp market correction — Nifty 50 fell 7.4% and India VIX spiked to 26.8 — a known difficult environment for momentum-based strategies, which assume recent trends continue. This doesn't mean the model would perform better in calmer conditions, but it does mean this single test wasn't a neutral one. We're showing this context for transparency, not as an excuse — with only one historical fold available, we can't yet test this model across multiple market regimes, which is exactly what would be needed before treating it as production-ready.
          </p>
        ) : (
          <p className="text-amber-200/80">
            <strong>Context:</strong> Our only validation window (Sept 2025–Mar 2026) coincided with a sharp 7.4% market correction—a notoriously difficult regime for momentum models. With only one fold available, we cannot yet test across multiple regimes. <Link to="/longterm/methodology" className="underline hover:text-amber-100 transition-colors">Read the full context</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
