import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ModeSwitch() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isLongTerm = location.pathname.startsWith('/longterm');

  return (
    <div className="flex bg-[var(--bg-card)] rounded-lg p-1 mb-6 border border-[var(--text-caption)]/20 mx-3">
      <button
        onClick={() => {
          if (isLongTerm) {
            if (location.pathname.startsWith('/longterm/stock/')) {
              navigate(location.pathname.replace('/longterm/stock/', '/stock/'));
            } else {
              navigate('/dashboard');
            }
          }
        }}
        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${!isLongTerm ? 'bg-[var(--text-caption)]/10 text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-caption)]/5'}`}
      >
        Short-Term
        <span className="block text-[10px] font-normal opacity-70">5-Day</span>
      </button>
      <button
        onClick={() => {
          if (!isLongTerm) {
            if (location.pathname.startsWith('/stock/')) {
              navigate(location.pathname.replace('/stock/', '/longterm/stock/'));
            } else {
              navigate('/longterm');
            }
          }
        }}
        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${isLongTerm ? 'bg-[var(--text-caption)]/10 text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-caption)]/5'}`}
      >
        Long-Term
        <span className="block text-[10px] font-normal opacity-70">60-Day</span>
      </button>
    </div>
  );
}
