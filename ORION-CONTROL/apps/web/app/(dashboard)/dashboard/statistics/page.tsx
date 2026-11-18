import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  Gauge,
  Info,
  Server,
  Swords,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  STAT_SOURCES,
  STAT_SOURCE_DESCRIPTIONS,
  STAT_SOURCE_LABELS,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  type MatchSnapshot,
  type ServerSnapshot,
} from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStatisticsOverview } from '@/lib/statistics';
import { getWorkerSummary } from '@/lib/worker-status';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  StatCard,
  buttonStyles,
} from '@/components/ui/primitives';
import { SourceBadge } from '@/components/statistics/source-badge';
import { RetrieveButton } from '@/components/statistics/retrieve-button';
import { MatchHistoryChart, PlayersHistoryChart } from '@/components/charts/history-charts';

export const metadata: Metadata = { title: 'Server Statistics' };

const SERVER_STATUS_VARIANT = {
  online: 'success',
  degraded: 'warning',
  offline: 'danger',
} as const;

export default async function StatisticsPage() {
  const user = await requirePageUser('statistics.view');
  const [overview, worker] = await Promise.all([getStatisticsOverview(30), getWorkerSummary()]);

  const snapshot = overview.latestSnapshot;
  const summary = snapshot?.summary ?? overview.placeholder?.summary ?? null;
  const servers: ServerSnapshot[] = snapshot?.servers ?? overview.placeholder?.servers ?? [];
  const matches: MatchSnapshot[] = snapshot?.matches ?? overview.placeholder?.matches ?? [];
  const displayedSource = snapshot ? overview.source : overview.placeholder ? 'simulated' : 'unavailable';

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Server statistics"
        description="Server availability, capacity and match activity. Every snapshot states where it came from — simulated, retrieved or unavailable."
        actions={
          <RetrieveButton
            canRetrieve={user.permissions.includes('statistics.retrieve')}
            workerOnline={worker.online}
          />
        }
      />

      {!overview.latest && overview.placeholder && (
        <Alert variant="warning" title="Simulated placeholder — not stored" className="mb-4">
          No retrieval has succeeded yet. The numbers below are generated placeholders and are not
          persisted. Use “Retrieve statistics” to queue a real retrieval task.
        </Alert>
      )}

      {!overview.latest && !overview.placeholder && (
        <Alert variant="info" title="No statistics available" className="mb-4">
          Nothing has been collected yet. Simulated fallback is disabled in settings, so ORION CONTROL
          shows an empty state rather than inventing numbers.
        </Alert>
      )}

      {overview.stale && (
        <Alert variant="warning" title="This snapshot is over 24 hours old" className="mb-4">
          Trigger a new retrieval to refresh the operational picture.
        </Alert>
      )}

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Data source</p>
              <div className="mt-1.5">
                <SourceBadge source={displayedSource} />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Last successful retrieval</p>
              <p className="mt-1 text-[13px] text-slate-300">
                {overview.lastRetrievedAt ? formatDateTime(overview.lastRetrievedAt) : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Snapshot task</p>
              <p className="mt-1 text-[13px] text-slate-300">
                {overview.latest?.taskId ? (
                  <Link
                    href={`/dashboard/tasks/${overview.latest.taskId}`}
                    className="mono text-brand-300 hover:text-brand-200"
                  >
                    {overview.latest.taskId.slice(0, 8)}…
                  </Link>
                ) : (
                  'Seeded / manual'
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Snapshots stored</p>
              <p className="mt-1 text-[13px] text-slate-300">{overview.history.length}</p>
            </div>
          </div>
          <Badge variant={worker.online ? 'success' : 'danger'} dot>
            Worker {worker.online ? 'online' : 'offline'}
          </Badge>
        </CardBody>
      </Card>

      {overview.notes && (
        <Alert variant={displayedSource === 'simulated' ? 'warning' : 'info'} className="mb-4">
          {overview.notes}
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Players online"
          value={summary ? formatNumber(summary.playersOnline) : '—'}
          hint="Total across reporting servers"
          icon={<Users size={18} />}
          tone="cyan"
        />
        <StatCard
          label="Active matches"
          value={summary ? formatNumber(summary.activeMatches) : '—'}
          hint="Live and lobby matches"
          icon={<Swords size={18} />}
          tone="brand"
        />
        <StatCard
          label="Active servers"
          value={summary ? `${summary.activeServers} / ${summary.totalServers}` : '—'}
          hint="Reporting online or degraded"
          icon={<Server size={18} />}
          tone="neutral"
        />
        <StatCard
          label="Health score"
          value={summary ? `${summary.healthScore}%` : '—'}
          hint="Availability weighted with capacity"
          icon={<Gauge size={18} />}
          tone={summary && summary.healthScore >= 70 ? 'success' : 'warning'}
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Server fleet"
          description="Per-server availability, population and latency"
          icon={<Server size={16} />}
          actions={<SourceBadge source={displayedSource} />}
        />
        {servers.length === 0 ? (
          <EmptyState
            icon={<Server size={18} />}
            title="No servers reported"
            description="A successful retrieval will populate this table."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Server</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th className="w-[180px]">Population</th>
                  <th>Matches</th>
                  <th>Latency</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => {
                  const fill = server.maxPlayers > 0 ? (server.playersOnline / server.maxPlayers) * 100 : 0;
                  return (
                    <tr key={server.id}>
                      <td>
                        <p className="text-[13px] font-medium text-slate-200">{server.name}</p>
                        <p className="mono text-[10px] text-slate-600">{server.id}</p>
                      </td>
                      <td className="text-[13px] text-slate-400">{server.region}</td>
                      <td>
                        <Badge variant={SERVER_STATUS_VARIANT[server.status]} dot>
                          {server.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="mono text-slate-300">
                            {server.playersOnline} / {server.maxPlayers}
                          </span>
                          <span className="text-slate-600">{Math.round(fill)}%</span>
                        </div>
                        <Progress
                          className="mt-1.5"
                          value={fill}
                          tone={server.status === 'offline' ? 'danger' : fill > 85 ? 'warning' : 'cyan'}
                        />
                      </td>
                      <td className="mono text-[13px] text-slate-300">{server.activeMatches}</td>
                      <td className="mono text-[13px] text-slate-400">
                        {server.latencyMs === undefined ? '—' : `${server.latencyMs} ms`}
                      </td>
                      <td className="mono text-[12px] text-slate-500">{server.version ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Player history"
            description="Players online per snapshot (UTC)"
            icon={<Activity size={16} />}
          />
          <CardBody>
            <PlayersHistoryChart data={overview.history} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Match activity"
            description="Active matches per snapshot (UTC)"
            icon={<BarChart3 size={16} />}
          />
          <CardBody>
            <MatchHistoryChart data={overview.history} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Match information"
          description={`${matches.length} matches in the latest snapshot`}
          icon={<Swords size={16} />}
        />
        {matches.length === 0 ? (
          <EmptyState
            icon={<Swords size={18} />}
            title="No match data"
            description="Matches appear here when the integration reports them."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Server</th>
                  <th>Mode</th>
                  <th>Map</th>
                  <th>Players</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 12).map((match) => (
                  <tr key={match.id}>
                    <td className="mono text-[11px] text-slate-400">{match.id}</td>
                    <td className="mono text-[11px] text-slate-500">{match.serverId}</td>
                    <td className="text-[13px] text-slate-300">{match.mode}</td>
                    <td className="text-[13px] text-slate-400">{match.map ?? '—'}</td>
                    <td className="mono text-[13px] text-slate-300">
                      {match.players}/{match.maxPlayers}
                    </td>
                    <td>
                      <Badge
                        variant={match.status === 'live' ? 'success' : match.status === 'lobby' ? 'cyan' : 'neutral'}
                      >
                        {match.status}
                      </Badge>
                    </td>
                    <td className="text-[11px] text-slate-500">{formatRelativeTime(match.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="How to read data provenance"
          description="ORION CONTROL never blurs simulated and genuine data"
          icon={<Info size={16} />}
        />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          {STAT_SOURCES.map((source) => (
            <div key={source} className="rounded-lg border border-edge/70 bg-void-850/40 p-4">
              <SourceBadge source={source} />
              <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                {STAT_SOURCE_DESCRIPTIONS[source]}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge/70 bg-void-900/60 px-4 py-3 text-[12px] text-slate-500">
        <span className="flex items-center gap-2">
          <Database size={14} className="text-brand-300" />
          Historical snapshots persist in your database and power the charts above.
        </span>
        <Link href="/dashboard/tasks" className={buttonStyles('secondary', 'sm')}>
          Inspect retrieval tasks
        </Link>
      </div>

      {displayedSource === 'unavailable' && (
        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-600">
          <TriangleAlert size={13} className="text-signal-warning" /> No data has ever been stored.
        </div>
      )}
      {displayedSource === 'retrieved' && (
        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-600">
          <CheckCircle2 size={13} className="text-signal-success" /> Latest snapshot was parsed from an
          authorised worker response.
        </div>
      )}
    </div>
  );
}
