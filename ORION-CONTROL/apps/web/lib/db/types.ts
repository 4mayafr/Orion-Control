/**
 * Database abstraction.
 *
 * Two drivers implement this interface:
 *   - PostgresStore: production storage (Neon/Supabase/any Postgres 13+)
 *   - FileStore:     zero-config local development (JSON file, NOT for Vercel)
 *
 * The rest of the application depends only on `Store`, never on SQL or files.
 * All timestamps are ISO-8601 strings so records are JSON-safe end to end.
 */

import type {
  Permission,
  PlayerStatus,
  Role,
  StatSource,
  StatisticsSummary,
  TaskStatus,
  TaskType,
} from '@orion/shared';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface PermissionRecord {
  permission: Permission;
  granted: boolean;
}

export interface TaskRecord {
  id: string;
  type: TaskType;
  status: TaskStatus;
  requestedBy: string | null;
  requestedByEmail: string | null;
  payload: Record<string, unknown>;
  dedupeKey: string | null;
  priority: number;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  workerId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  expiresAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  rawResponse: string | null;
  parsedResponse: unknown;
}

export type TaskPatch = Partial<
  Pick<
    TaskRecord,
    | 'status'
    | 'workerId'
    | 'attempts'
    | 'startedAt'
    | 'completedAt'
    | 'durationMs'
    | 'expiresAt'
    | 'errorCode'
    | 'errorMessage'
    | 'rawResponse'
    | 'parsedResponse'
    | 'priority'
  >
>;

export interface TaskFilter {
  status?: TaskStatus;
  type?: string;
  limit: number;
  offset: number;
}

export interface TaskResultRecord {
  id: string;
  taskId: string;
  workerId: string;
  status: 'completed' | 'failed' | 'timed_out';
  durationMs: number;
  rawResponse: string | null;
  parsedResponse: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface StatisticsRecord {
  id: string;
  source: Exclude<StatSource, 'unavailable'>;
  retrievedAt: string;
  taskId: string | null;
  createdBy: string | null;
  summary: StatisticsSummary;
  servers: unknown[];
  matches: unknown[];
  players: unknown[];
  notes: string | null;
  warnings: string[];
  createdAt: string;
}

export interface PlayerRecord {
  id: string;
  externalId: string;
  displayName: string;
  platform: string | null;
  rank: string | null;
  status: PlayerStatus;
  source: Exclude<StatSource, 'unavailable'>;
  lastSeenAt: string | null;
  updatedAt: string;
}

export interface PlayerFilter {
  search?: string;
  status?: PlayerStatus;
  limit: number;
  offset: number;
}

export interface ActivityLogRecord {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  category: string;
  targetType: string | null;
  targetId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface LogFilter {
  category?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface WorkerStatusRecord {
  workerId: string;
  hostname: string | null;
  platform: string | null;
  version: string | null;
  status: 'online' | 'offline' | 'degraded';
  currentTaskId: string | null;
  integrationMode: string | null;
  discordConnected: boolean | null;
  lastHeartbeatAt: string;
  startedAt: string;
  metadata: Record<string, unknown>;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  createdBy: string | null;
  createdByEmail: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface Store {
  readonly driver: 'postgres' | 'file';

  init(): Promise<void>;
  close(): Promise<void>;

  // Operators
  countUsers(): Promise<number>;
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  createUser(user: UserRecord): Promise<UserRecord>;
  updateUser(
    id: string,
    patch: Partial<Pick<UserRecord, 'name' | 'email' | 'passwordHash' | 'role' | 'status' | 'lastLoginAt' | 'updatedAt'>>,
  ): Promise<UserRecord | null>;
  deleteUser(id: string): Promise<boolean>;
  getUserPermissions(userId: string): Promise<PermissionRecord[]>;
  setUserPermissions(
    userId: string,
    overrides: Array<{ permission: Permission; granted: boolean }>,
  ): Promise<void>;

  // Background tasks
  createTask(task: TaskRecord): Promise<TaskRecord>;
  getTask(id: string): Promise<TaskRecord | null>;
  listTasks(filter: TaskFilter): Promise<{ items: TaskRecord[]; total: number }>;
  countTasksByStatus(): Promise<Record<TaskStatus, number>>;
  findActiveTaskByDedupe(dedupeKey: string): Promise<TaskRecord | null>;
  claimNextTask(workerId: string, now: string): Promise<TaskRecord | null>;
  updateTask(id: string, patch: TaskPatch): Promise<TaskRecord | null>;
  expireStaleTasks(now: string): Promise<{ timedOut: number; requeued: number }>;
  createTaskResult(result: TaskResultRecord): Promise<TaskResultRecord>;
  listTaskResults(taskId: string): Promise<TaskResultRecord[]>;

  // Statistics
  createStatistics(record: StatisticsRecord): Promise<StatisticsRecord>;
  getLatestStatistics(): Promise<StatisticsRecord | null>;
  listStatistics(limit: number): Promise<StatisticsRecord[]>;
  upsertPlayers(players: PlayerRecord[]): Promise<void>;
  listPlayers(filter: PlayerFilter): Promise<{ items: PlayerRecord[]; total: number }>;

  // Activity
  createLog(log: ActivityLogRecord): Promise<void>;
  listLogs(filter: LogFilter): Promise<{ items: ActivityLogRecord[]; total: number }>;

  // Workers
  upsertWorker(worker: WorkerStatusRecord): Promise<WorkerStatusRecord>;
  listWorkers(): Promise<WorkerStatusRecord[]>;

  // API keys
  createApiKey(key: ApiKeyRecord): Promise<ApiKeyRecord>;
  listApiKeys(): Promise<ApiKeyRecord[]>;
  getApiKeyByHash(hash: string): Promise<ApiKeyRecord | null>;
  touchApiKey(id: string, at: string): Promise<void>;
  revokeApiKey(id: string, at: string): Promise<boolean>;

  // Settings
  getSettings(): Promise<Record<string, unknown>>;
  saveSettings(values: Record<string, unknown>, updatedBy: string | null): Promise<void>;
}
