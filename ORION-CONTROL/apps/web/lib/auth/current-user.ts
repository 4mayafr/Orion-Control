/**
 * Current-operator resolution.
 *
 * Permissions are recomputed from the database on every request: the session
 * cookie only carries identity. Page helpers redirect; API helpers throw.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolvePermissions, type Permission, type Role } from '@orion/shared';
import { forbidden, unauthorized } from '../api';
import { getStore } from '../db/index';
import { SESSION_COOKIE, verifySessionToken } from './session';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'suspended';
  permissions: Permission[];
  createdAt: string;
  lastLoginAt: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const store = await getStore();
  const user = await store.getUserById(claims.sub);
  if (!user || user.status !== 'active') return null;

  const overrides = await store.getUserPermissions(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    permissions: resolvePermissions(user.role, overrides),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

/** Page guard: redirects unauthenticated visitors and missing permissions. */
export async function requirePageUser(permission?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (permission && !user.permissions.includes(permission)) {
    redirect(`/dashboard?denied=${encodeURIComponent(permission)}`);
  }
  return user;
}

/** API guard: throws 401/403 instead of redirecting. */
export async function requireApiUser(permission?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (permission && !user.permissions.includes(permission)) throw forbidden();
  return user;
}

export function can(user: Pick<CurrentUser, 'permissions'>, permission: Permission): boolean {
  return user.permissions.includes(permission);
}
