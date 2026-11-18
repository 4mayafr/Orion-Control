/**
 * Activity logging. Logging must never break the operation it describes, so all
 * failures are swallowed after being reported to the server console.
 */

import { randomUUID } from 'node:crypto';
import { getStore } from './db/index';
import type { ActivityLogRecord } from './db/types';

export type ActivityCategory =
  | 'auth'
  | 'task'
  | 'statistics'
  | 'operator'
  | 'api_key'
  | 'settings'
  | 'worker'
  | 'system';

export interface ActivityInput {
  actor?: { id: string; email: string } | null;
  action: string;
  category: ActivityCategory;
  description: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    const store = await getStore();
    const log: ActivityLogRecord = {
      id: randomUUID(),
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      action: input.action,
      category: input.category,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      description: input.description,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
      createdAt: new Date().toISOString(),
    };
    await store.createLog(log);
  } catch (error) {
    console.error('[orion:activity] Failed to record activity:', error);
  }
}
