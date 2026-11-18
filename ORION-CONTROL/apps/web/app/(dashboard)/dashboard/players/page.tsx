import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { formatDateTime } from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { getStatisticsOverview } from '@/lib/statistics';
import { Card, CardBody, CardHeader, PageHeader, StatCard } from '@/components/ui/primitives';
import { SourceBadge } from '@/components/statistics/source-badge';
import { PlayerDirectory, type PlayerRow } from '@/components/players/player-directory';

export const metadata: Metadata = { title: 'Player Directory' };

export default async function PlayersPage() {
  await requirePageUser('statistics.view');
  const store = await getStore();
  const [players, overview] = await Promise.all([
    store.listPlayers({ limit: 500, offset: 0 }),
    getStatisticsOverview(1),
  ]);

  const rows: PlayerRow[] = players.items.map((player) => ({
    id: player.id,
    externalId: player.externalId,
    displayName: player.displayName,
    platform: player.platform,
    rank: player.rank,
    status: player.status,
    source: player.source,
    lastSeenAt: player.lastSeenAt,
  }));

  const online = rows.filter((player) => player.status !== 'offline').length;
  const inMatch = rows.filter((player) => player.status === 'in-match').length;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Player directory"
        description="Players observed in collected snapshots. The directory is only as fresh as the latest successful retrieval."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Known players"
          value={players.total}
          hint="Unique players stored in the directory"
          icon={<Users size={18} />}
        />
        <StatCard
          label="Online now"
          value={online}
          hint="Online or currently in a match"
          icon={<Users size={18} />}
          tone="success"
        />
        <StatCard
          label="In match"
          value={inMatch}
          hint="Reported as in-match by the source"
          icon={<Users size={18} />}
          tone="cyan"
          badge={<SourceBadge source={overview.source} />}
        />
      </div>

      <Card>
        <CardHeader
          title="Directory"
          description={
            overview.lastRetrievedAt
              ? `Last collected ${formatDateTime(overview.lastRetrievedAt)}`
              : 'No player data collected yet'
          }
          icon={<Users size={16} />}
          actions={<SourceBadge source={overview.source} />}
        />
        <CardBody padded={false}>
          <PlayerDirectory players={rows} />
        </CardBody>
      </Card>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
        Player entries are replaced in place on each retrieval. Simulated entries are marked in the
        Source column and should not be treated as real community members.
      </p>
    </div>
  );
}
