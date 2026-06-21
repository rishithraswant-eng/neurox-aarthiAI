import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Disclaimer from '../components/Disclaimer';
import CursorTrackerMascot from '../components/CursorTrackerMascot';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const { signIn, ssoLogin }    = useAuthStore();
  const navigate                = useNavigate();
  const [searchParams]          = useSearchParams();

  // ── SSO via ?token=<jwt> ──────────────────────────────────────────────────
  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) return;

    setLoading(true);
    ssoLogin(token)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(err => {
        setError(err.message || 'Invalid SSO token');
        setLoading(false);
      });
  }, [searchParams, ssoLogin, navigate]);

  // ── Standard login ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-mesh min-h-screen flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[var(--color-highlight)]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-[var(--color-positive)]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-40 h-40 mb-2 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-highlight)]/10 to-transparent blur-xl pointer-events-none" />
            <CursorTrackerMascot className="w-full h-full" />
          </div>
          <h1 className="text-4xl font-display text-white tracking-wide">Aarthi AI</h1>
          <p className="text-[var(--color-highlight)] text-sm mt-1 uppercase tracking-widest font-label">Premium Heritage</p>
        </div>

        {/* Card */}
        <div className="flat-card p-6 border border-[var(--color-highlight)]/10">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error */}
            {error && (
              <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-field pl-9"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300">
              Sign up
            </Link>
          </p>

          {/* SSO Bypass — visible in dev mode or when running locally */}
          {import.meta.env.DEV && (
            <div className="mt-5 pt-4 border-t border-[var(--text-caption)]/20">
              <p className="text-xs text-slate-500 text-center mb-3 uppercase tracking-widest">Developer Access</p>
              <p className="text-xs text-slate-600 text-center mb-3">
                Navigate to <code className="text-amber-400/80">/login?token=&lt;HS256_JWT&gt;</code> to bypass login
              </p>
              <div className="flex items-center justify-center space-x-2 text-xs text-slate-500">
                <Zap className="w-3 h-3 text-[var(--color-highlight)]" />
                <span>JWT payload: <code className="text-slate-400">{"{ email: '...' }"}</code></span>
              </div>
              <div className="mt-2">
                <code className="block text-[10px] text-emerald-400/70 bg-slate-900/50 rounded p-2 text-center break-all">
                  Secret: my_super_secret_sso_key_for_aarthi_ai
                </code>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
