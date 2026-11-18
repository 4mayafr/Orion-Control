/**
 * PostgreSQL storage driver (Neon, Supabase or any Postgres 13+).
 *
 * All access goes through bound parameters. JSON payloads are stored as jsonb.
 * The pool is small on purpose: serverless functions should use a pooled
 * connection string (Neon "-pooler" host or Supabase pooler) and few sockets.
 */

import { Pool } from 'pg';
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

type Row = Record<string, unknown>;

const TASK_STATUSES: TaskStatus[] = ['queued', 'running', 'completed', 'failed', 'timed_out'];

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requiredIso(value: unknown): string {
  return iso(value) ?? new Date(0).toISOString();
}

function mapUser(row: Row): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    passwordHash: String(row.password_hash),
    role: row.role as UserRecord['role'],
    status: row.status as UserRecord['status'],
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
    lastLoginAt: iso(row.last_login_at),
  };
}

function mapTask(row: Row): TaskRecord {
  return {
    id: String(row.id),
    type: row.type as TaskRecord['type'],
    status: row.status as TaskStatus,
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    requestedByEmail: row.requested_by_email ? String(row.requested_by_email) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    dedupeKey: row.dedupe_key ? String(row.dedupe_key) : null,
    priority: Number(row.priority ?? 0),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 1),
    timeoutMs: Number(row.timeout_ms ?? 60_000),
    workerId: row.worker_id ? String(row.worker_id) : null,
    createdAt: requiredIso(row.created_at),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    expiresAt: requiredIso(row.expires_at),
    errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    rawResponse: row.raw_response ? String(row.raw_response) : null,
    parsedResponse: row.parsed_response ?? null,
  };
}

function mapTaskResult(row: Row): TaskResultRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    workerId: String(row.worker_id),
    status: row.status as TaskResultRecord['status'],
    durationMs: Number(row.duration_ms ?? 0),
    rawResponse: row.raw_response ? String(row.raw_response) : null,
    parsedResponse: row.parsed_response ?? null,
    errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: requiredIso(row.created_at),
  };
}

function mapStatistics(row: Row): StatisticsRecord {
  return {
    id: String(row.id),
    source: row.source as StatisticsRecord['source'],
    retrievedAt: requiredIso(row.retrieved_at),
    taskId: row.task_id ? String(row.task_id) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    summary: (row.summary as StatisticsRecord['summary']) ?? {
      playersOnline: 0,
      activeMatches: 0,
      activeServers: 0,
      totalServers: 0,
      healthScore: 0,
    },
    servers: (row.servers as unknown[]) ?? [],
    matches: (row.matches as unknown[]) ?? [],
    players: (row.players as unknown[]) ?? [],
    notes: row.notes ? String(row.notes) : null,
    warnings: (row.warnings as string[]) ?? [],
    createdAt: requiredIso(row.created_at),
  };
}

function mapPlayer(row: Row): PlayerRecord {
  return {
    id: String(row.id),
    externalId: String(row.external_id),
    displayName: String(row.display_name),
    platform: row.platform ? String(row.platform) : null,
    rank: row.rank ? String(row.rank) : null,
    status: row.status as PlayerRecord['status'],
    source: row.source as PlayerRecord['source'],
    lastSeenAt: iso(row.last_seen_at),
    updatedAt: requiredIso(row.updated_at),
  };
}

function mapLog(row: Row): ActivityLogRecord {
  return {
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorEmail: row.actor_email ? String(row.actor_email) : null,
    action: String(row.action),
    category: String(row.category),
    targetType: row.target_type ? String(row.target_type) : null,
    targetId: row.target_id ? String(row.target_id) : null,
    description: String(row.description),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    ip: row.ip ? String(row.ip) : null,
    createdAt: requiredIso(row.created_at),
  };
}

function mapWorker(row: Row): WorkerStatusRecord {
  return {
    workerId: String(row.worker_id),
    hostname: row.hostname ? String(row.hostname) : null,
    platform: row.platform ? String(row.platform) : null,
    version: row.version ? String(row.version) : null,
    status: row.status as WorkerStatusRecord['status'],
    currentTaskId: row.current_task_id ? String(row.current_task_id) : null,
    integrationMode: row.integration_mode ? String(row.integration_mode) : null,
    discordConnected: row.discord_connected === null || row.discord_connected === undefined
      ? null
      : Boolean(row.discord_connected),
    lastHeartbeatAt: requiredIso(row.last_heartbeat_at),
    startedAt: requiredIso(row.started_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapApiKey(row: Row): ApiKeyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    prefix: String(row.prefix),
    keyHash: String(row.key_hash),
    scopes: (row.scopes as string[]) ?? [],
    createdBy: row.created_by ? String(row.created_by) : null,
    createdByEmail: row.created_by_email ? String(row.created_by_email) : null,
    createdAt: requiredIso(row.created_at),
    lastUsedAt: iso(row.last_used_at),
    revokedAt: iso(row.revoked_at),
  };
}

const TASK_PATCH_COLUMNS: Record<keyof TaskPatch, string> = {
  status: 'status',
  workerId: 'worker_id',
  attempts: 'attempts',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  durationMs: 'duration_ms',
  expiresAt: 'expires_at',
  errorCode: 'error_code',
  errorMessage: 'error_message',
  rawResponse: 'raw_response',
  parsedResponse: 'parsed_response',
  priority: 'priority',
};

const USER_PATCH_COLUMNS = {
  name: 'name',
  email: 'email',
  passwordHash: 'password_hash',
  role: 'role',
  status: 'status',
  lastLoginAt: 'last_login_at',
} as const;

export class PostgresStore implements Store {
  readonly driver = 'postgres' as const;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    const url = new URL(connectionString);
    const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const sslDisabled = url.searchParams.get('sslmode') === 'disable';
    this.pool = new Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      ssl: localHost || sslDisabled ? undefined : { rejectUnauthorized: false },
    });
  }

  async init(): Promise<void> {
    try {
      await this.pool.query('select 1');
    } catch (error) {
      throw new Error(
        `Could not connect to PostgreSQL. Check DATABASE_URL and make sure migrations were applied (npm run db:migrate). Original error: ${(error as Error).message}`,
      );
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ── Operators ─────────────────────────────────────────────────────────────

  async countUsers(): Promise<number> {
    const result = await this.pool.query<{ count: number }>('select count(*)::int as count from users');
    return result.rows[0]?.count ?? 0;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query('select * from users where id = $1 limit 1', [id]);
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query('select * from users where lower(email) = lower($1) limit 1', [email]);
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    const result = await this.pool.query('select * from users order by created_at asc');
    return result.rows.map(mapUser);
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    const result = await this.pool.query(
      `insert into users (id, email, name, password_hash, role, status, created_at, updated_at, last_login_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
      [
        user.id,
        user.email,
        user.name,
        user.passwordHash,
        user.role,
        user.status,
        user.createdAt,
        user.updatedAt,
        user.lastLoginAt,
      ],
    );
    return mapUser(result.rows[0] as Row);
  }

  async updateUser(
    id: string,
    patch: Partial<Pick<UserRecord, 'name' | 'email' | 'passwordHash' | 'role' | 'status' | 'lastLoginAt' | 'updatedAt'>>,
  ): Promise<UserRecord | null> {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<
      [keyof typeof USER_PATCH_COLUMNS, string | null]
    >;
    if (entries.length === 0) return this.getUserById(id);
    const values: unknown[] = [];
    const assignments = entries.map(([key, value], index) => {
      values.push(value);
      return `${USER_PATCH_COLUMNS[key]} = $${index + 1}`;
    });
    values.push(id);
    const result = await this.pool.query(
      `update users set ${assignments.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
      values,
    );
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.pool.query('delete from users where id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getUserPermissions(userId: string): Promise<PermissionRecord[]> {
    const result = await this.pool.query<{ permission: Permission; granted: boolean }>(
      'select permission, granted from permissions where user_id = $1 order by permission asc',
      [userId],
    );
    return result.rows.map((row) => ({ permission: row.permission, granted: row.granted }));
  }

  async setUserPermissions(
    userId: string,
    overrides: Array<{ permission: Permission; granted: boolean }>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from permissions where user_id = $1', [userId]);
      for (const override of overrides) {
        await client.query(
          'insert into permissions (user_id, permission, granted) values ($1, $2, $3)',
          [userId, override.permission, override.granted],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async createTask(task: TaskRecord): Promise<TaskRecord> {
    const result = await this.pool.query(
      `insert into background_tasks
        (id, type, status, requested_by, requested_by_email, payload, dedupe_key, priority,
         attempts, max_attempts, timeout_ms, worker_id, created_at, started_at, completed_at,
         duration_ms, expires_at, error_code, error_message, raw_response, parsed_response)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb)
       returning *`,
      [
        task.id,
        task.type,
        task.status,
        task.requestedBy,
        task.requestedByEmail,
        JSON.stringify(task.payload),
        task.dedupeKey,
        task.priority,
        task.attempts,
        task.maxAttempts,
        task.timeoutMs,
        task.workerId,
        task.createdAt,
        task.startedAt,
        task.completedAt,
        task.durationMs,
        task.expiresAt,
        task.errorCode,
        task.errorMessage,
        task.rawResponse,
        task.parsedResponse === null || task.parsedResponse === undefined
          ? null
          : JSON.stringify(task.parsedResponse),
      ],
    );
    return mapTask(result.rows[0] as Row);
  }

  async getTask(id: string): Promise<TaskRecord | null> {
    const result = await this.pool.query('select * from background_tasks where id = $1 limit 1', [id]);
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async listTasks(filter: TaskFilter): Promise<{ items: TaskRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }
    if (filter.type) {
      values.push(filter.type);
      conditions.push(`type = $${values.length}`);
    }
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    const totalResult = await this.pool.query<{ count: number }>(
      `select count(*)::int as count from background_tasks ${where}`,
      values,
    );

    const listValues = [...values, filter.limit, filter.offset];
    const result = await this.pool.query(
      `select * from background_tasks ${where}
       order by created_at desc
       limit $${listValues.length - 1} offset $${listValues.length}`,
      listValues,
    );

    return {
      items: result.rows.map(mapTask),
      total: totalResult.rows[0]?.count ?? 0,
    };
  }

  async countTasksByStatus(): Promise<Record<TaskStatus, number>> {
    const result = await this.pool.query<{ status: TaskStatus; count: number }>(
      'select status, count(*)::int as count from background_tasks group by status',
    );
    const counts = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as Record<TaskStatus, number>;
    for (const row of result.rows) counts[row.status] = row.count;
    return counts;
  }

  async findActiveTaskByDedupe(dedupeKey: string): Promise<TaskRecord | null> {
    const result = await this.pool.query(
      `select * from background_tasks
       where dedupe_key = $1 and status in ('queued', 'running')
       order by created_at asc limit 1`,
      [dedupeKey],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async claimNextTask(workerId: string, now: string): Promise<TaskRecord | null> {
    // `for update skip locked` makes claiming safe when several workers poll at
    // the same time: exactly one of them receives each task.
    const result = await this.pool.query(
      `with candidate as (
         select id from background_tasks
         where status = 'queued' and expires_at > $2::timestamptz
         order by priority desc, created_at asc
         limit 1
         for update skip locked
       )
       update background_tasks t
       set status = 'running',
           worker_id = $1,
           started_at = $2::timestamptz,
           attempts = t.attempts + 1,
           error_code = null,
           error_message = null
       from candidate
       where t.id = candidate.id
       returning t.*`,
      [workerId, now],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async updateTask(id: string, patch: TaskPatch): Promise<TaskRecord | null> {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<
      [keyof TaskPatch, unknown]
    >;
    if (entries.length === 0) return this.getTask(id);
    const values: unknown[] = [];
    const assignments = entries.map(([key, value]) => {
      const column = TASK_PATCH_COLUMNS[key];
      if (key === 'parsedResponse') {
        values.push(value === null ? null : JSON.stringify(value));
        return `${column} = $${values.length}::jsonb`;
      }
      values.push(value);
      return `${column} = $${values.length}`;
    });
    values.push(id);
    const result = await this.pool.query(
      `update background_tasks set ${assignments.join(', ')} where id = $${values.length} returning *`,
      values,
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async expireStaleTasks(now: string): Promise<{ timedOut: number; requeued: number }> {
    const expired = await this.pool.query(
      `update background_tasks
       set status = 'timed_out',
           completed_at = $1::timestamptz,
           error_code = 'TASK_EXPIRED',
           error_message = 'Task expired before a worker claimed it.'
       where status = 'queued' and expires_at <= $1::timestamptz`,
      [now],
    );

    const stale = await this.pool.query<{ status: string }>(
      `with stale as (
         select id, attempts, max_attempts, timeout_ms
         from background_tasks
         where status = 'running'
           and started_at is not null
           and started_at + make_interval(secs => timeout_ms / 1000.0) <= $1::timestamptz
       )
       update background_tasks t
       set status = case when stale.attempts < stale.max_attempts then 'queued' else 'timed_out' end,
           error_code = 'EXECUTION_TIMEOUT',
           error_message = case when stale.attempts < stale.max_attempts
             then 'No result arrived within ' || stale.timeout_ms || ' ms. Retry queued.'
             else 'No result arrived within ' || stale.timeout_ms || ' ms.' end,
           started_at = case when stale.attempts < stale.max_attempts then null else t.started_at end,
           worker_id = case when stale.attempts < stale.max_attempts then null else t.worker_id end,
           duration_ms = case when stale.attempts < stale.max_attempts then t.duration_ms else stale.timeout_ms end,
           completed_at = case when stale.attempts < stale.max_attempts then null else $1::timestamptz end
       from stale
       where t.id = stale.id
       returning t.status`,
      [now],
    );

    const requeued = stale.rows.filter((row) => row.status === 'queued').length;
    const timedOut = (expired.rowCount ?? 0) + stale.rows.filter((row) => row.status === 'timed_out').length;
    return { timedOut, requeued };
  }

  async createTaskResult(result: TaskResultRecord): Promise<TaskResultRecord> {
    const inserted = await this.pool.query(
      `insert into task_results
        (id, task_id, worker_id, status, duration_ms, raw_response, parsed_response, error_code, error_message, created_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) returning *`,
      [
        result.id,
        result.taskId,
        result.workerId,
        result.status,
        result.durationMs,
        result.rawResponse,
        result.parsedResponse === null || result.parsedResponse === undefined
          ? null
          : JSON.stringify(result.parsedResponse),
        result.errorCode,
        result.errorMessage,
        result.createdAt,
      ],
    );
    return mapTaskResult(inserted.rows[0] as Row);
  }

  async listTaskResults(taskId: string): Promise<TaskResultRecord[]> {
    const result = await this.pool.query(
      'select * from task_results where task_id = $1 order by created_at desc',
      [taskId],
    );
    return result.rows.map(mapTaskResult);
  }

  // ── Statistics ────────────────────────────────────────────────────────────

  async createStatistics(record: StatisticsRecord): Promise<StatisticsRecord> {
    const result = await this.pool.query(
      `insert into server_statistics
        (id, source, retrieved_at, task_id, created_by, summary, servers, matches, players, notes, warnings, created_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11::jsonb,$12)
       returning *`,
      [
        record.id,
        record.source,
        record.retrievedAt,
        record.taskId,
        record.createdBy,
        JSON.stringify(record.summary),
        JSON.stringify(record.servers),
        JSON.stringify(record.matches),
        JSON.stringify(record.players),
        record.notes,
        JSON.stringify(record.warnings),
        record.createdAt,
      ],
    );
    return mapStatistics(result.rows[0] as Row);
  }

  async getLatestStatistics(): Promise<StatisticsRecord | null> {
    const result = await this.pool.query(
      'select * from server_statistics order by retrieved_at desc limit 1',
    );
    const row = result.rows[0];
    return row ? mapStatistics(row) : null;
  }

  async listStatistics(limit: number): Promise<StatisticsRecord[]> {
    const result = await this.pool.query(
      'select * from server_statistics order by retrieved_at desc limit $1',
      [Math.max(1, Math.min(limit, 365))],
    );
    return result.rows.map(mapStatistics);
  }

  async upsertPlayers(players: PlayerRecord[]): Promise<void> {
    if (players.length === 0) return;
    const chunkSize = 100;
    for (let start = 0; start < players.length; start += chunkSize) {
      const chunk = players.slice(start, start + chunkSize);
      const values: unknown[] = [];
      const placeholders = chunk.map((player) => {
        const base = values.length;
        values.push(
          player.id,
          player.externalId,
          player.displayName,
          player.platform,
          player.rank,
          player.status,
          player.source,
          player.lastSeenAt,
          player.updatedAt,
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
      });
      await this.pool.query(
        `insert into players
          (id, external_id, display_name, platform, "rank", status, source, last_seen_at, updated_at)
         values ${placeholders.join(', ')}
         on conflict (external_id) do update set
           display_name = excluded.display_name,
           platform = excluded.platform,
           "rank" = excluded."rank",
           status = excluded.status,
           source = excluded.source,
           last_seen_at = excluded.last_seen_at,
           updated_at = excluded.updated_at`,
        values,
      );
    }
  }

  async listPlayers(filter: PlayerFilter): Promise<{ items: PlayerRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }
    const search = filter.search?.trim();
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      conditions.push(`(lower(display_name) like $${values.length} or lower(external_id) like $${values.length})`);
    }
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    const totalResult = await this.pool.query<{ count: number }>(
      `select count(*)::int as count from players ${where}`,
      values,
    );

    const listValues = [...values, filter.limit, filter.offset];
    const result = await this.pool.query(
      `select * from players ${where}
       order by case status when 'online' then 0 when 'in-match' then 1 else 2 end,
                lower(display_name) asc
       limit $${listValues.length - 1} offset $${listValues.length}`,
      listValues,
    );

    return {
      items: result.rows.map(mapPlayer),
      total: totalResult.rows[0]?.count ?? 0,
    };
  }

  // ── Activity ──────────────────────────────────────────────────────────────

  async createLog(log: ActivityLogRecord): Promise<void> {
    await this.pool.query(
      `insert into activity_logs
        (id, actor_id, actor_email, action, category, target_type, target_id, description, metadata, ip, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
      [
        log.id,
        log.actorId,
        log.actorEmail,
        log.action,
        log.category,
        log.targetType,
        log.targetId,
        log.description,
        JSON.stringify(log.metadata),
        log.ip,
        log.createdAt,
      ],
    );
  }

  async listLogs(filter: LogFilter): Promise<{ items: ActivityLogRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.category) {
      values.push(filter.category);
      conditions.push(`category = $${values.length}`);
    }
    const search = filter.search?.trim();
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      conditions.push(
        `(lower(description) like $${values.length} or lower(action) like $${values.length} or lower(coalesce(actor_email, '')) like $${values.length})`,
      );
    }
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    const totalResult = await this.pool.query<{ count: number }>(
      `select count(*)::int as count from activity_logs ${where}`,
      values,
    );

    const listValues = [...values, filter.limit, filter.offset];
    const result = await this.pool.query(
      `select * from activity_logs ${where}
       order by created_at desc
       limit $${listValues.length - 1} offset $${listValues.length}`,
      listValues,
    );

    return {
      items: result.rows.map(mapLog),
      total: totalResult.rows[0]?.count ?? 0,
    };
  }

  // ── Workers ───────────────────────────────────────────────────────────────

  async upsertWorker(worker: WorkerStatusRecord): Promise<WorkerStatusRecord> {
    const result = await this.pool.query(
      `insert into worker_status
        (worker_id, hostname, platform, version, status, current_task_id, integration_mode,
         discord_connected, last_heartbeat_at, started_at, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       on conflict (worker_id) do update set
         hostname = excluded.hostname,
         platform = excluded.platform,
         version = excluded.version,
         status = excluded.status,
         current_task_id = excluded.current_task_id,
         integration_mode = excluded.integration_mode,
         discord_connected = excluded.discord_connected,
         last_heartbeat_at = excluded.last_heartbeat_at,
         metadata = excluded.metadata
       returning *`,
      [
        worker.workerId,
        worker.hostname,
        worker.platform,
        worker.version,
        worker.status,
        worker.currentTaskId,
        worker.integrationMode,
        worker.discordConnected,
        worker.lastHeartbeatAt,
        worker.startedAt,
        JSON.stringify(worker.metadata),
      ],
    );
    return mapWorker(result.rows[0] as Row);
  }

  async listWorkers(): Promise<WorkerStatusRecord[]> {
    const result = await this.pool.query('select * from worker_status order by last_heartbeat_at desc');
    return result.rows.map(mapWorker);
  }

  // ── API keys ──────────────────────────────────────────────────────────────

  async createApiKey(key: ApiKeyRecord): Promise<ApiKeyRecord> {
    const result = await this.pool.query(
      `insert into api_keys
        (id, name, prefix, key_hash, scopes, created_by, created_by_email, created_at, last_used_at, revoked_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        key.id,
        key.name,
        key.prefix,
        key.keyHash,
        key.scopes,
        key.createdBy,
        key.createdByEmail,
        key.createdAt,
        key.lastUsedAt,
        key.revokedAt,
      ],
    );
    return mapApiKey(result.rows[0] as Row);
  }

  async listApiKeys(): Promise<ApiKeyRecord[]> {
    const result = await this.pool.query('select * from api_keys order by created_at desc');
    return result.rows.map(mapApiKey);
  }

  async getApiKeyByHash(hash: string): Promise<ApiKeyRecord | null> {
    const result = await this.pool.query('select * from api_keys where key_hash = $1 limit 1', [hash]);
    const row = result.rows[0];
    return row ? mapApiKey(row) : null;
  }

  async touchApiKey(id: string, at: string): Promise<void> {
    await this.pool.query('update api_keys set last_used_at = $2 where id = $1', [id, at]);
  }

  async revokeApiKey(id: string, at: string): Promise<boolean> {
    const result = await this.pool.query(
      'update api_keys set revoked_at = $2 where id = $1 and revoked_at is null',
      [id, at],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings(): Promise<Record<string, unknown>> {
    const result = await this.pool.query<{ key: string; value: unknown }>(
      'select key, value from integration_settings',
    );
    return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  }

  async saveSettings(values: Record<string, unknown>, updatedBy: string | null): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const [key, value] of Object.entries(values)) {
        await client.query(
          `insert into integration_settings (key, value, updated_by, updated_at)
           values ($1, $2::jsonb, $3, now())
           on conflict (key) do update set value = excluded.value,
             updated_by = excluded.updated_by, updated_at = now()`,
          [key, JSON.stringify(value), updatedBy],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}
