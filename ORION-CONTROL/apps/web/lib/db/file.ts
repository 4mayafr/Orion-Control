/**
 * Local development storage driver.
 *
 * A single JSON document stored under apps/web/.data/orion.json. It exists so
 * the project runs with zero configuration on a laptop. It is NOT suitable for
 * Vercel: serverless filesystems are ephemeral. The store refuses to be used in
 * production on Vercel (enforced in lib/env.ts).
 *
 * Writes are atomic (write to a temp file, then rename) and serialised through a
 * promise chain. Node's single-threaded model makes the read-modify-write inside
 * each method atomic as long as no `await` happens mid-mutation.
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Permission, TaskStatus } from '@orion/shared';
import type {
  ActivityLogRecord,
  ApiKeyRecord,
  LogFilter,
  PermissionRecord,
  PlayerFilter,
  PlayerRecord,
  StatisticsRecord,
  Store,
  TaskFilter,
  TaskPatch,
  TaskRecord,
  TaskResultRecord,
  UserRecord,
  WorkerStatusRecord,
} from './types';

interface FileData {
  version: 1;
  users: UserRecord[];
  permissions: Record<string, Array<{ permission: Permission; granted: boolean }>>;
  tasks: TaskRecord[];
  taskResults: TaskResultRecord[];
  statistics: StatisticsRecord[];
  players: PlayerRecord[];
  logs: ActivityLogRecord[];
  workers: WorkerStatusRecord[];
  apiKeys: ApiKeyRecord[];
  settings: Record<string, unknown>;
}

function emptyData(): FileData {
  return {
    version: 1,
    users: [],
    permissions: {},
    tasks: [],
    taskResults: [],
    statistics: [],
    players: [],
    logs: [],
    workers: [],
    apiKeys: [],
    settings: {},
  };
}

const TASK_STATUS_DEFAULTS: Record<TaskStatus, number> = {
  queued: 0,
  running: 0,
  completed: 0,
  failed: 0,
  timed_out: 0,
};

export class FileStore implements Store {
  readonly driver = 'file' as const;
  private data: FileData = emptyData();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly log: (message: string) => void = () => {},
  ) {}

  async init(): Promise<void> {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<FileData>;
      this.data = { ...emptyData(), ...parsed, version: 1 };
      this.log(`File storage loaded from ${this.filePath}`);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
      this.data = emptyData();
      await this.persist();
      this.log(`Created new file storage at ${this.filePath}`);
    }
    this.loaded = true;
  }

  async close(): Promise<void> {
    await this.writeChain;
  }

  private async ready(): Promise<void> {
    if (!this.loaded) await this.init();
  }

  private async persist(): Promise<void> {
    const payload = JSON.stringify(this.data, null, 2);
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    this.writeChain = this.writeChain.then(async () => {
      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, this.filePath);
    });
    await this.writeChain;
  }

  // ── Operators ─────────────────────────────────────────────────────────────

  async countUsers(): Promise<number> {
    await this.ready();
    return this.data.users.length;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    await this.ready();
    const user = this.data.users.find((candidate) => candidate.id === id);
    return user ? { ...user } : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    await this.ready();
    const normalized = email.trim().toLowerCase();
    const user = this.data.users.find((candidate) => candidate.email.toLowerCase() === normalized);
    return user ? { ...user } : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    await this.ready();
    return [...this.data.users].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((user) => ({ ...user }));
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    await this.ready();
    this.data.users.push({ ...user });
    await this.persist();
    return { ...user };
  }

  async updateUser(
    id: string,
    patch: Partial<Pick<UserRecord, 'name' | 'email' | 'passwordHash' | 'role' | 'status' | 'lastLoginAt' | 'updatedAt'>>,
  ): Promise<UserRecord | null> {
    await this.ready();
    const user = this.data.users.find((candidate) => candidate.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    await this.persist();
    return { ...user };
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.ready();
    const before = this.data.users.length;
    this.data.users = this.data.users.filter((user) => user.id !== id);
    if (this.data.users.length === before) return false;
    delete this.data.permissions[id];
    await this.persist();
    return true;
  }

  async getUserPermissions(userId: string): Promise<PermissionRecord[]> {
    await this.ready();
    return (this.data.permissions[userId] ?? []).map((override) => ({ ...override }));
  }

  async setUserPermissions(
    userId: string,
    overrides: Array<{ permission: Permission; granted: boolean }>,
  ): Promise<void> {
    await this.ready();
    this.data.permissions[userId] = overrides.map((override) => ({ ...override }));
    await this.persist();
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async createTask(task: TaskRecord): Promise<TaskRecord> {
    await this.ready();
    this.data.tasks.push({ ...task });
    await this.persist();
    return { ...task };
  }

  async getTask(id: string): Promise<TaskRecord | null> {
    await this.ready();
    const task = this.data.tasks.find((candidate) => candidate.id === id);
    return task ? { ...task } : null;
  }

  async listTasks(filter: TaskFilter): Promise<{ items: TaskRecord[]; total: number }> {
    await this.ready();
    const filtered = this.data.tasks
      .filter((task) => (filter.status ? task.status === filter.status : true))
      .filter((task) => (filter.type ? task.type === filter.type : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: filtered.slice(filter.offset, filter.offset + filter.limit).map((task) => ({ ...task })),
      total: filtered.length,
    };
  }

  async countTasksByStatus(): Promise<Record<TaskStatus, number>> {
    await this.ready();
    const counts = { ...TASK_STATUS_DEFAULTS };
    for (const task of this.data.tasks) counts[task.status] += 1;
    return counts;
  }

  async findActiveTaskByDedupe(dedupeKey: string): Promise<TaskRecord | null> {
    await this.ready();
    const task = this.data.tasks.find(
      (candidate) =>
        candidate.dedupeKey === dedupeKey && (candidate.status === 'queued' || candidate.status === 'running'),
    );
    return task ? { ...task } : null;
  }

  async claimNextTask(workerId: string, now: string): Promise<TaskRecord | null> {
    await this.ready();
    const nowMs = Date.parse(now);
    const candidate = this.data.tasks
      .filter((task) => task.status === 'queued' && Date.parse(task.expiresAt) > nowMs)
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))[0];
    if (!candidate) return null;
    candidate.status = 'running';
    candidate.workerId = workerId;
    candidate.startedAt = now;
    candidate.attempts += 1;
    candidate.errorCode = null;
    candidate.errorMessage = null;
    await this.persist();
    return { ...candidate };
  }

  async updateTask(id: string, patch: TaskPatch): Promise<TaskRecord | null> {
    await this.ready();
    const task = this.data.tasks.find((candidate) => candidate.id === id);
    if (!task) return null;
    Object.assign(task, patch);
    await this.persist();
    return { ...task };
  }

  async expireStaleTasks(now: string): Promise<{ timedOut: number; requeued: number }> {
    await this.ready();
    const nowMs = Date.parse(now);
    let timedOut = 0;
    let requeued = 0;
    for (const task of this.data.tasks) {
      if (task.status === 'queued' && Date.parse(task.expiresAt) <= nowMs) {
        task.status = 'timed_out';
        task.completedAt = now;
        task.errorCode = 'TASK_EXPIRED';
        task.errorMessage = 'Task expired before a worker claimed it.';
        timedOut += 1;
        continue;
      }
      if (task.status === 'running' && task.startedAt) {
        const deadline = Date.parse(task.startedAt) + task.timeoutMs;
        if (deadline > nowMs) continue;
        if (task.attempts < task.maxAttempts) {
          task.status = 'queued';
          task.startedAt = null;
          task.workerId = null;
          task.errorCode = 'EXECUTION_TIMEOUT';
          task.errorMessage = `No result arrived within ${task.timeoutMs} ms. Retry queued.`;
          requeued += 1;
        } else {
          task.status = 'timed_out';
          task.completedAt = now;
          task.durationMs = task.timeoutMs;
          task.errorCode = 'EXECUTION_TIMEOUT';
          task.errorMessage = `No result arrived within ${task.timeoutMs} ms.`;
          timedOut += 1;
        }
      }
    }
    if (timedOut > 0 || requeued > 0) await this.persist();
    return { timedOut, requeued };
  }

  async createTaskResult(result: TaskResultRecord): Promise<TaskResultRecord> {
    await this.ready();
    this.data.taskResults.push({ ...result });
    await this.persist();
    return { ...result };
  }

  async listTaskResults(taskId: string): Promise<TaskResultRecord[]> {
    await this.ready();
    return this.data.taskResults
      .filter((result) => result.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((result) => ({ ...result }));
  }

  // ── Statistics ────────────────────────────────────────────────────────────

  async createStatistics(record: StatisticsRecord): Promise<StatisticsRecord> {
    await this.ready();
    this.data.statistics.push({ ...record });
    await this.persist();
    return { ...record };
  }

  async getLatestStatistics(): Promise<StatisticsRecord | null> {
    await this.ready();
    const latest = [...this.data.statistics].sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))[0];
    return latest ? { ...latest } : null;
  }

  async listStatistics(limit: number): Promise<StatisticsRecord[]> {
    await this.ready();
    return [...this.data.statistics]
      .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))
      .slice(0, Math.max(1, limit))
      .map((record) => ({ ...record }));
  }

  async upsertPlayers(players: PlayerRecord[]): Promise<void> {
    await this.ready();
    for (const player of players) {
      const existing = this.data.players.find((candidate) => candidate.externalId === player.externalId);
      if (existing) Object.assign(existing, player);
      else this.data.players.push({ ...player, id: player.id || randomUUID() });
    }
    if (players.length > 0) await this.persist();
  }

  async listPlayers(filter: PlayerFilter): Promise<{ items: PlayerRecord[]; total: number }> {
    await this.ready();
    const search = filter.search?.trim().toLowerCase();
    const filtered = this.data.players
      .filter((player) => (filter.status ? player.status === filter.status : true))
      .filter((player) =>
        search
          ? player.displayName.toLowerCase().includes(search) ||
            player.externalId.toLowerCase().includes(search)
          : true,
      )
      .sort((a, b) => {
        const order = { online: 0, 'in-match': 1, offline: 2 } as const;
        const byStatus = order[a.status] - order[b.status];
        return byStatus !== 0 ? byStatus : a.displayName.localeCompare(b.displayName);
      });
    return {
      items: filtered.slice(filter.offset, filter.offset + filter.limit).map((player) => ({ ...player })),
      total: filtered.length,
    };
  }

  // ── Activity ──────────────────────────────────────────────────────────────

  async createLog(log: ActivityLogRecord): Promise<void> {
    await this.ready();
    this.data.logs.push({ ...log });
    // Keep the local file from growing forever.
    if (this.data.logs.length > 5_000) {
      this.data.logs = this.data.logs
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5_000);
    }
    await this.persist();
  }

  async listLogs(filter: LogFilter): Promise<{ items: ActivityLogRecord[]; total: number }> {
    await this.ready();
    const search = filter.search?.trim().toLowerCase();
    const filtered = this.data.logs
      .filter((log) => (filter.category ? log.category === filter.category : true))
      .filter((log) =>
        search
          ? log.description.toLowerCase().includes(search) ||
            log.action.toLowerCase().includes(search) ||
            (log.actorEmail ?? '').toLowerCase().includes(search)
          : true,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: filtered.slice(filter.offset, filter.offset + filter.limit).map((log) => ({ ...log })),
      total: filtered.length,
    };
  }

  // ── Workers ───────────────────────────────────────────────────────────────

  async upsertWorker(worker: WorkerStatusRecord): Promise<WorkerStatusRecord> {
    await this.ready();
    const existing = this.data.workers.find((candidate) => candidate.workerId === worker.workerId);
    if (existing) {
      Object.assign(existing, worker, { startedAt: existing.startedAt });
      await this.persist();
      return { ...existing };
    }
    this.data.workers.push({ ...worker });
    await this.persist();
    return { ...worker };
  }

  async listWorkers(): Promise<WorkerStatusRecord[]> {
    await this.ready();
    return [...this.data.workers]
      .sort((a, b) => b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt))
      .map((worker) => ({ ...worker }));
  }

  // ── API keys ──────────────────────────────────────────────────────────────

  async createApiKey(key: ApiKeyRecord): Promise<ApiKeyRecord> {
    await this.ready();
    this.data.apiKeys.push({ ...key });
    await this.persist();
    return { ...key };
  }

  async listApiKeys(): Promise<ApiKeyRecord[]> {
    await this.ready();
    return [...this.data.apiKeys].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((key) => ({ ...key }));
  }

  async getApiKeyByHash(hash: string): Promise<ApiKeyRecord | null> {
    await this.ready();
    const key = this.data.apiKeys.find((candidate) => candidate.keyHash === hash);
    return key ? { ...key } : null;
  }

  async touchApiKey(id: string, at: string): Promise<void> {
    await this.ready();
    const key = this.data.apiKeys.find((candidate) => candidate.id === id);
    if (!key) return;
    key.lastUsedAt = at;
    await this.persist();
  }

  async revokeApiKey(id: string, at: string): Promise<boolean> {
    await this.ready();
    const key = this.data.apiKeys.find((candidate) => candidate.id === id);
    if (!key || key.revokedAt) return false;
    key.revokedAt = at;
    await this.persist();
    return true;
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings(): Promise<Record<string, unknown>> {
    await this.ready();
    return { ...this.data.settings };
  }

  async saveSettings(values: Record<string, unknown>, _updatedBy: string | null): Promise<void> {
    await this.ready();
    this.data.settings = { ...this.data.settings, ...values };
    await this.persist();
  }
}
