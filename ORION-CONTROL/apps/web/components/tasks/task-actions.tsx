'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, RotateCcw } from 'lucide-react';
import type { TaskStatus } from '@orion/shared';
import { Button, Spinner } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/client';

export function TaskActions({
  taskId,
  status,
  canManage,
}: {
  taskId: string;
  status: TaskStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'retry' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;
  if (status !== 'queued' && status !== 'completed' && status !== 'failed' && status !== 'timed_out') {
    return null;
  }

  async function run(action: 'retry' | 'cancel') {
    setPending(action);
    setError(null);
    try {
      await apiFetch(`/api/tasks/${taskId}/${action}`, { method: 'POST' });
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {status === 'queued' && (
          <Button variant="danger" size="sm" onClick={() => run('cancel')} disabled={pending !== null}>
            {pending === 'cancel' ? <Spinner /> : <Ban size={14} />} Cancel task
          </Button>
        )}
        {status !== 'queued' && (
          <Button variant="secondary" size="sm" onClick={() => run('retry')} disabled={pending !== null}>
            {pending === 'retry' ? <Spinner /> : <RotateCcw size={14} />} Retry
          </Button>
        )}
      </div>
      {error && <span className="max-w-[260px] text-right text-[11px] text-signal-danger">{error}</span>}
    </div>
  );
}
