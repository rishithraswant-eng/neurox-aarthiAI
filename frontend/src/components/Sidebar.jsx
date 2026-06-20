import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Star, BookOpen, Settings, Shield,
  TrendingUp, LogOut, Activity, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

import ModeSwitch from './longterm/ModeSwitch';

const getNavItems = (isLongTerm) => [
  { to: isLongTerm ? '/longterm' : '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/watchlist', icon: Star, label: 'Watchlist' },
  { to: '/portfolio', icon: BookOpen, label: 'Portfolio' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  ...(isLongTerm ? [{ to: '/longterm/methodology', icon: BookOpen, label: 'Methodology' }] : [])
];

const adminItems = [
  { to: '/admin', icon: Activity, label: 'Pipeline Health' },
  { to: '/admin/model', icon: TrendingUp, label: 'Model Accuracy' },
  { to: '/admin/retrain', icon: Shield, label: 'Retrain Approval' },
];

export default function Sidebar() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.user_metadata?.role === 'admin' || user?.email?.includes('admin');
  const isLongTerm = location.pathname.startsWith('/longterm');
  const activeNavItems = getNavItems(isLongTerm);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-[var(--bg-card)] flex flex-col h-screen border-r border-[var(--text-caption)]/20">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--text-caption)]/20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-[var(--text-caption)]/10 border border-[var(--text-caption)]/30 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[var(--color-positive)]" />
          </div>
          <div>
            <span className="font-display text-xl text-[var(--text-primary)]">Aarthi AI</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-2 overflow-y-auto">
        <ModeSwitch />
        <p className="font-label px-3 mb-4 mt-2">Main</p>
        {activeNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/longterm'}
            className={({ isActive }) =>
              `flex items-center space-x-3 w-full px-3 py-2.5 mx-3 max-w-[calc(100%-1.5rem)] rounded-lg font-label transition-colors ${
                isActive 
                  ? 'bg-[var(--text-caption)]/10 text-[var(--text-primary)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-caption)]/5'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="font-label px-3 mb-4 mt-8">Admin</p>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg font-label transition-colors ${
                    isActive 
                      ? 'bg-[var(--text-caption)]/10 text-[var(--text-primary)]' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-caption)]/5'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-[var(--text-caption)]/20">
        <div className="flex items-center space-x-3 px-3 py-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-[var(--text-caption)]/20 flex items-center justify-center font-display text-sm text-[var(--text-primary)] flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-data text-sm text-[var(--text-primary)] truncate">{user?.email || 'User'}</p>
            <p className="font-label">{isAdmin ? 'Admin' : 'Subscriber'}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg font-label text-[var(--text-secondary)] hover:text-[var(--color-negative)] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
