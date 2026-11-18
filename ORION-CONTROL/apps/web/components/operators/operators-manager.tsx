'use client';

import { Fragment, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  PASSWORD_MIN_LENGTH,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  formatDateTime,
  formatRelativeTime,
  type Permission,
  type Role,
} from '@orion/shared';
import type { UserDTO } from '@/lib/dto';
import { apiFetch } from '@/lib/client';
import { cn } from '@/lib/cn';
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

function overridesFor(
  role: Role,
  desired: Permission[],
): Array<{ permission: Permission; granted: boolean }> {
  const defaults = new Set<Permission>(ROLE_PERMISSIONS[role]);
  const wanted = new Set(desired);
  return PERMISSION_GROUPS.flatMap((group) => group.permissions)
    .filter((permission) => defaults.has(permission) !== wanted.has(permission))
    .map((permission) => ({ permission, granted: wanted.has(permission) }));
}

export function OperatorsManager({
  initialOperators,
  currentUserId,
  canManage,
}: {
  initialOperators: UserDTO[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [operators, setOperators] = useState(initialOperators);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; permissions: Permission[] } | null>(null);

  function replaceOperator(updated: UserDTO) {
    setOperators((current) =>
      current.map((operator) => (operator.id === updated.id ? updated : operator)),
    );
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setCreating(true);
    try {
      const result = await apiFetch<{ user: UserDTO }>('/api/operators', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      setOperators((current) => [...current, result.user]);
      setName('');
      setEmail('');
      setPassword('');
      setRole('viewer');
      setMessage(`Operator ${result.user.email} created. Share the temporary password securely.`);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function patchOperator(target: UserDTO, patch: Record<string, unknown>, note: string) {
    setBusyId(target.id);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{ user: UserDTO }>(`/api/operators/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      replaceOperator(result.user);
      setMessage(`${note} (${result.user.email})`);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(target: UserDTO) {
    if (!window.confirm(`Delete ${target.email}? Their account and overrides will be removed.`)) return;
    setBusyId(target.id);
    setError(null);
    try {
      await apiFetch(`/api/operators/${target.id}`, { method: 'DELETE' });
      setOperators((current) => current.filter((operator) => operator.id !== target.id));
      setMessage(`Operator ${target.email} deleted.`);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function savePermissions() {
    if (!editing) return;
    const target = operators.find((operator) => operator.id === editing.id);
    if (!target) return;
    setBusyId(target.id);
    setError(null);
    try {
      const result = await apiFetch<{ user: UserDTO }>(`/api/operators/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: overridesFor(target.role, editing.permissions) }),
      });
      replaceOperator(result.user);
      setEditing(null);
      setMessage(`Permissions updated for ${result.user.email}.`);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {(error || message) && (
        <Alert variant={error ? 'danger' : 'success'} title={error ? 'Action failed' : 'Done'}>
          {error ?? message}
        </Alert>
      )}

      {canManage && (
        <Card>
          <CardHeader
            title="Create operator"
            description="Accounts are created here only. There is no public registration."
            icon={<Plus size={16} />}
          />
          <CardBody>
            <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label htmlFor="op-name" className="label">
                  Name
                </label>
                <input
                  id="op-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="input"
                  placeholder="Jordan Vale"
                />
              </div>
              <div>
                <label htmlFor="op-email" className="label">
                  Email
                </label>
                <input
                  id="op-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input"
                  placeholder="jordan@example.com"
                />
              </div>
              <div>
                <label htmlFor="op-password" className="label">
                  Temporary password
                </label>
                <input
                  id="op-password"
                  type="text"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input mono"
                  placeholder={`${PASSWORD_MIN_LENGTH}+ characters`}
                />
              </div>
              <div>
                <label htmlFor="op-role" className="label">
                  Role
                </label>
                <select
                  id="op-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  className="input"
                >
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? <Spinner /> : <Plus size={15} />} Create operator
                </Button>
              </div>
            </form>
            <p className="mt-2 text-[11px] text-slate-600">
              Passwords are hashed with bcrypt. Share the temporary password over a secure channel and
              ask the operator to change it in Settings.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Operators"
          description={`${operators.length} account${operators.length === 1 ? '' : 's'}`}
          icon={<ShieldCheck size={16} />}
        />
        {operators.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={18} />} title="No operators" />
        ) : (
          <div className="table-wrap">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th>Permissions</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => {
                  const isSelf = operator.id === currentUserId;
                  const busy = busyId === operator.id;
                  const isEditing = editing?.id === operator.id;
                  return (
                    <Fragment key={operator.id}>
                      <tr>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-400/20 bg-brand-500/10 text-[11px] font-semibold text-brand-200">
                              {operator.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span>
                              <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-200">
                                {operator.name}
                                {isSelf && <Badge variant="brand">You</Badge>}
                              </span>
                              <span className="block text-[11px] text-slate-500">{operator.email}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          {canManage ? (
                            <select
                              value={operator.role}
                              disabled={busy || isSelf}
                              onChange={(event) =>
                                patchOperator(
                                  operator,
                                  { role: event.target.value },
                                  'Role updated',
                                )
                              }
                              className="input h-8 w-[130px] py-1 text-[12px]"
                              aria-label={`Role for ${operator.email}`}
                            >
                              {ROLES.map((value) => (
                                <option key={value} value={value}>
                                  {ROLE_LABELS[value]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant="neutral">{ROLE_LABELS[operator.role]}</Badge>
                          )}
                        </td>
                        <td>
                          <Badge variant={operator.status === 'active' ? 'success' : 'danger'} dot>
                            {operator.status}
                          </Badge>
                        </td>
                        <td className="text-[12px] text-slate-500">
                          {operator.lastLoginAt ? (
                            <span title={formatDateTime(operator.lastLoginAt)}>
                              {formatRelativeTime(operator.lastLoginAt)}
                            </span>
                          ) : (
                            'Never'
                          )}
                        </td>
                        <td className="mono text-[12px] text-slate-400">
                          {operator.permissions.length}
                          {operator.permissionOverrides.length > 0 && (
                            <span className="ml-1 text-[10px] text-brand-300">
                              ({operator.permissionOverrides.length} override)
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditing(
                                      isEditing
                                        ? null
                                        : { id: operator.id, permissions: operator.permissions },
                                    )
                                  }
                                  title="Edit permissions"
                                >
                                  <Pencil size={14} /> Permissions
                                </Button>
                                <Button
                                  variant={operator.status === 'active' ? 'ghost' : 'secondary'}
                                  size="sm"
                                  disabled={busy || isSelf}
                                  onClick={() =>
                                    patchOperator(
                                      operator,
                                      { status: operator.status === 'active' ? 'suspended' : 'active' },
                                      operator.status === 'active'
                                        ? 'Operator suspended'
                                        : 'Operator reactivated',
                                    )
                                  }
                                >
                                  {operator.status === 'active' ? 'Suspend' : 'Activate'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy || isSelf}
                                  onClick={() => handleDelete(operator)}
                                  title="Delete operator"
                                >
                                  <Trash2 size={14} className="text-signal-danger/80" />
                                </Button>
                              </>
                            )}
                            {!canManage && <span className="text-[11px] text-slate-600">View only</span>}
                          </div>
                        </td>
                      </tr>

                      {isEditing && editing && (
                        <tr key={`${operator.id}-permissions`}>
                          <td colSpan={6} className="bg-void-950/50">
                            <div className="rounded-lg border border-brand-500/20 bg-void-900/70 p-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-[12px] font-medium text-slate-200">
                                    Effective permissions for {operator.name}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    Base role {ROLE_LABELS[operator.role]} · changes are stored as
                                    overrides. Server-side checks always apply.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setEditing({
                                        id: operator.id,
                                        permissions: [...ROLE_PERMISSIONS[operator.role]],
                                      })
                                    }
                                  >
                                    Reset to role defaults
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditing(null)}
                                  >
                                    <X size={14} /> Close
                                  </Button>
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-3">
                                {PERMISSION_GROUPS.map((group) => (
                                  <fieldset key={group.label}>
                                    <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                      {group.label}
                                    </legend>
                                    <div className="space-y-1.5">
                                      {group.permissions.map((permission) => {
                                        const checked = editing.permissions.includes(permission);
                                        const isDefault = ROLE_PERMISSIONS[operator.role].includes(
                                          permission,
                                        );
                                        return (
                                          <label
                                            key={permission}
                                            className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-[12px] text-slate-300 hover:bg-white/5"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(event) =>
                                                setEditing({
                                                  id: operator.id,
                                                  permissions: event.target.checked
                                                    ? [...editing.permissions, permission]
                                                    : editing.permissions.filter(
                                                        (value) => value !== permission,
                                                      ),
                                                })
                                              }
                                              className="mt-0.5 h-3.5 w-3.5 rounded border-edge bg-void-850 accent-brand-500"
                                            />
                                            <span>
                                              {PERMISSION_LABELS[permission]}
                                              <span className="mono ml-1 block text-[10px] text-slate-600">
                                                {permission}
                                                {isDefault ? ' · default' : ''}
                                              </span>
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </fieldset>
                                ))}
                              </div>

                              <div className="mt-4 flex justify-end gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={savePermissions} disabled={busy}>
                                  {busy ? <Spinner /> : <KeyRound size={14} />} Save permissions
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] leading-relaxed text-slate-600">
        {canManage
          ? 'Suspending an operator invalidates their next request; existing sessions are re-checked against the database on every request.'
          : 'You have read-only access to operators. Managing accounts requires the operators.manage permission.'}
      </p>
    </div>
  );
}
