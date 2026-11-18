/**
 * Wire contracts between the website and the Chromebook worker.
 *
 * Both sides validate with these Zod schemas. The website rejects malformed
 * worker results; the worker rejects malformed claims. Requests are always
 * initiated by the worker (outbound HTTPS), so the Chromebook never needs an
 * inbound port.
 */

import { z } from 'zod';
import { TASK_TYPES, TASK_STATUSES } from './tasks.js';

export const WORKER_KEY_PREFIX = 'orion_wk_';
export const API_KEY_SCOPES = ['worker', 'read'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const API_KEY_SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  worker: 'Claim tasks, submit results and send heartbeats. Required by the Chromebook worker.',
  read: 'Reserved for read-only integrations. Does not grant access to worker endpoints.',
};

export const workerIdSchema = z
  .string()
  .trim()
  .min(1, 'workerId is required')
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/, 'workerId may only contain letters, numbers, dot, underscore, colon and dash');

export const claimRequestSchema = z.object({
  workerId: workerIdSchema,
  version: z.string().max(40).optional(),
  integrationMode: z.enum(['mock', 'channel']).optional(),
});
export type ClaimRequest = z.infer<typeof claimRequestSchema>;

export const heartbeatRequestSchema = z.object({
  workerId: workerIdSchema,
  hostname: z.string().max(200).optional(),
  platform: z.string().max(120).optional(),
  version: z.string().max(40).optional(),
  currentTaskId: z.string().uuid().nullish(),
  integrationMode: z.enum(['mock', 'channel']).optional(),
  discordConnected: z.boolean().optional(),
  /** Names (never raw IDs) so the Discord page can show what the worker resolved. */
  discordGuildName: z.string().max(200).optional(),
  discordChannelName: z.string().max(200).optional(),
  uptimeSeconds: z.number().int().min(0).max(10_000_000).optional(),
  note: z.string().max(300).optional(),
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;

export const workerResultSchema = z.object({
  workerId: workerIdSchema,
  status: z.enum(['completed', 'failed', 'timed_out']),
  durationMs: z.number().int().min(0).max(3_600_000),
  rawResponse: z.string().max(200_000).optional(),
  parsedResponse: z.unknown().optional(),
  error: z
    .object({
      code: z.string().min(1).max(80),
      message: z.string().min(1).max(2_000),
      retryable: z.boolean().optional(),
    })
    .optional(),
  note: z.string().max(500).optional(),
});
export type WorkerResultRequest = z.infer<typeof workerResultSchema>;

export interface WorkerTaskAssignment {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timeoutMs: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  expiresAt: string;
  requestedByEmail: string | null;
}

export interface ClaimResponse {
  task: WorkerTaskAssignment | null;
  /** Suggested wait before the next poll, in milliseconds. */
  pollAfterMs: number;
  /** Server time, so the worker can detect clock drift. */
  serverTime: string;
}

export interface WorkerHeartbeatResponse {
  ok: true;
  serverTime: string;
  /** Configured offline threshold, in seconds. */
  offlineAfterSeconds: number;
  /** Whether the platform has any queued work for this worker. */
  queuedTasks: number;
}

export const taskListQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  type: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const taskCreateSchema = z.object({
  type: z.enum(TASK_TYPES.map((definition) => definition.type) as [string, ...string[]]),
  payload: z.record(z.unknown()).optional(),
  /** Task is rejected if an identical active task already exists. */
  dedupe: z.boolean().optional(),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
