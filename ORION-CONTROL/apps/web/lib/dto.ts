/**
 * API serializers. Anything sent to the browser goes through here so secrets
 * (password hashes, API key hashes) can never leak by accident.
 */

import type { Permission } from '@orion/shared';
import type { ApiKeyRecord, UserRecord, WorkerStatusRecord } from './db/types';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRecord['role'];
  status: UserRecord['status'];
  createdAt: string;
  lastLoginAt: string | null;
  permissions: Permission[];
  permissionOverrides: Array<{ permission: Permission; granted: boolean }>;
}

export function toUserDTO(
  user: UserRecord,
  permissions: Permission[],
  overrides: Array<{ permission: Permission; granted: boolean }> = [],
): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    permissions,
    permissionOverrides: overrides,
  };
}

export interface ApiKeyDTO {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdByEmail: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function toApiKeyDTO(key: ApiKeyRecord): ApiKeyDTO {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    createdByEmail: key.createdByEmail,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
  };
}

export interface WorkerDTO {
  workerId: string;
  hostname: string | null;
  platform: string | null;
  version: string | null;
  status: WorkerStatusRecord['status'];
  online: boolean;
  heartbeatAgeSeconds: number | null;
  lastHeartbeatAt: string;
  currentTaskId: string | null;
  integrationMode: string | null;
  discordConnected: boolean | null;
}

export function toWorkerDTO(worker: WorkerStatusRecord, online: boolean, heartbeatAgeSeconds: number | null): WorkerDTO {
  return {
    workerId: worker.workerId,
    hostname: worker.hostname,
    platform: worker.platform,
    version: worker.version,
    status: worker.status,
    online,
    heartbeatAgeSeconds,
    lastHeartbeatAt: worker.lastHeartbeatAt,
    currentTaskId: worker.currentTaskId,
    integrationMode: worker.integrationMode,
    discordConnected: worker.discordConnected,
  };
}
