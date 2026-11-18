'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { PASSWORD_MIN_LENGTH } from '@orion/shared';
import { Button, Spinner } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/client';

export function SetupForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Choose a password with at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setPending(true);
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ token, name, email, password }),
      });
      router.replace('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Setup failed.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-signal-danger/30 bg-signal-danger/[0.07] px-3 py-2.5 text-[13px] text-signal-danger"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="token" className="label">
          Setup token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="input mono"
          placeholder="INITIAL_ADMIN_SETUP_TOKEN"
        />
        <p className="mt-1.5 text-[11px] text-slate-600">
          The value of <span className="mono">INITIAL_ADMIN_SETUP_TOKEN</span> from your environment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">
            Display name
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input"
            placeholder="Alex Chen"
          />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input"
            placeholder="admin@example.com"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
            placeholder={`${PASSWORD_MIN_LENGTH}+ characters`}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="input"
            placeholder="Repeat password"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : <ShieldCheck size={15} />}
        {pending ? 'Creating administrator…' : 'Create administrator account'}
      </Button>

      <p className="text-[11px] leading-relaxed text-slate-600">
        Setup is only available while no operator accounts exist. The first account always receives the
        Administrator role.
      </p>
    </form>
  );
}
