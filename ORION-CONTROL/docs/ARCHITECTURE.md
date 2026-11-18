# Architecture

ORION CONTROL is a monorepo with two independently running programs and one shared domain package.

```
apps/web      Next.js 15 App Router · React 19 · Tailwind · Recharts
apps/worker   Node.js 20+ · TypeScript · discord.js
packages/shared  Types, Zod schemas, permissions, simulated generator
database/migrations  PostgreSQL DDL
```

The website and worker share **contracts**, not code that requires a shared process. The worker is not a dependency of the website at runtime.

---

## 1. Component responsibilities

### Website (`apps/web`)

- Public landing page, sign-in and one-time bootstrap.
- Session cookies, operator accounts, roles and per-operator overrides.
- Dashboard read models (overview, statistics, players, tasks, logs).
- Task creation, claiming and result ingestion endpoints.
- Worker heartbeats and computed online/offline state.
- API key issuing/revocation.
- Activity auditing.
- Storage abstraction over PostgreSQL or a local JSON file.

### Worker (`apps/worker`)

- Validates its environment at startup.
- Connects to Discord (optional in mock mode).
- Validates that the configured channel belongs to the configured guild.
- Polls the claim endpoint on an interval.
- Executes one task at a time with a timeout.
- Parses Discord messages/embeds into validated domain objects.
- Submits results; spools them locally when the API is unreachable.
- Sends heartbeats so the site can show live worker state.

### Shared (`packages/shared`)

Single source of truth for:

- `Role`, `Permission`, `ROLE_PERMISSIONS`, `resolvePermissions`.
- `TaskStatus`, `TaskType`, task type metadata.
- Statistics schemas (`statisticsSnapshotSchema`, `playerDirectorySnapshotSchema`).
- Worker API request schemas (claim, heartbeat, result).
- Auth and operator input schemas.
- System settings defaults.
- Formatting helpers (UTC-deterministic) and the simulated data generator.

Because both sides validate with the same schemas, a malformed payload is rejected at the boundary rather than stored.

---

## 2. Request flows

### Task creation

```
Browser → POST /api/statistics/refresh (session cookie, same-origin)
       → requireApiUser('statistics.retrieve')
       → createTask(type, actor)            [dedupe: one active task per type]
       → INSERT background_tasks (queued)
       → 202 { task }
       → UI polls /api/tasks/:id every 2.5s
```

The browser never waits on Discord. Polling is used deliberately: it requires no extra infrastructure and works within Vercel's serverless model.

### Task execution

```
Worker → POST /api/worker/tasks/claim      (Bearer worker key)
       → reaper: expire stale queued/running tasks
       → UPDATE … WHERE status='queued' … FOR UPDATE SKIP LOCKED
       → 200 { task | null, pollAfterMs }
       → adapter.execute()
       → POST /api/worker/tasks/:id/result  { status, durationMs, raw, parsed, error }
       → validate ownership + running state
       → validate parsed payload
       → store statistics/players (when applicable)
       → update task + append task_results
       → 200 { status, retried, warnings }
```

### Heartbeats and offline state

```
Worker → POST /api/worker/heartbeat every 20s
Website → upsert worker_status.last_heartbeat_at
Dashboard → online = now - last_heartbeat_at <= workerOfflineAfterSeconds
```

Online status is **derived**, never stored as a flag. A crashed Chromebook therefore shows offline even if its last heartbeat said online.

---

## 3. Storage abstraction

`apps/web/lib/db/types.ts` defines the `Store` interface. Two drivers implement it:

| Driver | Use | Persistence |
| --- | --- | --- |
| `PostgresStore` | Production (Neon/Supabase/any Postgres 13+) | Durable, indexed, transactional |
| `FileStore` | Local development | JSON file, atomic write + rename, git-ignored |

`getStore()` selects the driver:

1. `ORION_STORAGE` override, if set.
2. `DATABASE_URL` present → PostgreSQL.
3. On Vercel in production without `DATABASE_URL` → throws with instructions (never silently uses an ephemeral disk).
4. Otherwise → file driver, which seeds 30 days of simulated history on first run.

The service layer (auth, tasks, statistics) depends only on `Store`. Adding another database means implementing one interface.

Records use ISO-8601 strings for timestamps, so API responses are JSON-safe without a separate DTO layer (secrets are stripped by `lib/dto.ts`).

> **File driver caveat:** the file driver keeps the document in process memory and writes the whole document on each change. Run exactly one website process against it. Several processes would overwrite each other's changes (last writer wins). This is why production uses PostgreSQL.

---

## 4. Database schema

```
users 1───n permissions
  │
  ├──1──n background_tasks 1───n task_results
  │             │
  │             └──1──n server_statistics (task_id, nullable)
  │
  ├──1──n activity_logs
  └──1──n api_keys

worker_status        (one row per worker id)
players              (unique external_id)
integration_settings (key → jsonb)
```

Notable constraints and indexes:

- `background_tasks_active_dedupe_idx`: partial unique index on `dedupe_key` where status is queued/running — database-level duplicate prevention.
- `background_tasks_status_created_idx`, `created_idx`, `type_idx`, `requested_by_idx`.
- `task_results_task_idx` for submission history.
- `server_statistics_retrieved_idx` for charts.
- `players_external_id_idx` (unique) and lowercase display-name index.
- `activity_logs_created_idx`, `(category, created_at)` and `(actor_id, created_at)`.
- `api_keys_key_hash_idx` (unique) and prefix index.
- `users_email_unique_idx` on `lower(email)`.

JSONB columns: task payload/parsed response, statistics summary/servers/matches/players/warnings, activity metadata, worker metadata, settings values.

Migrations live in `database/migrations`, applied exactly once and recorded in `schema_migrations`.

---

## 5. Task state machine

```
                 claim (attempts += 1)
   queued ─────────────────────────────▶ running
     │                                     │
     │                                     ├── completed  (valid parsed payload or no ingestion needed)
     │                                     ├── failed     (error, attempts exhausted)
     │                                     ├── queued     (retryable error, attempts remain)
     │                                     └── timed_out  (deadline exceeded/worker timeout)
     │
     └── queued past expiresAt ──▶ timed_out (TASK_EXPIRED)
```

Rules:

- `attempts` increments at claim time, so a worker crash still counts as an attempt.
- The reaper requeues a stale running task once when `attempts < max_attempts`, otherwise times it out.
- The worker reports `timed_out` when its local timeout fires first.
- Result acceptance requires `task.workerId === payload.workerId` and `task.status === 'running'`.
- Parsed results are validated before ingestion. Invalid payloads become `failed` with `UNPARSED_RESPONSE`, preserving the raw response.
- Ingestion for `statistics.retrieve` writes one `server_statistics` row and upserts players. Player directory tasks upsert players only.
- Manual retry resets attempts; cancellation is only allowed while queued (a running task may still be executing on the worker).

---

## 6. Authentication and authorisation

- **Session:** signed JWT (`jose`, HS256) in an HttpOnly, SameSite=Lax cookie; 8 hours; Secure in production.
- **Password:** bcrypt cost 12.
- **Middleware:** edge gate verifying the cookie signature and redirecting unauthenticated `/dashboard` requests. It is not the authorisation boundary.
- **Server checks:** `requirePageUser(permission)` and `requireApiUser(permission)` load the user, verify `status = active`, resolve role + overrides and check the required permission. Permissions are never trusted from the token.
- **Same-origin guard:** cookie-authenticated mutations reject a mismatched `Origin` header.
- **Worker keys:** 256-bit random keys, prefix retained, SHA-256 hash stored, `worker` scope required, revocation immediate, `last_used_at` updated.
- **Rate limits:** login (8 per 5 minutes per IP) and setup (5 per 10 minutes). Per-instance memory, documented as approximate.

Default role matrix (overridable per operator):

| Permission | Admin | Operator | Viewer |
| --- | :-: | :-: | :-: |
| dashboard.view | ✓ | ✓ | ✓ |
| statistics.view | ✓ | ✓ | ✓ |
| statistics.retrieve | ✓ | ✓ | |
| tasks.view | ✓ | ✓ | ✓ |
| tasks.create | ✓ | ✓ | |
| tasks.manage | ✓ | ✓ | |
| operators.view | ✓ | ✓ | |
| operators.manage | ✓ | | |
| station.create | ✓ | | |
| settings.manage | ✓ | | |

Overrides are stored as `(user_id, permission, granted)` and applied after the role defaults; the last override wins.

---

## 7. Data provenance and honesty

Every statistics snapshot has a source:

- `simulated` — mock adapter or seed script.
- `retrieved` — parsed from an authorised integration response.
- `unavailable` — absence of data, represented in the UI only.

Additional safeguards:

- The mock adapter sets `source: 'simulated'` and adds warnings; the seed script does the same.
- The website re-validates the parsed payload against the shared schema; source is part of the schema.
- The UI badges every value with its source and describes what the source means.
- If nothing is stored, a transient placeholder may be shown **only** when `allowSimulatedFallback` is enabled; it is labelled and never written to the database.
- Parser failures do not produce estimated values — they fail the task with the raw response preserved.

---

## 8. Discord integration design

`IntegrationAdapter` is the extension point:

```
IntegrationAdapter
├── MockIntegrationAdapter      (mode = mock)
└── ChannelRelayAdapter         (mode = channel)
```

- `MockIntegrationAdapter` returns simulated snapshots/directories/diagnostics with a small artificial latency.
- `ChannelRelayAdapter` validates the guild/channel, posts a marked request and waits for an authorised bot response, then parses it.
- `createIntegrationAdapter()` selects by `INTEGRATION_MODE`.

Adding a target with an official API means adding another adapter that returns the same `IntegrationResult`; the queue, website and UI need no changes. The adapter must never fabricate data: if the API is unavailable, it throws `IntegrationError` with a retryable flag and (optionally) a raw response.

Discord cannot execute another bot's slash commands; see [DISCORD.md](DISCORD.md).

---

## 9. Failure handling

| Failure | Behaviour |
| --- | --- |
| Website unreachable | Worker retries with exponential backoff, spools finished results to disk and replays them |
| Worker offline | Tasks stay queued; UI shows offline; tasks expire after 15 minutes |
| Worker killed mid-task | Server reaper requeues once after the timeout, then marks timed_out |
| Discord disconnect | Worker keeps heartbeating with `discordConnected=false`; library reconnects; task fails with a retryable code |
| Invalid worker key | 401; worker logs the rejection; operator rotates the key |
| Duplicate result | 409 TASK_NOT_RUNNING (not a 500); task data unchanged |
| Unparseable Discord reply | Task fails with `UNPARSED_RESPONSE`; raw message stored |
| Database unavailable | Dashboard shows a configuration panel; API returns 503 with instructions; no data loss because writes were never accepted |

---

## 10. Deliberate design decisions

- **Polling over websockets** — free Vercel, no extra service, robust across serverless instances.
- **Two storage drivers** — removes the database requirement for local exploration while keeping production persistent.
- **Relative imports inside `apps/web/lib`** — scripts run under `tsx` without path-alias configuration; UI components use the `@/` alias.
- **Compiled shared package** — avoids transpiling `node_modules` in the worker; the website's `prebuild` rebuilds it automatically.
- **No toast/modal library** — a small set of primitives keeps the dependency surface and bundle small.
- **UTC formatting everywhere** — deterministic server/client markup, no hydration mismatches.
- **No fake integrations** — the mock adapter is explicit, labelled and switchable.

---

## 11. Extension points

1. **New task type** — add it to `packages/shared/src/tasks.ts` (permission, timeout, attempts), implement it in the worker adapter, and ingestion in `apps/web/lib/tasks.ts` if it stores domain data.
2. **New integration** — implement `IntegrationAdapter`, register it in `integrations/index.ts`, add settings/env as needed.
3. **New statistics source** — produce a payload matching `statisticsSnapshotSchema`; the website handles persistence and display.
4. **New permission** — add to `PERMISSIONS`, role defaults, labels/groups, and guard the relevant page/route.
5. **New storage driver** — implement `Store` and select it in `lib/db/index.ts`.
