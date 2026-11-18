import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Code2,
  Database,
  FileWarning,
  History,
  Radio,
} from 'lucide-react';
import {
  TASK_STATUS_HINTS,
  TASK_TYPE_MAP,
  describeTaskLifecycle,
  formatDateTime,
  formatDuration,
  formatNumber,
  statisticsSnapshotSchema,
} from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getTaskDetail } from '@/lib/tasks';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CodeBlock,
  EmptyState,
  MetaItem,
  PageHeader,
} from '@/components/ui/primitives';
import { TaskStatusBadge } from '@/components/tasks/task-status-badge';
import { TaskActions } from '@/components/tasks/task-actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Task ${id.slice(0, 8)}` };
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser('tasks.view');
  const { id } = await params;
  const detail = await getTaskDetail(id);
  if (!detail) notFound();

  const { task, results } = detail;
  const definition = TASK_TYPE_MAP[task.type] ?? null;
  const snapshot = statisticsSnapshotSchema.safeParse(task.parsedResponse);
  const hasParsed = task.parsedResponse !== null && task.parsedResponse !== undefined;

  return (
    <div>
      <Link
        href="/dashboard/tasks"
        className="mb-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft size={13} /> All tasks
      </Link>

      <PageHeader
        eyebrow={`Task · ${task.id.slice(0, 8)}`}
        title={definition?.label ?? task.type}
        description={definition?.description ?? 'Background task executed by the worker.'}
        actions={
          <div className="flex flex-col items-end gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskActions
              taskId={task.id}
              status={task.status}
              canManage={user.permissions.includes('tasks.manage')}
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="brand">{task.type}</Badge>
        <span className="mono text-[11px] text-slate-600">{task.id}</span>
        <span className="text-[11px] text-slate-500">{TASK_STATUS_HINTS[task.status]}</span>
      </div>

      {task.errorCode && (
        <Alert variant={task.status === 'failed' ? 'danger' : 'warning'} title={task.errorCode} className="mb-4">
          {task.errorMessage ?? 'No error message was recorded.'}
        </Alert>
      )}

      {snapshot.success && (
        <Card className="mb-4">
          <CardHeader
            title="Parsed snapshot"
            description={`${snapshot.data.servers.length} servers · ${snapshot.data.matches.length} matches · ${snapshot.data.players.length} players`}
            icon={<Database size={16} />}
            actions={
              <Badge variant={snapshot.data.source === 'retrieved' ? 'success' : 'warning'} dot>
                {snapshot.data.source === 'retrieved' ? 'Retrieved' : 'Simulated'}
              </Badge>
            }
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetaItem label="Players online" value={formatNumber(snapshot.data.summary.playersOnline)} />
              <MetaItem label="Active matches" value={formatNumber(snapshot.data.summary.activeMatches)} />
              <MetaItem
                label="Active servers"
                value={`${snapshot.data.summary.activeServers} / ${snapshot.data.summary.totalServers}`}
              />
              <MetaItem label="Health score" value={`${snapshot.data.summary.healthScore}%`} />
            </div>
            {snapshot.data.warnings.length > 0 && (
              <ul className="mt-4 space-y-1 text-[11px] text-signal-warning/90">
                {snapshot.data.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Link
                href="/dashboard/statistics"
                className="text-[11px] text-brand-300 hover:text-brand-200"
              >
                View in Server Statistics →
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Execution timeline"
              description={describeTaskLifecycle(task.status)}
              icon={<Clock size={16} />}
            />
            <CardBody>
              <ol className="space-y-4">
                {[
                  { label: 'Created', value: task.createdAt, detail: task.requestedByEmail ?? 'system' },
                  { label: 'Started', value: task.startedAt, detail: task.workerId ?? 'not claimed' },
                  { label: 'Completed', value: task.completedAt, detail: `${task.attempts} attempt(s)` },
                ].map((step, index, all) => (
                  <li key={step.label} className="relative flex gap-3">
                    <span className="flex flex-col items-center">
                      <span
                        className={
                          step.value
                            ? 'mt-1 h-2.5 w-2.5 rounded-full bg-brand-400 shadow-[0_0_8px_2px_rgba(167,139,250,0.35)]'
                            : 'mt-1 h-2.5 w-2.5 rounded-full border border-edge-bright bg-void-800'
                        }
                      />
                      {index < all.length - 1 && <span className="mt-1 h-10 w-px bg-edge" />}
                    </span>
                    <div className="min-w-0 pb-1">
                      <p className="text-[12px] font-medium text-slate-300">{step.label}</p>
                      <p className="mono mt-0.5 text-[11px] text-slate-500">
                        {step.value ? formatDateTime(step.value) : '—'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Worker submissions"
              description={`${results.length} recorded submission${results.length === 1 ? '' : 's'} (retries included)`}
              icon={<History size={16} />}
            />
            {results.length === 0 ? (
              <EmptyState
                icon={<History size={18} />}
                title="No submissions yet"
                description="The worker has not reported a result for this task."
              />
            ) : (
              <ul className="divide-y divide-edge/40">
                {results.map((result) => (
                  <li key={result.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            result.status === 'completed'
                              ? 'success'
                              : result.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                          dot
                        >
                          {result.status}
                        </Badge>
                        <span className="mono text-[11px] text-slate-500">{result.workerId}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="mono">{formatDuration(result.durationMs)}</span>
                        <span>{formatDateTime(result.createdAt)}</span>
                      </div>
                    </div>
                    {result.errorMessage && (
                      <p className="mt-2 text-[12px] text-signal-danger/90">
                        {result.errorCode}: {result.errorMessage}
                      </p>
                    )}
                    {result.rawResponse && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                          Raw response
                        </summary>
                        <CodeBlock className="mt-2">{result.rawResponse}</CodeBlock>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Raw response"
              description="Exactly what the worker reported, before parsing"
              icon={<Code2 size={16} />}
            />
            {task.rawResponse ? (
              <CardBody>
                <CodeBlock>{task.rawResponse}</CodeBlock>
              </CardBody>
            ) : (
              <EmptyState
                icon={<FileWarning size={18} />}
                title="No raw response stored"
                description="Raw responses exist for tasks that reached the worker."
              />
            )}
          </Card>

          {hasParsed && (
            <Card>
              <CardHeader
                title="Parsed response (JSON)"
                description="Normalised payload stored with the task"
                icon={<Code2 size={16} />}
              />
              <CardBody>
                <CodeBlock>{JSON.stringify(task.parsedResponse, null, 2)}</CodeBlock>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Task metadata" icon={<Radio size={16} />} />
            <CardBody className="grid grid-cols-2 gap-4">
              <MetaItem label="Status" value={task.status} />
              <MetaItem label="Attempts" value={`${task.attempts} / ${task.maxAttempts}`} />
              <MetaItem label="Duration" value={task.durationMs === null ? '—' : formatDuration(task.durationMs)} />
              <MetaItem label="Timeout" value={formatDuration(task.timeoutMs)} />
              <MetaItem label="Requested by" value={task.requestedByEmail ?? 'system'} />
              <MetaItem label="Worker" value={task.workerId ?? '—'} />
              <MetaItem label="Created" value={formatDateTime(task.createdAt)} />
              <MetaItem label="Expires" value={formatDateTime(task.expiresAt)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Request payload" description="Input provided when the task was created" />
            <CardBody>
              <CodeBlock>{JSON.stringify(task.payload, null, 2)}</CodeBlock>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Queue behaviour" />
            <CardBody className="space-y-2 text-[12px] leading-relaxed text-slate-500">
              <p>• Only the worker that claimed this task may submit its result.</p>
              <p>• Duplicate results are rejected once the task leaves the running state.</p>
              <p>• Failed attempts are retried automatically while attempts remain.</p>
              <p>• Queued tasks expire after 15 minutes without a claim.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
