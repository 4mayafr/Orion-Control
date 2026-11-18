'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PLAYER_STATUSES, formatDateTime, type PlayerStatus } from '@orion/shared';
import { Badge, EmptyState, type BadgeVariant } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

export interface PlayerRow {
  id: string;
  externalId: string;
  displayName: string;
  platform: string | null;
  rank: string | null;
  status: PlayerStatus;
  source: string;
  lastSeenAt: string | null;
}

const STATUS_BADGE: Record<PlayerStatus, BadgeVariant> = {
  online: 'success',
  'in-match': 'cyan',
  offline: 'neutral',
};

const STATUS_LABEL: Record<PlayerStatus, string> = {
  online: 'Online',
  'in-match': 'In match',
  offline: 'Offline',
};

export function PlayerDirectory({ players }: { players: PlayerRow[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PlayerStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return players.filter((player) => {
      if (status !== 'all' && player.status !== status) return false;
      if (!needle) return true;
      return (
        player.displayName.toLowerCase().includes(needle) ||
        player.externalId.toLowerCase().includes(needle) ||
        (player.rank ?? '').toLowerCase().includes(needle)
      );
    });
  }, [players, search, status]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-edge/60 px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, ID or rank…"
            className="input pl-9"
            aria-label="Search players"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(['all', ...PLAYER_STATUSES] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] transition-colors',
                status === value
                  ? 'border-brand-400/40 bg-brand-500/10 text-brand-200'
                  : 'border-edge/70 text-slate-500 hover:border-edge-bright hover:text-slate-300',
              )}
            >
              {value === 'all' ? 'All' : STATUS_LABEL[value]}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[11px] text-slate-600">
          {filtered.length} / {players.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={18} />}
          title="No matching players"
          description={
            players.length === 0
              ? 'No player directory has been collected yet. Retrieve statistics while the worker is online.'
              : 'Adjust the search or status filter.'
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Status</th>
                <th>Rank</th>
                <th>Platform</th>
                <th>Last seen</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player) => (
                <tr key={player.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-400/20 bg-brand-500/10 text-[11px] font-semibold text-brand-200">
                        {player.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium text-slate-200">
                          {player.displayName}
                        </span>
                        <span className="mono block text-[10px] text-slate-600">{player.externalId}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <Badge variant={STATUS_BADGE[player.status]} dot>
                      {STATUS_LABEL[player.status]}
                    </Badge>
                  </td>
                  <td className="text-[13px] text-slate-400">{player.rank ?? '—'}</td>
                  <td className="text-[13px] text-slate-400">{player.platform ?? '—'}</td>
                  <td className="text-[12px] text-slate-500">
                    {player.status === 'offline' ? formatDateTime(player.lastSeenAt) : 'Now'}
                  </td>
                  <td>
                    <Badge variant={player.source === 'retrieved' ? 'success' : 'warning'}>
                      {player.source === 'retrieved' ? 'Retrieved' : 'Simulated'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
