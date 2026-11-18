'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface HistoryPoint {
  timestamp: string;
  playersOnline: number;
  activeMatches: number;
  activeServers: number;
  healthScore: number;
}

const GRID = '#1c2740';
const AXIS_TICK = { fill: '#64748b', fontSize: 10 } as const;
const TOOLTIP_STYLE = {
  backgroundColor: '#0c1222',
  border: '1px solid #1c2740',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
} as const;

function formatTick(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatTooltipLabel(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Recharts needs the browser for layout; render a skeleton until mounted. */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function PlayersHistoryChart({ data }: { data: HistoryPoint[] }) {
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-[260px] w-full animate-pulse rounded-lg bg-void-850/50" />;
  }
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-slate-600">
        No historical snapshots yet.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="players-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTick}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={46} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#94a3b8' }}
            labelFormatter={formatTooltipLabel}
            cursor={{ stroke: '#334155', strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone"
            dataKey="playersOnline"
            name="Players online"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#players-gradient)"
            activeDot={{ r: 4, fill: '#22d3ee', stroke: '#04060d', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MatchHistoryChart({ data }: { data: HistoryPoint[] }) {
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-[220px] w-full animate-pulse rounded-lg bg-void-850/50" />;
  }
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-slate-600">
        No historical snapshots yet.
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTick}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={46} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#94a3b8' }}
            labelFormatter={formatTooltipLabel}
            cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
          />
          <Bar
            dataKey="activeMatches"
            name="Active matches"
            fill="#8b5cf6"
            opacity={0.75}
            radius={[3, 3, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
