'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import {
  API_KEY_SCOPE_DESCRIPTIONS,
  API_KEY_SCOPES,
  formatDateTime,
  formatRelativeTime,
  type ApiKeyScope,
} from '@orion/shared';
import type { ApiKeyDTO } from '@/lib/dto';
import { apiFetch } from '@/lib/client';
import { cn } from '@/lib/cn';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CodeBlock,
  EmptyState,
  Spinner,
} from '@/components/ui/primitives';

interface CreateResponse {
  apiKey: ApiKeyDTO;
  secret: string;
  warning: string;
}

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeyDTO[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['worker']);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const result = await apiFetch<CreateResponse>('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      });
      setKeys((current) => [result.apiKey, ...current]);
      setSecret(result.secret);
      setCopied(false);
      setName('');
      setScopes(['worker']);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(key: ApiKeyDTO) {
    if (
      !window.confirm(
        `Revoke "${key.name}"? The worker using it will immediately lose access until a new key is configured.`,
      )
    ) {
      return;
    }
    setBusyId(key.id);
    setError(null);
    try {
      await apiFetch(`/api/api-keys/${key.id}`, { method: 'DELETE' });
      setKeys((current) =>
        current.map((item) =>
          item.id === key.id ? { ...item, revokedAt: new Date().toISOString() } : item,
        ),
      );
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_500);
    } catch {
      setError('Copying failed. Select the key manually and copy it.');
    }
  }

  function toggleScope(scope: ApiKeyScope) {
    setScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope],
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="danger" title="Action failed">
          {error}
        </Alert>
      )}

      {secret && (
        <Card className="border-brand-500/30">
          <CardHeader
            title="Copy this key now"
            description="It is stored only as a SHA-256 hash and cannot be displayed again."
            icon={<KeyRound size={16} />}
            actions={
              <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
                Dismiss
              </Button>
            }
          />
          <CardBody className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="mono flex-1 break-all rounded-lg border border-brand-400/30 bg-void-950/80 px-3 py-2.5 text-[12px] text-brand-100">
                {secret}
              </code>
              <Button variant="secondary" size="sm" onClick={copySecret}>
                {copied ? <Check size={14} className="text-signal-success" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy key'}
              </Button>
            </div>
            <div className="rounded-lg border border-edge/70 bg-void-950/60 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Worker configuration
              </p>
              <CodeBlock>{`ORION_API_URL=https://your-project.vercel.app
ORION_WORKER_KEY=${secret}
INTEGRATION_MODE=mock`}</CodeBlock>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Store it in <span className="mono text-slate-300">apps/worker/.env</span> on the
              Chromebook. Never put a worker key in a NEXT_PUBLIC_ variable or in browser code.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Create worker key"
          description="Keys authenticate the Chromebook worker. Rotate them if a machine is lost."
          icon={<Plus size={16} />}
        />
        <CardBody>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="key-name" className="label">
                Key name
              </label>
              <input
                id="key-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="Chromebook worker"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {API_KEY_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-[11px] transition-colors',
                      scopes.includes(scope)
                        ? 'border-brand-400/40 bg-brand-500/10 text-brand-100'
                        : 'border-edge/70 text-slate-400 hover:border-edge-bright',
                    )}
                    title={API_KEY_SCOPE_DESCRIPTIONS[scope]}
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="mt-0.5 h-3.5 w-3.5 accent-brand-500"
                    />
                    <span>
                      <span className="mono block">{scope}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {API_KEY_SCOPE_DESCRIPTIONS[scope]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating || scopes.length === 0} className="w-full md:w-auto">
                {creating ? <Spinner /> : <KeyRound size={15} />} Generate key
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="API keys"
          description={`${keys.filter((key) => !key.revokedAt).length} active · ${keys.length} total`}
          icon={<KeyRound size={16} />}
        />
        {keys.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={18} />}
            title="No API keys yet"
            description="Generate a worker-scoped key so the Chromebook can claim tasks."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Scopes</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <p className="text-[13px] text-slate-200">{key.name}</p>
                      <p className="text-[11px] text-slate-600">{key.createdByEmail ?? 'unknown'}</p>
                    </td>
                    <td className="mono text-[11px] text-slate-400">{key.prefix}…</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant={scope === 'worker' ? 'brand' : 'neutral'}>
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="text-[11px] text-slate-500">{formatDateTime(key.createdAt)}</td>
                    <td className="text-[11px] text-slate-500">
                      {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}
                    </td>
                    <td>
                      <Badge variant={key.revokedAt ? 'danger' : 'success'} dot>
                        {key.revokedAt ? 'Revoked' : 'Active'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {key.revokedAt ? (
                          <span className="text-[11px] text-slate-600">
                            {formatDateTime(key.revokedAt)}
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === key.id}
                            onClick={() => revoke(key)}
                          >
                            {busyId === key.id ? <Spinner /> : <Trash2 size={14} />} Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Alert variant="info" title="How worker authentication works">
        Worker requests carry <span className="mono">Authorization: Bearer &lt;key&gt;</span>. The server
        hashes the presented key and looks it up; revoked keys are rejected immediately. The plaintext
        key is never stored in the database, logs or frontend bundles.
      </Alert>
    </div>
  );
}
