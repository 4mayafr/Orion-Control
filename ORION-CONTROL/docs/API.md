# HTTP API

Base URL: your deployment origin (or `http://localhost:3000`).

Two authentication schemes:

- **Session cookie** (`orion_session`) for operator/browser endpoints. Mutations require a same-origin `Origin` header when the browser sends one.
- **Worker bearer key** (`Authorization: Bearer orion_wk_…`) for `/api/worker/*`.

Errors use a consistent envelope:

```json
{ "error": { "code": "FORBIDDEN", "message": "…", "details": null } }
```

Common codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `VALIDATION_ERROR` (400), `RATE_LIMITED` (429), `STORAGE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).

---

## Authentication

### `POST /api/auth/login`

```json
{ "email": "admin@example.com", "password": "…" }
```

`200` sets the session cookie and returns `{ ok: true, redirectTo: "/dashboard" }`.
`401 INVALID_CREDENTIALS`, `403 ACCOUNT_SUSPENDED`, `429 RATE_LIMITED`.

### `POST /api/auth/logout`

Clears the cookie. Safe to call without a session.

### `GET /api/auth/session`

`200 { user: { id, name, email, role, permissions } | null }`.

### `POST /api/auth/setup`

First administrator only.

```json
{ "token": "INITIAL_ADMIN_SETUP_TOKEN", "name": "…", "email": "…", "password": "…" }
```

`201` creates an admin and signs in. `409 SETUP_COMPLETE`, `503 SETUP_DISABLED`, `401 INVALID_SETUP_TOKEN`.

### `POST /api/auth/password`

```json
{ "currentPassword": "…", "newPassword": "…" }
```

`200 { ok: true, note }`. Existing sessions stay valid until they expire.

---

## Dashboard data

### `GET /api/status`

Requires `dashboard.view`. Returns worker state, task counts, statistics source, storage driver and integration mode. `cache-control: no-store`.

### `GET /api/statistics?limit=30`

Requires `statistics.view`. Returns `latest`, `history`, `source`, `lastRetrievedAt`, `stale`, `notes`, `warnings`.

### `POST /api/statistics/refresh`

Requires `statistics.retrieve`. Creates (or reuses) one active `statistics.retrieve` task.

- `202 { task, duplicate: false, message }`
- `200 { task, duplicate: true, message }` when a task is already queued/running

### `GET /api/health`

Public. Returns `{ status, app, version, storage, persistentStorage, time }`. No configuration values.

---

## Background tasks

### `GET /api/tasks?status=&type=&limit=&offset=`

Requires `tasks.view`. Returns:

```json
{
  "items": [Task],
  "total": 12,
  "limit": 50,
  "offset": 0,
  "counts": { "queued": 1, "running": 0, "completed": 10, "failed": 1, "timed_out": 0 },
  "permissions": { "canCreate": true, "canManage": true }
}
```

### `POST /api/tasks`

Requires `tasks.create` **and** the task type's own permission.

```json
{ "type": "statistics.retrieve", "payload": {}, "dedupe": true }
```

`202` when created, `200` when an identical active task exists. `403` if the type requires a permission you lack.

Task types: `statistics.retrieve`, `players.retrieve`, `discord.channel_check`.

### `GET /api/tasks/:id`

Requires `tasks.view`. Returns `{ task, results, definition }`.

### `POST /api/tasks/:id/retry`

Requires `tasks.manage`. Terminal tasks only; resets attempts and re-queues. `409 TASK_ACTIVE` / `DUPLICATE_ACTIVE_TASK`.

### `POST /api/tasks/:id/cancel`

Requires `tasks.manage`. Queued tasks only. Marks the task `failed` with `CANCELLED_BY_OPERATOR`. Running tasks must finish or time out.

---

## Worker API

All endpoints require a bearer key with the `worker` scope. Keys are created at `/dashboard/api-keys`.

### `POST /api/worker/heartbeat`

```json
{
  "workerId": "chromebook-orion",
  "hostname": "penguin",
  "platform": "linux 6.1 (x64)",
  "version": "1.0.0",
  "currentTaskId": null,
  "integrationMode": "channel",
  "discordConnected": true,
  "uptimeSeconds": 120,
  "discordGuildName": "My Community",
  "discordChannelName": "orion-ops"
}
```

`200 { ok, serverTime, offlineAfterSeconds, queuedTasks }`.

### `POST /api/worker/tasks/claim`

```json
{ "workerId": "chromebook-orion", "version": "1.0.0", "integrationMode": "channel" }
```

`200`:

```json
{
  "task": {
    "id": "uuid",
    "type": "statistics.retrieve",
    "payload": {},
    "timeoutMs": 60000,
    "attempts": 1,
    "maxAttempts": 2,
    "createdAt": "…",
    "expiresAt": "…",
    "requestedByEmail": "admin@example.com"
  },
  "pollAfterMs": 2000,
  "serverTime": "…"
}
```

`task` is `null` when the queue is empty. Claiming is atomic: one task goes to exactly one worker.

### `POST /api/worker/tasks/:id/result`

```json
{
  "workerId": "chromebook-orion",
  "status": "completed",
  "durationMs": 842,
  "rawResponse": "…",
  "parsedResponse": { "source": "simulated", "…": "…" },
  "error": { "code": "RESPONSE_TIMEOUT", "message": "…", "retryable": true }
}
```

`status` is `completed`, `failed` or `timed_out`. `error` is only meaningful for failures.

Responses:

- `200 { ok: true, taskId, status, warnings, retried }`
- `404 TASK_NOT_FOUND`
- `409 TASK_OWNERSHIP_MISMATCH` — a different worker claimed it
- `409 TASK_NOT_RUNNING` — duplicate/late submission
- `400 VALIDATION_ERROR` — malformed payload

Parsed statistics are re-validated server-side; an invalid payload fails the task with `UNPARSED_RESPONSE` and keeps the raw response.

---

## Administration

### Operators

- `GET /api/operators` — `operators.view`
- `POST /api/operators` — `operators.manage`
  ```json
  { "name": "…", "email": "…", "password": "…", "role": "viewer" }
  ```
- `PATCH /api/operators/:id` — `operators.manage`
  ```json
  { "name": "…", "role": "operator", "status": "active", "password": "…", "permissions": [{ "permission": "tasks.manage", "granted": true }] }
  ```
- `DELETE /api/operators/:id` — `operators.manage`

Guards: last active admin, self-suspension, self-demotion and self-deletion return `409`.

### API keys

- `GET /api/api-keys` — `settings.manage`
- `POST /api/api-keys` — `settings.manage`
  ```json
  { "name": "Chromebook worker", "scopes": ["worker"] }
  ```
  `201 { apiKey, secret, warning }` — `secret` is returned exactly once.
- `DELETE /api/api-keys/:id` — revokes immediately.

### Settings

- `GET /api/settings` — `settings.manage`
- `PATCH /api/settings` — `settings.manage`

```json
{
  "workerOfflineAfterSeconds": 90,
  "defaultTaskTimeoutMs": 60000,
  "taskRetentionDays": 30,
  "integrationMode": "channel",
  "allowSimulatedFallback": true
}
```

---

## Maintenance

### `GET|POST /api/maintenance/reap`

Authorised by `Authorization: Bearer $CRON_SECRET`, by Vercel Cron when no secret is set, or by an administrator session.

Returns `{ ok, timedOut, requeued, serverTime }`. Called once daily by `apps/web/vercel.json`, and lazily by task endpoints.
