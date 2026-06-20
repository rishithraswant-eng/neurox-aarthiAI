import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function HonestyBanner() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start space-x-3 mb-6">
      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-200 leading-relaxed">
        Aarthi AI validates every model against real historical outcomes before calling it production-ready — including this one. Our long-term ranking model's first backtest fold did not yet show a reliable edge, so we're displaying it as an experimental, in-progress signal rather than a finished recommendation. This is the same validation discipline used across the entire platform: every number you see here has been checked against real data, and we tell you plainly when something hasn't passed that check yet.
      </p>
    </div>
  );
}
