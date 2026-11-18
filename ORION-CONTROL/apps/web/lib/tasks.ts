/**
 * Background task service.
 *
 * Lifecycle:
 *   queued -> running -> completed | failed | timed_out
 *
 * Guarantees:
 *   - A task is only accepted from the worker that claimed it.
 *   - Results are only accepted while the task is running (double submission is
 *     rejected, so a task can never be executed twice through this endpoint).
 *   - Stale queued/running tasks are expired, and failed attempts are retried up
 *     to maxAttempts.
 *   - Simulated data is stored with source = 'simulated', never as 'retrieved'.
 */

import { randomUUID } from 'node:crypto';
import {
  TASK_TYPE_MAP,
  mergeSettings,
  playerDirectorySnapshotSchema,
  statisticsSnapshotSchema,
  type TaskType,
  type WorkerResultRequest,
} from '@orion/shared';
import { recordActivity } from './activity';
import { ApiError } from './api';
import { getStore } from './db/index';
import type { Store, TaskRecord, TaskResultRecord } from './db/types';
import type { WorkerTaskAssignment } from '@orion/shared';

/** How long a queued task may wait for a worker before it expires. */
export const QUEUED_TASK_TTL_MS = 15 * 60 * 1000;

export interface TaskActor {
  id: string;
  email: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

export async function reapTasks(store?: Store): Promise<{ timedOut: number; requeued: number }> {
  const db = store ?? (await getStore());
  const result = await db.expireStaleTasks(new Date().toISOString());
  if (result.timedOut > 0 || result.requeued > 0) {
    console.info(
      `[orion:tasks] Reaper: ${result.timedOut} timed out, ${result.requeued} requeued.`,
    );
  }
  return result;
}

export interface CreateTaskResult {
  task: TaskRecord;
  duplicate: boolean;
}

export async function createTask(input: {
  type: TaskType;
  actor: TaskActor | null;
  payload?: Record<string, unknown>;
  dedupe?: boolean;
}): Promise<CreateTaskResult> {
  const definition = TASK_TYPE_MAP[input.type];
  if (!definition) {
    throw new ApiError(400, 'UNKNOWN_TASK_TYPE', `Unknown task type "${input.type}".`);
  }

  const store = await getStore();
  const dedupeKey = input.dedupe === false ? null : `active:${input.type}`;

  if (dedupeKey) {
    const existing = await store.findActiveTaskByDedupe(dedupeKey);
    if (existing) return { task: existing, duplicate: true };
  }

  const now = new Date();
  const task: TaskRecord = {
    id: randomUUID(),
    type: input.type,
    status: 'queued',
    requestedBy: input.actor?.id ?? null,
    requestedByEmail: input.actor?.email ?? null,
    payload: input.payload ?? {},
    dedupeKey,
    priority: 0,
    attempts: 0,
    maxAttempts: definition.maxAttempts,
    timeoutMs: definition.defaultTimeoutMs,
    workerId: null,
    createdAt: now.toISOString(),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    expiresAt: new Date(now.getTime() + QUEUED_TASK_TTL_MS).toISOString(),
    errorCode: null,
    errorMessage: null,
    rawResponse: null,
    parsedResponse: null,
  };

  try {
    await store.createTask(task);
  } catch (error) {
    // Two operators can race past findActiveTaskByDedupe; the partial unique
    // index is the real guard.
    if (isUniqueViolation(error) && dedupeKey) {
      const existing = await store.findActiveTaskByDedupe(dedupeKey);
      if (existing) return { task: existing, duplicate: true };
    }
    throw error;
  }

  await recordActivity({
    actor: input.actor,
    action: 'task.created',
    category: 'task',
    description: `${definition.label} requested${input.actor ? ` by ${input.actor.email}` : ''}.`,
    targetType: 'background_task',
    targetId: task.id,
    metadata: { type: task.type, timeoutMs: task.timeoutMs },
  });

  return { task, duplicate: false };
}

export async function claimNextTask(workerId: string): Promise<WorkerTaskAssignment | null> {
  const store = await getStore();
  await reapTasks(store);
  const now = new Date().toISOString();
  const task = await store.claimNextTask(workerId, now);
  if (!task) return null;

  return {
    id: task.id,
    type: task.type,
    payload: task.payload,
    timeoutMs: task.timeoutMs,
    attempts: task.attempts,
    maxAttempts: task.maxAttempts,
    createdAt: task.createdAt,
    expiresAt: task.expiresAt,
    requestedByEmail: task.requestedByEmail,
  };
}

interface IngestionOutcome {
  warnings: string[];
  failure?: { code: string; message: string };
}

async function ingestCompletedResult(
  store: Store,
  task: TaskRecord,
  result: WorkerResultRequest,
  now: string,
): Promise<IngestionOutcome> {
  if (task.type === 'statistics.retrieve') {
    const parsed = statisticsSnapshotSchema.safeParse(result.parsedResponse);
    if (!parsed.success) {
      return {
        warnings: [],
        failure: {
          code: 'UNPARSED_RESPONSE',
          message:
            'The worker reported success, but the parsed statistics did not match the expected schema. The raw response is preserved for inspection.',
        },
      };
    }
    const snapshot = parsed.data;
    await store.createStatistics({
      id: randomUUID(),
      source: snapshot.source,
      retrievedAt: snapshot.retrievedAt,
      taskId: task.id,
      createdBy: task.requestedByEmail,
      summary: snapshot.summary,
      servers: snapshot.servers,
      matches: snapshot.matches,
      players: snapshot.players,
      notes: snapshot.notes ?? null,
      warnings: snapshot.warnings,
      createdAt: now,
    });
    await store.upsertPlayers(
      snapshot.players.map((player) => ({
        id: randomUUID(),
        externalId: player.externalId,
        displayName: player.displayName,
        platform: player.platform ?? null,
        rank: player.rank ?? null,
        status: player.status,
        source: snapshot.source,
        lastSeenAt: player.lastSeenAt ?? null,
        updatedAt: now,
      })),
    );
    return { warnings: snapshot.warnings };
  }

  if (task.type === 'players.retrieve') {
    const parsed = playerDirectorySnapshotSchema.safeParse(result.parsedResponse);
    if (!parsed.success) {
      return {
        warnings: [],
        failure: {
          code: 'UNPARSED_RESPONSE',
          message:
            'The worker reported success, but the player directory did not match the expected schema. The raw response is preserved for inspection.',
        },
      };
    }
    await store.upsertPlayers(
      parsed.data.players.map((player) => ({
        id: randomUUID(),
        externalId: player.externalId,
        displayName: player.displayName,
        platform: player.platform ?? null,
        rank: player.rank ?? null,
        status: player.status,
        source: parsed.data.source,
        lastSeenAt: player.lastSeenAt ?? null,
        updatedAt: now,
      })),
    );
    return { warnings: parsed.data.notes ? [parsed.data.notes] : [] };
  }

  return { warnings: [] };
}

export interface SubmitResultOutcome {
  task: TaskRecord;
  warnings: string[];
  retried: boolean;
}

export async function submitTaskResult(
  taskId: string,
  workerId: string,
  result: WorkerResultRequest,
): Promise<SubmitResultOutcome> {
  const store = await getStore();
  const task = await store.getTask(taskId);

  if (!task) {
    throw new ApiError(404, 'TASK_NOT_FOUND', 'That task does not exist.');
  }
  if (task.workerId !== workerId) {
    throw new ApiError(
      409,
      'TASK_OWNERSHIP_MISMATCH',
      'This task is claimed by a different worker. Results were rejected.',
    );
  }
  if (task.status !== 'running') {
    throw new ApiError(
      409,
      'TASK_NOT_RUNNING',
      `Task is ${task.status}. Results are only accepted while it is running.`,
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();

  let effectiveStatus: TaskResultRecord['status'] = result.status;
  let errorCode = result.error?.code ?? null;
  let errorMessage = result.error?.message ?? null;
  let warnings: string[] = [];

  if (effectiveStatus === 'completed') {
    const ingestion = await ingestCompletedResult(store, task, result, nowIso);
    warnings = ingestion.warnings;
    if (ingestion.failure) {
      effectiveStatus = 'failed';
      errorCode = ingestion.failure.code;
      errorMessage = ingestion.failure.message;
    }
  }

  const durationMs =
    effectiveStatus === 'timed_out' ? task.timeoutMs : Math.max(0, Math.round(result.durationMs));

  await store.createTaskResult({
    id: randomUUID(),
    taskId,
    workerId,
    status: effectiveStatus,
    durationMs,
    rawResponse: result.rawResponse ?? null,
    parsedResponse: result.parsedResponse ?? null,
    errorCode,
    errorMessage,
    createdAt: nowIso,
  });

  const retryable = result.error?.retryable !== false;
  const retried =
    effectiveStatus === 'failed' && retryable && task.attempts < task.maxAttempts;

  const updated = await store.updateTask(
    taskId,
    retried
      ? {
          status: 'queued',
          workerId: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
          expiresAt: new Date(now.getTime() + QUEUED_TASK_TTL_MS).toISOString(),
          errorCode,
          errorMessage: `${errorMessage ?? 'The task failed.'} Retry queued (attempt ${
            task.attempts + 1
          } of ${task.maxAttempts}).`,
          rawResponse: result.rawResponse ?? null,
          parsedResponse: result.parsedResponse ?? null,
        }
      : {
          status: effectiveStatus,
          completedAt: nowIso,
          durationMs,
          errorCode,
          errorMessage,
          rawResponse: result.rawResponse ?? null,
          parsedResponse: result.parsedResponse ?? null,
        },
  );

  await recordActivity({
    actor: null,
    action: `task.${effectiveStatus}`,
    category: 'task',
    description: `Worker ${workerId} ${retried ? 'failed (retry queued)' : effectiveStatus} ${
      TASK_TYPE_MAP[task.type]?.label ?? task.type
    }.`,
    targetType: 'background_task',
    targetId: taskId,
    metadata: { workerId, durationMs, errorCode, retried },
  });

  return { task: updated ?? { ...task, status: effectiveStatus }, warnings, retried };
}

export async function retryTask(taskId: string, actor: TaskActor): Promise<TaskRecord> {
  const store = await getStore();
  const task = await store.getTask(taskId);
  if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'That task does not exist.');
  if (task.status === 'queued' || task.status === 'running') {
    throw new ApiError(409, 'TASK_ACTIVE', 'Only finished tasks can be retried.');
  }
  if (task.dedupeKey) {
    const active = await store.findActiveTaskByDedupe(task.dedupeKey);
    if (active) {
      throw new ApiError(
        409,
        'DUPLICATE_ACTIVE_TASK',
        'Another task of this type is already queued or running. Wait for it to finish.',
      );
    }
  }

  const now = new Date();
  const updated = await store.updateTask(taskId, {
    status: 'queued',
    attempts: 0,
    workerId: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    errorCode: null,
    errorMessage: null,
    rawResponse: null,
    parsedResponse: null,
    expiresAt: new Date(now.getTime() + QUEUED_TASK_TTL_MS).toISOString(),
  });
  if (!updated) throw new ApiError(404, 'TASK_NOT_FOUND', 'That task does not exist.');

  await recordActivity({
    actor,
    action: 'task.retried',
    category: 'task',
    description: `Task retried by ${actor.email}.`,
    targetType: 'background_task',
    targetId: taskId,
  });
  return updated;
}

export async function cancelTask(taskId: string, actor: TaskActor): Promise<TaskRecord> {
  const store = await getStore();
  const task = await store.getTask(taskId);
  if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'That task does not exist.');
  if (task.status !== 'queued') {
    throw new ApiError(
      409,
      'TASK_NOT_QUEUED',
      'Only queued tasks can be cancelled. A running task must finish or time out on the worker.',
    );
  }

  const updated = await store.updateTask(taskId, {
    status: 'failed',
    completedAt: new Date().toISOString(),
    durationMs: 0,
    errorCode: 'CANCELLED_BY_OPERATOR',
    errorMessage: `Cancelled by ${actor.email} before a worker claimed it.`,
  });
  if (!updated) throw new ApiError(404, 'TASK_NOT_FOUND', 'That task does not exist.');

  await recordActivity({
    actor,
    action: 'task.cancelled',
    category: 'task',
    description: `Queued task cancelled by ${actor.email}.`,
    targetType: 'background_task',
    targetId: taskId,
  });
  return updated;
}

export interface TaskDetail {
  task: TaskRecord;
  results: TaskResultRecord[];
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const store = await getStore();
  const task = await store.getTask(taskId);
  if (!task) return null;
  const results = await store.listTaskResults(taskId);
  return { task, results };
}

export async function getTaskSummary(): Promise<{
  counts: Record<string, number>;
  queued: number;
  running: number;
  recent: TaskRecord[];
}> {
  const store = await getStore();
  await reapTasks(store);
  const counts = await store.countTasksByStatus();
  const recent = await store.listTasks({ limit: 5, offset: 0 });
  return {
    counts,
    queued: counts.queued ?? 0,
    running: counts.running ?? 0,
    recent: recent.items,
  };
}

/** Used by the worker claim endpoint to report queue depth and defaults. */
export async function getQueueSettings(): Promise<{
  pollAfterMs: number;
  queued: number;
  running: number;
  offlineAfterSeconds: number;
}> {
  const store = await getStore();
  const settings = mergeSettings(await store.getSettings());
  const counts = await store.countTasksByStatus();
  return {
    pollAfterMs: 2_000,
    queued: counts.queued,
    running: counts.running,
    offlineAfterSeconds: settings.workerOfflineAfterSeconds,
  };
}
