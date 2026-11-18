'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Wrench } from 'lucide-react';
import {
  INTEGRATION_MODES,
  INTEGRATION_MODE_LABELS,
  type IntegrationMode,
  type SystemSettings,
} from '@orion/shared';
import { apiFetch } from '@/lib/client';
import { Alert, Button, Card, CardBody, CardHeader, Spinner } from '@/components/ui/primitives';

export function SettingsForm({ initial }: { initial: SystemSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<SystemSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{ settings: SystemSettings }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setForm(result.settings);
      setMessage('Settings saved. New tasks use the updated values.');
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runMaintenance() {
    setMaintenance(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{ timedOut: number; requeued: number }>(
        '/api/maintenance/reap',
        { method: 'POST' },
      );
      setMessage(
        `Maintenance complete: ${result.timedOut} task(s) timed out, ${result.requeued} requeued.`,
      );
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setMaintenance(false);
    }
  }

  return (
    <div className="space-y-4">
      {(error || message) && (
        <Alert variant={error ? 'danger' : 'success'} title={error ? 'Could not save' : 'Saved'}>
          {error ?? message}
        </Alert>
      )}

      <Card>
        <CardHeader
          title="System settings"
          description="Operational thresholds and integration behaviour. Applies to the website immediately; the worker reads its own INTEGRATION_MODE."
          icon={<Save size={16} />}
        />
        <CardBody>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="offline-after" className="label">
                  Worker offline threshold (seconds)
                </label>
                <input
                  id="offline-after"
                  type="number"
                  min={20}
                  max={3600}
                  value={form.workerOfflineAfterSeconds}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      workerOfflineAfterSeconds: Number(event.target.value),
                    }))
                  }
                  className="input mono"
                />
                <p className="mt-1 text-[11px] text-slate-600">
                  A worker is shown offline after this long without a heartbeat.
                </p>
              </div>

              <div>
                <label htmlFor="task-timeout" className="label">
                  Default task timeout (ms)
                </label>
                <input
                  id="task-timeout"
                  type="number"
                  min={5000}
                  max={600000}
                  step={1000}
                  value={form.defaultTaskTimeoutMs}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultTaskTimeoutMs: Number(event.target.value),
                    }))
                  }
                  className="input mono"
                />
                <p className="mt-1 text-[11px] text-slate-600">
                  Used when a task type does not define its own timeout.
                </p>
              </div>

              <div>
                <label htmlFor="retention" className="label">
                  Task retention (days)
                </label>
                <input
                  id="retention"
                  type="number"
                  min={1}
                  max={365}
                  value={form.taskRetentionDays}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      taskRetentionDays: Number(event.target.value),
                    }))
                  }
                  className="input mono"
                />
                <p className="mt-1 text-[11px] text-slate-600">
                  Operational target for pruning old tasks. No automatic deletion is performed.
                </p>
              </div>

              <div>
                <label htmlFor="integration-mode" className="label">
                  Integration mode
                </label>
                <select
                  id="integration-mode"
                  value={form.integrationMode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      integrationMode: event.target.value as IntegrationMode,
                    }))
                  }
                  className="input"
                >
                  {INTEGRATION_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {INTEGRATION_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-600">
                  Recorded here for visibility; the worker also needs a matching{' '}
                  <span className="mono">INTEGRATION_MODE</span>.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-edge/70 bg-void-850/40 px-3 py-2.5 text-[12px] text-slate-300">
              <input
                type="checkbox"
                checked={form.allowSimulatedFallback}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    allowSimulatedFallback: event.target.checked,
                  }))
                }
                className="mt-0.5 h-3.5 w-3.5 accent-brand-500"
              />
              <span>
                Show simulated placeholder statistics when nothing has been retrieved
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Placeholders are generated in memory and clearly labelled. Turning this off shows an
                  empty “unavailable” state instead.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : <Save size={15} />} Save settings
              </Button>
              <Button variant="secondary" size="sm" onClick={runMaintenance} disabled={maintenance}>
                {maintenance ? <Spinner /> : <Wrench size={14} />} Run task maintenance
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
