'use client';

import { cn } from '@/lib/cn';
import { formatDateTime } from '@orion/shared';
import { usePolling } from '@/lib/use-polling';
import type { StatusResponse } from '@/lib/status-types';

export function WorkerIndicator({ initialOnline }: { initialOnline: boolean }) {
  const { data, error } = usePolling<StatusResponse>('/api/status', 15_000);
  const online = data ? data.worker.online : initialOnline;
  const hasError = Boolean(error) && !data;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]',
        hasError
          ? 'border-edge-bright/60 bg-void-900/70 text-slate-500'
          : online
            ? 'border-signal-success/25 bg-signal-success/[0.06] text-signal-success'
            : 'border-signal-danger/25 bg-signal-danger/[0.06] text-signal-danger',
      )}
      title={
        data?.worker.lastHeartbeatAt
          ? `Last heartbeat: ${formatDateTime(data.worker.lastHeartbeatAt)}`
          : 'Worker status unavailable'
      }
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          hasError
            ? 'bg-slate-600'
            : online
              ? 'animate-pulse-ring bg-signal-success'
              : 'bg-signal-danger',
        )}
      />
      <span className="font-medium">Worker</span>
      <span className="text-slate-400">{hasError ? 'unknown' : online ? 'online' : 'offline'}</span>
      {data && data.tasks.queued > 0 && (
        <span className="rounded-full bg-void-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          {data.tasks.queued} queued
        </span>
      )}
    </div>
  );
}
