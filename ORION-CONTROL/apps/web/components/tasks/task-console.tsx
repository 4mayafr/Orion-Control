'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, Radio } from 'lucide-react';
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  type TaskStatus,
  type TaskType,
} from '@orion/shared';
import { cn } from '@/lib/cn';
import { apiFetch } from '@/lib/client';
import { usePolling } from '@/lib/use-polling';
import type { TaskRecord } from '@/lib/db/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Spinner,
} from '@/components/ui/primitives';
import { TaskStatusBadge } from './task-status-badge';

export interface TaskListResponse {
  items: TaskRecord[];
  total: number;
  limit: number;
  offset: number;
  counts: Record<string, number>;
  permissions: { canCreate: boolean; canManage: boolean };
}

export interface TaskTypeOption {
  type: TaskType;
  label: string;
  description: string;
}

export function TaskConsole({
  initial,
  taskTypes,
  canCreate,
  workerOnline,
}: {
  initial: TaskListResponse;
  taskTypes: TaskTypeOption[];
  canCreate: boolean;
  workerOnline: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus | 'all'>('all');
  const [type, setType] = useState<string>(taskTypes[0]?.type ?? '');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const query = new URLSearchParams({ limit: '50', offset: '0' });
  if (status !== 'all') query.set('status', status);
  const { data, error, refresh, loading } = usePolling<TaskListResponse>(
    `/api/tasks?${query.toString()}`,
    5_000,
  );

  const view = data ?? initial;
  const selectedDefinition = taskTypes.find((option) => option.type === type);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    setCreating(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ task: TaskRecord; duplicate: boolean }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      setMessage({
        tone: 'success',
        text: result.duplicate
          ? 'An identical task is already queued or running, so the existing task was kept.'
          : 'Task queued. The worker will claim it on its next poll.',
      });
      refresh();
      router.refresh();
    } catch (caught) {
      setMessage({ tone: 'danger', text: (caught as Error).message });
    } finally {
      setCreating(false);
    }
  }

  const counts = view.counts ?? initial.counts;

  return (
    <div className="space-y-4">
      {canCreate && (
        <Card>
          <CardHeader
            title="Create a background task"
            description="Tasks are queued in the cloud and executed by your worker, never by the browser."
            icon={<Plus size={16} />}
            actions={
              <Badge variant={workerOnline ? 'success' : 'warning'} dot>
                {workerOnline ? 'Worker online' : 'Worker offline'}
              </Badge>
            }
          />
          <CardBody>
            <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="task-type" className="label">
                  Task type
                </label>
                <select
                  id="task-type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="input"
                >
                  {taskTypes.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedDefinition && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {selectedDefinition.description}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={creating || !type}>
                {creating ? <Spinner /> : <Plus size={15} />}
                {creating ? 'Queueing…' : 'Queue task'}
              </Button>
            </form>
            {message && (
              <p
                className={cn(
                  'mt-3 text-[12px]',
                  message.tone === 'success' ? 'text-signal-success' : 'text-signal-danger',
                )}
              >
                {message.text}
              </p>
            )}
            {!workerOnline && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-signal-warning">
                <Radio size={12} /> The task will stay queued until the worker reconnects (up to 15
                minutes, then it expires).
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Task queue"
          description={`${view.total} task${view.total === 1 ? '' : 's'} matching this filter · refreshes every 5 seconds`}
          icon={<ClipboardList size={16} />}
          actions={
            <button
              type="button"
              onClick={refresh}
              className="text-[11px] text-brand-300 hover:text-brand-200"
            >
              Refresh now
            </button>
          }
        />

        <div className="flex flex-wrap items-center gap-1 border-b border-edge/60 px-4 py-3">
          <button
            type="button"
            onClick={() => setStatus('all')}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px] transition-colors',
              status === 'all'
                ? 'border-brand-400/40 bg-brand-500/10 text-brand-200'
                : 'border-edge/70 text-slate-500 hover:border-edge-bright hover:text-slate-300',
            )}
          >
            All <span className="mono ml-1 text-slate-500">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
          </button>
          {TASK_STATUSES.map((value) => (
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
              {TASK_STATUS_LABELS[value]}{' '}
              <span className="mono ml-1 text-slate-500">{counts[value] ?? 0}</span>
            </button>
          ))}
          {loading && data === null && <Spinner className="ml-2 text-slate-600" />}
        </div>

        {error && (
          <div className="px-4 py-3">
            <Alert variant="danger" title="Could not refresh tasks">
              {error}
            </Alert>
          </div>
        )}

        {view.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={18} />}
            title="No tasks match this filter"
            description="Create a task or choose a different status."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Requested by</th>
                  <th>Created</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((task) => (
                  <tr key={task.id} className="cursor-pointer">
                    <td>
                      <Link href={`/dashboard/tasks/${task.id}`} className="block">
                        <span className="mono text-[11px] text-slate-500">{task.id.slice(0, 8)}…</span>
                        <span className="mt-1 block text-[13px] text-slate-200">{task.type}</span>
                        {task.status === 'running' && (
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-cyber-300">
                            running on {task.workerId ?? 'worker'}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/tasks/${task.id}`}>
                        <TaskStatusBadge status={task.status} />
                      </Link>
                    </td>
                    <td className="max-w-[180px] truncate text-[12px] text-slate-400">
                      {task.requestedByEmail ?? 'system'}
                    </td>
                    <td className="text-[12px] text-slate-500">
                      <span title={formatDateTime(task.createdAt)}>{formatRelativeTime(task.createdAt)}</span>
                    </td>
                    <td className="mono text-[12px] text-slate-400">
                      {task.durationMs === null ? '—' : formatDuration(task.durationMs)}
                    </td>
                    <td className="max-w-[220px] truncate text-[11px] text-signal-danger/80">
                      {task.errorCode ? `${task.errorCode}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
