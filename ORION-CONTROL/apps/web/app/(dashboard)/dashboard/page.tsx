import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Bot,
  ClipboardList,
  Database,
  Gauge,
  Radio,
  Server,
  Swords,
  Users,
} from 'lucide-react';
import {
  TASK_STATUS_LABELS,
  formatDuration,
  formatNumber,
  formatRelativeTime,
  isPermission,
  mergeSettings,
  PERMISSION_LABELS,
  TASK_TYPE_MAP,
  type TaskStatus,
} from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStorageInfo, getStore } from '@/lib/db';
import { getStatisticsOverview } from '@/lib/statistics';
import { getTaskSummary } from '@/lib/tasks';
import { getWorkerSummary } from '@/lib/worker-status';
import {
  Alert,
  buttonStyles,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  StatCard,
} from '@/components/ui/primitives';
import { SourceBadge } from '@/components/statistics/source-badge';
import { TaskStatusBadge } from '@/components/tasks/task-status-badge';
import { RetrieveButton } from '@/components/statistics/retrieve-button';
import { PlayersHistoryChart } from '@/components/charts/history-charts';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Overview' };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser('dashboard.view');
  const params = await searchParams;
  const denied = typeof params.denied === 'string' && isPermission(params.denied) ? params.denied : null;

  const store = await getStore();
  const [overview, taskSummary, worker, storage, logs, settingsRaw] = await Promise.all([
    getStatisticsOverview(30),
    getTaskSummary(),
    getWorkerSummary(),
    getStorageInfo(),
    store.listLogs({ limit: 6, offset: 0 }),
    store.getSettings(),
  ]);
  const settings = mergeSettings(settingsRaw);

  const snapshot = overview.latestSnapshot ?? overview.placeholder;
  const summary = snapshot?.summary ?? null;
  const workerOnline = worker.online;
  const primaryWorker = worker.primary;

  const previous = overview.history.length > 1 ? overview.history[overview.history.length - 2] : null;
  const playerDelta =
    summary && previous ? summary.playersOnline - previous.playersOnline : null;

  const totalTasks = Object.values(taskSummary.counts).reduce((total, value) => total + value, 0);
  const statusOrder: TaskStatus[] = ['completed', 'queued', 'running', 'failed', 'timed_out'];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Overview"
        description={
          <>
            Operational picture for your community. Statistics shown as{' '}
            <span className="text-signal-warning">Simulated</span> are placeholders and are never
            presented as genuine Orion Drift data.
          </>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <RetrieveButton
              canRetrieve={user.permissions.includes('statistics.retrieve')}
              workerOnline={workerOnline}
            />
            <Link href="/dashboard/tasks" className={buttonStyles('secondary')}>
              <ClipboardList size={15} /> Task manager
            </Link>
          </div>
        }
      />

      {denied && (
        <Alert variant="warning" title="Permission required" className="mb-4">
          You need the <span className="mono">{denied}</span> permission (
          {PERMISSION_LABELS[denied]}) to open that page. Ask an administrator to adjust your role or
          overrides.
        </Alert>
      )}

      {!workerOnline && (
        <Alert
          variant="warning"
          title="Worker offline"
          className="mb-4"
          action={
            <Link href="/dashboard/discord" className={buttonStyles('secondary', 'sm')}>
              Worker setup
            </Link>
          }
        >
          The website is fully available, but background tasks will queue until the Chromebook worker
          reconnects. Last heartbeat:{' '}
          <span className="mono">
            {primaryWorker ? formatRelativeTime(primaryWorker.lastHeartbeatAt) : 'never'}
          </span>
          .
        </Alert>
      )}

      {!overview.latest && overview.placeholder && (
        <Alert variant="info" title="Showing simulated placeholder statistics" className="mb-4">
          Nothing has been retrieved yet, so the dashboard is displaying clearly-labelled simulated
          data generated in memory. It is not stored and will be replaced by the first successful
          retrieval.
        </Alert>
      )}

      {overview.stale && (
        <Alert variant="warning" title="Statistics are stale" className="mb-4">
          The last snapshot is more than 24 hours old. Request a fresh retrieval.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Players online"
          value={summary ? formatNumber(summary.playersOnline) : '—'}
          hint={
            playerDelta === null
              ? 'From the latest statistics snapshot'
              : `${playerDelta >= 0 ? '+' : ''}${formatNumber(playerDelta)} vs previous snapshot`
          }
          icon={<Users size={18} />}
          tone="cyan"
          badge={<SourceBadge source={overview.source} />}
        />
        <StatCard
          label="Active matches"
          value={summary ? formatNumber(summary.activeMatches) : '—'}
          hint="Matches currently reported across servers"
          icon={<Swords size={18} />}
          tone="brand"
        />
        <StatCard
          label="Active servers"
          value={summary ? `${summary.activeServers} / ${summary.totalServers}` : '—'}
          hint="Servers not reporting offline"
          icon={<Server size={18} />}
          tone="neutral"
        />
        <StatCard
          label="Server health"
          value={summary ? `${summary.healthScore}%` : '—'}
          hint="Blended availability and capacity score"
          icon={<Gauge size={18} />}
          tone={summary && summary.healthScore >= 70 ? 'success' : 'warning'}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader
            title="Players online"
            description={`${overview.history.length} snapshots · last ${overview.lastRetrievedAt ? formatRelativeTime(overview.lastRetrievedAt) : 'never'}`}
            icon={<Activity size={16} />}
            actions={<SourceBadge source={overview.source} />}
          />
          <CardBody>
            <PlayersHistoryChart data={overview.history} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Worker connection"
            description="Chromebook task executor"
            icon={<Radio size={16} />}
            actions={
              <Badge variant={workerOnline ? 'success' : 'danger'} dot>
                {workerOnline ? 'Online' : 'Offline'}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Worker</dt>
                <dd className="mono mt-1 truncate text-[12px] text-slate-300">
                  {primaryWorker?.workerId ?? 'Never connected'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Heartbeat</dt>
                <dd className="mt-1 text-[12px] text-slate-300">
                  {primaryWorker ? formatRelativeTime(primaryWorker.lastHeartbeatAt) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Integration</dt>
                <dd className="mt-1 text-[12px] text-slate-300">
                  {settings.integrationMode === 'channel' ? 'Channel relay' : 'Simulated'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Discord</dt>
                <dd className="mt-1 text-[12px]">
                  {primaryWorker?.discordConnected === null || primaryWorker?.discordConnected === undefined ? (
                    <span className="text-slate-500">Unknown</span>
                  ) : primaryWorker.discordConnected ? (
                    <span className="text-signal-success">Connected</span>
                  ) : (
                    <span className="text-signal-danger">Disconnected</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="divider" />
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Queue depth</span>
              <span className="mono text-slate-300">
                {taskSummary.queued} queued · {taskSummary.running} running
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Offline threshold</span>
              <span className="mono text-slate-300">{worker.offlineAfterSeconds}s</span>
            </div>
            <Link
              href="/dashboard/discord"
              className={cn(buttonStyles('secondary', 'sm'), 'w-full justify-between')}
            >
              Discord integration <ArrowUpRight size={14} />
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent background tasks"
            description="Queued, running and finished work"
            icon={<ClipboardList size={16} />}
            actions={
              <Link href="/dashboard/tasks" className="text-[11px] text-brand-300 hover:text-brand-200">
                View all
              </Link>
            }
          />
          {taskSummary.recent.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={18} />}
              title="No tasks yet"
              description="Request a statistics retrieval to create the first background task."
            />
          ) : (
            <ul className="divide-y divide-edge/40">
              {taskSummary.recent.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-slate-200">
                        {TASK_TYPE_MAP[task.type]?.label ?? task.type}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600">
                        {task.requestedByEmail ?? 'system'} · {formatRelativeTime(task.createdAt)}
                        {task.durationMs !== null ? ` · ${formatDuration(task.durationMs)}` : ''}
                      </p>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            description="Latest audited operations"
            icon={<Activity size={16} />}
            actions={
              <Link href="/dashboard/logs" className="text-[11px] text-brand-300 hover:text-brand-200">
                Activity log
              </Link>
            }
          />
          {logs.items.length === 0 ? (
            <EmptyState icon={<Activity size={18} />} title="No activity recorded" />
          ) : (
            <ul className="divide-y divide-edge/40">
              {logs.items.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] leading-snug text-slate-300">{log.description}</p>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-600">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {log.actorEmail ?? 'worker / system'} · {log.action}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="System status" description="Component health" icon={<Database size={16} />} />
          <CardBody className="space-y-3">
            {[
              {
                label: 'Website',
                detail: 'Next.js runtime · rendering this page',
                tone: 'success' as const,
                value: 'Operational',
              },
              {
                label: 'Database',
                detail: `${storage.label} · ${storage.persistent ? 'persistent' : 'not persistent'}`,
                tone: storage.persistent ? ('success' as const) : ('warning' as const),
                value: storage.persistent ? 'Connected' : 'Local only',
              },
              {
                label: 'Worker',
                detail: primaryWorker
                  ? `${primaryWorker.workerId} · ${primaryWorker.platform ?? 'unknown platform'}`
                  : 'No worker has reported a heartbeat',
                tone: workerOnline ? ('success' as const) : ('danger' as const),
                value: workerOnline ? 'Online' : 'Offline',
              },
              {
                label: 'Discord integration',
                detail:
                  settings.integrationMode === 'channel'
                    ? 'Channel relay adapter'
                    : 'Simulated adapter (no Discord traffic)',
                tone: settings.integrationMode === 'channel' ? ('info' as const) : ('warning' as const),
                value: settings.integrationMode === 'channel' ? 'Channel relay' : 'Simulated',
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-edge/60 bg-void-850/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-300">{row.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-600">{row.detail}</p>
                </div>
                <Badge
                  variant={
                    row.tone === 'success'
                      ? 'success'
                      : row.tone === 'warning'
                        ? 'warning'
                        : row.tone === 'danger'
                          ? 'danger'
                          : 'cyan'
                  }
                  dot
                >
                  {row.value}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Task distribution"
            description={`${totalTasks} task${totalTasks === 1 ? '' : 's'} recorded`}
            icon={<Bot size={16} />}
          />
          <CardBody className="space-y-3">
            {statusOrder.map((status) => {
              const count = taskSummary.counts[status] ?? 0;
              const share = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="text-slate-400">{TASK_STATUS_LABELS[status]}</span>
                    <span className="mono text-slate-500">{count}</span>
                  </div>
                  <Progress
                    value={share}
                    tone={
                      status === 'completed'
                        ? 'success'
                        : status === 'running'
                          ? 'cyan'
                          : status === 'failed'
                            ? 'danger'
                            : status === 'timed_out'
                              ? 'warning'
                              : 'brand'
                    }
                  />
                </div>
              );
            })}
            <div className="divider" />
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Last successful retrieval</span>
              <span className="text-slate-300">
                {overview.latest ? formatRelativeTime(overview.latest.retrievedAt) : 'Never'}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
