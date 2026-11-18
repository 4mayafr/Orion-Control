'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button, Spinner } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/client';
import type { TaskRecord } from '@/lib/db/types';

export function DiscordCheckButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
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

  async function run() {
    setPending(true);
    setMessage({ tone: 'info', text: 'Queueing channel diagnostics…' });
    try {
      const created = await apiFetch<{ task: TaskRecord; duplicate: boolean }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ type: 'discord.channel_check' }),
      });

      const deadline = Date.now() + 60_000;
      while (mounted.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        if (!mounted.current) return;
        const response = await apiFetch<{ task: TaskRecord }>(`/api/tasks/${created.task.id}`);
        const task = response.task;

        if (task.status === 'completed') {
          const parsed = task.parsedResponse as
            | { guildName?: string; channelName?: string; botTag?: string }
            | null;
          const detail =
            parsed && (parsed.guildName || parsed.channelName)
              ? ` Connected as ${parsed.botTag ?? 'bot'} to #${parsed.channelName ?? 'channel'} in ${
                  parsed.guildName ?? 'guild'
                }.`
              : ' Channel diagnostics completed.';
          setMessage({ tone: 'success', text: detail });
          setPending(false);
          router.refresh();
          return;
        }
        if (task.status === 'failed' || task.status === 'timed_out') {
          setMessage({
            tone: 'danger',
            text: `${task.errorCode ?? task.status}: ${task.errorMessage ?? 'No details.'}`,
          });
          setPending(false);
          router.refresh();
          return;
        }
        setMessage({ tone: 'info', text: `Diagnostics ${task.status}… waiting for the worker.` });
      }
      setPending(false);
      setMessage({
        tone: 'info',
        text: 'Diagnostics are taking longer than expected. Check Background Tasks for the result.',
      });
    } catch (caught) {
      setPending(false);
      setMessage({ tone: 'danger', text: (caught as Error).message });
    }
  }

  if (!enabled) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="secondary" size="sm" onClick={run} disabled={pending}>
        {pending ? <Spinner /> : <ShieldCheck size={14} />} Run channel diagnostics
      </Button>
      {message && (
        <span
          className={
            message.tone === 'danger'
              ? 'max-w-[280px] text-right text-[11px] text-signal-danger'
              : message.tone === 'success'
                ? 'max-w-[280px] text-right text-[11px] text-signal-success'
                : 'max-w-[280px] text-right text-[11px] text-slate-500'
          }
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
