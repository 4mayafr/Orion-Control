/**
 * Worker API keys.
 *
 * Keys are generated with 256 bits of entropy, shown to the operator exactly
 * once, and stored only as SHA-256 hashes. A prefix is kept for identification
 * in the UI.
 */

import { createHash, randomBytes } from 'node:crypto';
import { WORKER_KEY_PREFIX, type ApiKeyScope } from '@orion/shared';
import { ApiError } from './api';
import { getStore } from './db/index';
import type { ApiKeyRecord, Store } from './db/types';

export interface GeneratedKey {
  raw: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): GeneratedKey {
  const raw = `${WORKER_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return {
    raw,
    prefix: raw.slice(0, WORKER_KEY_PREFIX.length + 8),
    hash: hashApiKey(raw),
  };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw.trim()).digest('hex');
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

export interface WorkerAuth {
  store: Store;
  key: ApiKeyRecord;
}

/**
 * Authenticate a worker request. Accepts only active keys with the `worker`
 * scope. Updates `last_used_at` so operators can spot stale credentials.
 */
export async function authenticateWorker(request: Request): Promise<WorkerAuth> {
  const raw = extractBearer(request);
  if (!raw) {
    throw new ApiError(401, 'WORKER_KEY_MISSING', 'Missing Authorization: Bearer <worker key> header.');
  }
  if (!raw.startsWith(WORKER_KEY_PREFIX)) {
    throw new ApiError(401, 'WORKER_KEY_INVALID', 'That is not an ORION CONTROL worker key.');
  }

  const store = await getStore();
  const key = await store.getApiKeyByHash(hashApiKey(raw));
  if (!key) {
    throw new ApiError(401, 'WORKER_KEY_INVALID', 'Unknown or rotated worker key.');
  }
  if (key.revokedAt) {
    throw new ApiError(401, 'WORKER_KEY_REVOKED', 'This worker key has been revoked.');
  }
  if (!key.scopes.includes('worker')) {
    throw new ApiError(403, 'WORKER_SCOPE_MISSING', 'This API key does not have the "worker" scope.');
  }

  await store.touchApiKey(key.id, new Date().toISOString());
  return { store, key };
}

export function hasScope(key: ApiKeyRecord, scope: ApiKeyScope): boolean {
  return key.scopes.includes(scope);
}
