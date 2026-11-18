'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { PASSWORD_MIN_LENGTH } from '@orion/shared';
import { apiFetch } from '@/lib/client';
import { Alert, Button, Card, CardBody, CardHeader, Spinner } from '@/components/ui/primitives';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setPending(true);
    try {
      const result = await apiFetch<{ ok: boolean; note: string }>('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setMessage(`Password updated. ${result.note}`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Account security"
        description="Change your own password. Sessions expire after 8 hours."
        icon={<KeyRound size={16} />}
      />
      <CardBody>
        {(error || message) && (
          <Alert variant={error ? 'danger' : 'success'} className="mb-3">
            {error ?? message}
          </Alert>
        )}
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="current-password" className="label">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="label">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="label">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="input"
            />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : <KeyRound size={15} />} Update password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
