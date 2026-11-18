/**
 * Background task domain model.
 *
 * A task is created by the website, stored in the database and claimed by the
 * Chromebook worker. The website never waits for the worker: it polls task
 * status or renders the result once it arrives.
 */

import type { Permission } from './permissions.js';

export const TASK_STATUSES = ['queued', 'running', 'completed', 'failed', 'timed_out'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ['queued', 'running'];
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['completed', 'failed', 'timed_out'];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  timed_out: 'Timed out',
};

export const TASK_STATUS_HINTS: Record<TaskStatus, string> = {
  queued: 'Waiting for the worker to claim it.',
  running: 'Claimed by the worker and currently executing.',
  completed: 'Finished successfully. Results are available.',
  failed: 'The worker reported an error. Inspect the error details.',
  timed_out: 'No result arrived before the timeout expired.',
};

export const TASK_TYPES = [
  {
    type: 'statistics.retrieve',
    label: 'Retrieve server statistics',
    description:
      'Asks the worker to collect current server, match and player statistics through the configured integration and submit them back to ORION CONTROL.',
    permission: 'statistics.retrieve',
    defaultTimeoutMs: 60_000,
    maxAttempts: 2,
    group: 'Discord',
  },
  {
    type: 'players.retrieve',
    label: 'Retrieve player directory',
    description:
      'Asks the worker to collect the current player directory through the configured integration.',
    permission: 'statistics.retrieve',
    defaultTimeoutMs: 60_000,
    maxAttempts: 2,
    group: 'Discord',
  },
  {
    type: 'discord.channel_check',
    label: 'Verify Discord channel',
    description:
      'Checks that the worker can reach the configured guild and channel, and reports the resolved channel with its permissions. Use this to validate Discord configuration.',
    permission: 'settings.manage',
    defaultTimeoutMs: 30_000,
    maxAttempts: 1,
    group: 'Diagnostics',
  },
] as const satisfies readonly TaskTypeDefinition[];

export type TaskType = (typeof TASK_TYPES)[number]['type'];

export interface TaskTypeDefinition {
  type: string;
  label: string;
  description: string;
  permission: Permission;
  defaultTimeoutMs: number;
  maxAttempts: number;
  group: string;
}

export const TASK_TYPE_LIST: readonly TaskTypeDefinition[] = TASK_TYPES;

export const TASK_TYPE_MAP: Record<string, TaskTypeDefinition> = Object.fromEntries(
  TASK_TYPES.map((definition) => [definition.type, definition]),
);

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && value in TASK_TYPE_MAP;
}

export function getTaskTypeDefinition(type: string): TaskTypeDefinition | undefined {
  return TASK_TYPE_MAP[type];
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isActiveTaskStatus(status: TaskStatus): boolean {
  return status === 'queued' || status === 'running';
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'timed_out';
}

/** Explain the lifecycle of a task in one line — used in the task detail UI. */
export function describeTaskLifecycle(status: TaskStatus): string {
  switch (status) {
    case 'queued':
      return 'Created → waiting for a worker claim';
    case 'running':
      return 'Claimed → worker executing';
    case 'completed':
      return 'Executed → result stored';
    case 'failed':
      return 'Executed → worker reported an error';
    case 'timed_out':
      return 'Deadline expired before a result arrived';
  }
}

/** Task payloads are intentionally small and JSON-only. */
export type TaskPayload = Record<string, unknown>;
