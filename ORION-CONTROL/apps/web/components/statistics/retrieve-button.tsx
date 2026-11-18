'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button, Spinner } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/client';
import type { TaskRecord } from '@/lib/db/types';

interface RefreshResponse {
  task: TaskRecord;
  duplicate: boolean;
  message: string;
}

export function RetrieveButton({
  canRetrieve,
  workerOnline,
}: {
  canRetrieve: boolean;
  workerOnline: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'danger'; text: string } | null>(
    null,
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function followTask(taskId: string) {
    const deadline = Date.now() + 120_000;
    while (mounted.current && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      if (!mounted.current) return;
      try {
        const response = await apiFetch<{ task: TaskRecord }>(`/api/tasks/${taskId}`);
        if (!mounted.current) return;
        const { task } = response;

        if (task.status === 'completed') {
          setTracking(false);
          setMessage({ tone: 'success', text: 'Retrieval completed. Statistics refreshed.' });
          router.refresh();
          return;
        }
        if (task.status === 'failed' || task.status === 'timed_out') {
          setTracking(false);
          setMessage({
            tone: 'danger',
            text: `Task ${task.status}. ${task.errorMessage ?? 'Check Background Tasks for details.'}`,
          });
          router.refresh();
          return;
        }
        setMessage({
          tone: 'info',
          text:
            task.status === 'queued'
              ? 'Queued. Waiting for the worker to claim it…'
              : 'Worker is executing the retrieval…',
        });
      } catch (error) {
        if (!mounted.current) return;
        setTracking(false);
        setMessage({ tone: 'danger', text: (error as Error).message });
        return;
      }
    }
    if (mounted.current) {
      setTracking(false);
      setMessage({
        tone: 'info',
        text: 'The task is taking longer than usual. Its final result will appear in Background Tasks.',
      });
    }
  }

  async function handleClick() {
    setCreating(true);
    setMessage(null);
    try {
      const result = await apiFetch<RefreshResponse>('/api/statistics/refresh', { method: 'POST' });
      setMessage({ tone: 'info', text: result.message });
      setCreating(false);
      setTracking(true);
      void followTask(result.task.id);
    } catch (error) {
      setCreating(false);
      setMessage({ tone: 'danger', text: (error as Error).message });
    }
  }

  if (!canRetrieve) {
    return (
      <p className="text-[11px] text-slate-600">
        Your role can view statistics but not request retrievals.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={handleClick} disabled={creating || tracking}>
        {creating || tracking ? <Spinner /> : <RefreshCw size={15} />}
        {creating ? 'Queueing…' : tracking ? 'Retrieving…' : 'Retrieve statistics'}
      </Button>
      {!workerOnline && !tracking && (
        <span className="text-[10px] uppercase tracking-wider text-signal-warning">
          Worker offline · task will queue
        </span>
      )}
      {message && (
        <span
          className={
            message.tone === 'danger'
              ? 'max-w-[260px] text-right text-[11px] text-signal-danger'
              : message.tone === 'success'
                ? 'max-w-[260px] text-right text-[11px] text-signal-success'
                : 'max-w-[260px] text-right text-[11px] text-slate-500'
          }
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
