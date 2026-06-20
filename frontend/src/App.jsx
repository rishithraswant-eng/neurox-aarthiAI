import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Auth
import { useAuthStore } from './store/authStore';

// Public pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PerformancePage from './pages/PerformancePage';

// Layout
import Sidebar from './components/Sidebar';

// Subscriber pages
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import Watchlist from './pages/Watchlist';
import Portfolio from './pages/Portfolio';
import SettingsPage from './pages/SettingsPage';

// Admin pages
import PipelineHealth from './pages/admin/PipelineHealth';
import ModelAccuracy from './pages/admin/ModelAccuracy';
import RetrainApproval from './pages/admin/RetrainApproval';

// Long-Term pages
import LongTermDashboard from './pages/longterm/LongTermDashboard';
import LongTermStockDetail from './pages/longterm/LongTermStockDetail';
import Methodology from './pages/longterm/Methodology';

// ─── Auth Guard ────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// ─── App Shell (with Sidebar) ──────────────────────────────────────────────
function AppShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────
function AppInner() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid rgba(51,65,85,0.7)',
          },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/performance" element={<PerformancePage />} />

        {/* Subscriber — requires auth + sidebar */}
        <Route path="/dashboard" element={
          <RequireAuth>
            <AppShell><Dashboard /></AppShell>
          </RequireAuth>
        } />
        <Route path="/stock/:symbol" element={
          <RequireAuth>
            <AppShell><StockDetail /></AppShell>
          </RequireAuth>
        } />
        <Route path="/watchlist" element={
          <RequireAuth>
            <AppShell><Watchlist /></AppShell>
          </RequireAuth>
        } />
        <Route path="/portfolio" element={
          <RequireAuth>
            <AppShell><Portfolio /></AppShell>
          </RequireAuth>
        } />
        <Route path="/settings" element={
          <RequireAuth>
            <AppShell><SettingsPage /></AppShell>
          </RequireAuth>
        } />

        {/* Long-Term — requires auth + sidebar */}
        <Route path="/longterm" element={
          <RequireAuth>
            <AppShell><LongTermDashboard /></AppShell>
          </RequireAuth>
        } />
        <Route path="/longterm/stock/:symbol" element={
          <RequireAuth>
            <AppShell><LongTermStockDetail /></AppShell>
          </RequireAuth>
        } />
        <Route path="/longterm/methodology" element={
          <RequireAuth>
            <AppShell><Methodology /></AppShell>
          </RequireAuth>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <RequireAuth>
            <AppShell><PipelineHealth /></AppShell>
          </RequireAuth>
        } />
        <Route path="/admin/model" element={
          <RequireAuth>
            <AppShell><ModelAccuracy /></AppShell>
          </RequireAuth>
        } />
        <Route path="/admin/retrain" element={
          <RequireAuth>
            <AppShell><RetrainApproval /></AppShell>
          </RequireAuth>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
