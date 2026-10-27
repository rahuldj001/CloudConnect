import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronRight,
  Headphones,
  History,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  PhoneCall,
  Settings,
  ShieldAlert,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/agents', label: 'Agents', icon: Users },
    { to: '/queues', label: 'Queues', icon: ListOrdered },
    { to: '/simulator', label: 'Routing & Simulator', icon: Zap },
    { to: '/contacts', label: 'Contacts', icon: PhoneCall },
    { to: '/cases', label: 'Cases', icon: Headphones },
    { to: '/sla', label: 'SLA Monitor', icon: ShieldAlert },
    { to: '/audit', label: 'Audit Logs', icon: History, requireRole: ['admin', 'supervisor'] },
    { to: '/settings', label: 'Settings & Cloud', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-md">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">CloudConnect</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-semibold">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Contact Center Platform</p>
          </div>
        </div>

        {/* Live Stream Connectivity Indicator */}
        <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-mono text-slate-400">
              {isConnected ? 'Live WebSocket Active' : 'Connecting WS...'}
            </span>
          </div>
          <Activity className="w-3.5 h-3.5 text-slate-500" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.requireRole && !hasRole(...(item.requireRole as any))) {
              return null;
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30 shadow-sm shadow-brand-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 pr-2">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-medium text-slate-400 capitalize">{user?.role}</span>
                <span className="text-[10px] text-slate-500">•</span>
                <span className="text-xs text-slate-400 truncate">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-500">Contact Center</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-white font-medium capitalize">
              {window.location.pathname.replace('/', '') || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Clear Simulation Sandbox Tag */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-xs">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-slate-300 font-mono text-[11px]">
                Deterministic Simulator Engine (Zero AWS Cost)
              </span>
            </div>

            <button
              onClick={() => navigate('/simulator')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md shadow-brand-500/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Inbound Contact</span>
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-slate-950 to-slate-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
