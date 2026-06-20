import React from 'react';

export default function FactorBreakdown({ signal }) {
  const factors = [
    { name: 'MOM', label: 'Momentum', val: signal.momentum_z },
    { name: 'VOL', label: 'Low Vol', val: signal.lowvol_z },
    { name: 'DEL', label: 'Delivery', val: signal.delivery_z },
    { name: 'VAL', label: 'Value', val: signal.value_z },
    { name: 'QUA', label: 'Quality', val: signal.quality_z }
  ];

  return (
    <div className="flex space-x-1.5 w-full justify-center">
      {factors.map((f, i) => {
        const isNA = f.val === null || f.val === undefined;
        const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
        const z = isNA ? 0 : clamp(f.val, -3, 3);
        
        let colorClass = 'bg-[var(--text-caption)]/30';
        if (!isNA) {
          if (z >= 1) colorClass = 'bg-emerald-500';
          else if (z >= 0) colorClass = 'bg-emerald-400';
          else if (z >= -1) colorClass = 'bg-red-400';
          else colorClass = 'bg-red-500';
        }

        return (
          <div key={f.name} className="flex flex-col items-center group relative w-8">
            <div className="h-12 w-2 bg-[var(--text-caption)]/10 rounded-full flex items-end overflow-hidden mb-1 justify-center relative">
               {/* Positive Z goes up from center */}
               {!isNA && z > 0 && (
                 <div className={`absolute bottom-1/2 w-full rounded-t-sm ${colorClass}`} style={{ height: `${(z/3)*50}%` }} />
               )}
               {/* Negative Z goes down from center */}
               {!isNA && z < 0 && (
                 <div className={`absolute top-1/2 w-full rounded-b-sm ${colorClass}`} style={{ height: `${(-z/3)*50}%` }} />
               )}
               {/* N/A dot */}
               {isNA && (
                 <div className="absolute top-1/2 -mt-0.5 w-1 h-1 rounded-full bg-[var(--text-caption)]/30" />
               )}
               {/* Center line */}
               <div className="absolute top-1/2 -mt-px w-3 h-[2px] bg-[var(--text-caption)]/30 z-10" />
            </div>
            <span className="text-[9px] font-label text-[var(--text-caption)] tracking-wider">{f.name}</span>
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex flex-col items-center">
               <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap font-data">
                 {f.label}: {isNA ? 'N/A' : (f.val > 0 ? '+' : '') + f.val.toFixed(2)}z
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
