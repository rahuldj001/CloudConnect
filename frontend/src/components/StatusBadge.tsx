import React from 'react';
import { AgentStatus, CasePriority, ContactStatus } from '../types';

interface BadgeProps {
  status?: AgentStatus | ContactStatus | CasePriority | string;
  type?: 'agent' | 'contact' | 'priority' | 'channel' | 'default';
  className?: string;
}

export const StatusBadge: React.FC<BadgeProps> = ({ status = 'default', type = 'default', className = '' }) => {
  const s = String(status).toLowerCase();

  // Agent availability badge
  if (type === 'agent' || ['available', 'busy', 'away', 'offline'].includes(s)) {
    switch (s) {
      case 'available':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Available
          </span>
        );
      case 'busy':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-500/30 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Busy
          </span>
        );
      case 'away':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-950/70 text-yellow-300 border border-yellow-500/30 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            Away
          </span>
        );
      case 'offline':
      default:
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900/80 text-slate-400 border border-slate-700/50 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Offline
          </span>
        );
    }
  }

  // Contact status badge
  if (type === 'contact' || ['queued', 'routing', 'connected', 'wrap_up', 'completed', 'abandoned', 'overflowed'].includes(s)) {
    switch (s) {
      case 'connected':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Connected
          </span>
        );
      case 'queued':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-500/30 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Queued
          </span>
        );
      case 'wrap_up':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-500/30 ${className}`}>
            Wrap Up
          </span>
        );
      case 'completed':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700 ${className}`}>
            Completed
          </span>
        );
      case 'overflowed':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-500/30 ${className}`}>
            Overflowed
          </span>
        );
      case 'abandoned':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-500/30 ${className}`}>
            Abandoned
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 ${className}`}>
            {s}
          </span>
        );
    }
  }

  // Priority badge
  if (type === 'priority' || ['critical', 'high', 'medium', 'low'].includes(s)) {
    switch (s) {
      case 'critical':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40 glow-rose ${className}`}>
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-500/30 ${className}`}>
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-500/30 ${className}`}>
            MEDIUM
          </span>
        );
      case 'low':
      default:
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/50 ${className}`}>
            LOW
          </span>
        );
    }
  }

  // Channel badge
  if (type === 'channel' || ['voice', 'chat'].includes(s)) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium ${
        s === 'voice' ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30' : 'bg-indigo-950/60 text-indigo-300 border border-indigo-500/30'
      } ${className}`}>
        {s === 'voice' ? '📞 Voice' : '💬 Chat'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 ${className}`}>
      {status}
    </span>
  );
};
