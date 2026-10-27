import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  colorScheme?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo';
  isSimulated?: boolean;
}

const colorMaps = {
  blue: {
    border: 'border-blue-500/20 hover:border-blue-500/40',
    bgIcon: 'bg-blue-500/10 text-blue-400',
    glow: 'group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  },
  emerald: {
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    bgIcon: 'bg-emerald-500/10 text-emerald-400',
    glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  },
  amber: {
    border: 'border-amber-500/20 hover:border-amber-500/40',
    bgIcon: 'bg-amber-500/10 text-amber-400',
    glow: 'group-hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  },
  rose: {
    border: 'border-rose-500/20 hover:border-rose-500/40',
    bgIcon: 'bg-rose-500/10 text-rose-400',
    glow: 'group-hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
  },
  indigo: {
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
    bgIcon: 'bg-indigo-500/10 text-indigo-400',
    glow: 'group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendUp,
  colorScheme = 'blue',
  isSimulated = false,
}) => {
  const scheme = colorMaps[colorScheme];

  return (
    <div
      className={`group relative glass-panel rounded-xl p-5 border transition-all duration-200 ${scheme.border} ${scheme.glow}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
            {isSimulated && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                Simulated
              </span>
            )}
          </div>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-white font-mono">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${scheme.bgIcon}`}>{icon}</div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`font-semibold ${
                trendUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trend}
            </span>
          )}
          {subtitle && <span className="text-slate-400">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
