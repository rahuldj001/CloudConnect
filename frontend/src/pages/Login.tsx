import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Lock, Mail, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: 'admin' | 'supervisor' | 'agent') => {
    if (role === 'admin') {
      setEmail('admin@cloudconnect.dev');
      setPassword('AdminPass123!');
    } else if (role === 'supervisor') {
      setEmail('supervisor@cloudconnect.dev');
      setPassword('SupervisorPass123!');
    } else {
      setEmail('agent1@cloudconnect.dev');
      setPassword('AgentPass123!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(12,135,235,0.15),rgba(255,255,255,0))]">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-xl shadow-brand-500/20 mb-4">
            <Headphones className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CloudConnect</h1>
          <p className="text-sm text-slate-400 mt-1">Cloud Contact Center Implementation Platform</p>
        </div>

        {/* Login Glassmorphism Card */}
        <div className="glass-panel rounded-2xl p-8 border border-slate-800 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-2">Sign In</h2>
          <p className="text-xs text-slate-400 mb-6">
            Enter enterprise credentials or select a seeded demo role below.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@cloudconnect.dev"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </form>

          {/* Quick-Fill Seeded Demo Roles */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
              Seeded Demo Accounts (Local Dev)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 hover:border-brand-500/50 hover:bg-slate-800/60 transition-all text-center"
              >
                <ShieldCheck className="w-4 h-4 text-purple-400 mb-1" />
                <span className="text-xs font-semibold text-slate-200">Admin</span>
                <span className="text-[10px] text-slate-500">Alex Mercer</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('supervisor')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 hover:border-brand-500/50 hover:bg-slate-800/60 transition-all text-center"
              >
                <UserCheck className="w-4 h-4 text-blue-400 mb-1" />
                <span className="text-xs font-semibold text-slate-200">Supervisor</span>
                <span className="text-[10px] text-slate-500">Elena Vance</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('agent')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 hover:border-brand-500/50 hover:bg-slate-800/60 transition-all text-center"
              >
                <Users className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-xs font-semibold text-slate-200">Agent</span>
                <span className="text-[10px] text-slate-500">Sarah Connor</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-xs text-slate-500 mt-6">
          RBAC enforced on backend. Passwords hashed using bcrypt.
        </p>
      </div>
    </div>
  );
};
