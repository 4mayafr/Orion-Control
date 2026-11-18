-- ============================================================================
-- ORION CONTROL — initial schema
-- ----------------------------------------------------------------------------
-- Target: PostgreSQL 13+ (Neon, Supabase or any hosted Postgres).
-- Apply with:  npm run db:migrate
-- The migration runner records applied files in schema_migrations and is safe
-- to run repeatedly.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Operators ───────────────────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text not null,
  password_hash text not null,
  role          text not null check (role in ('admin', 'operator', 'viewer')),
  status        text not null default 'active' check (status in ('active', 'suspended')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Case-insensitive uniqueness: emails are stored lower-cased by the app, the
-- index keeps direct database edits honest as well.
create unique index if not exists users_email_unique_idx on users (lower(email));

-- Per-operator permission overrides on top of the role defaults.
create table if not exists permissions (
  user_id    uuid not null references users (id) on delete cascade,
  permission  text not null,
  granted    boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

-- ── Background tasks ────────────────────────────────────────────────────────
create table if not exists background_tasks (
  id                uuid primary key default gen_random_uuid(),
  type              text not null,
  status            text not null default 'queued'
                    check (status in ('queued', 'running', 'completed', 'failed', 'timed_out')),
  requested_by      uuid references users (id) on delete set null,
  requested_by_email text,
  payload           jsonb not null default '{}'::jsonb,
  dedupe_key        text,
  priority          integer not null default 0,
  attempts          integer not null default 0,
  max_attempts      integer not null default 2,
  timeout_ms        integer not null default 60000,
  worker_id         text,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  duration_ms       integer,
  expires_at        timestamptz not null,
  error_code        text,
  error_message     text,
  raw_response      text,
  parsed_response   jsonb
);

-- Only one active task per dedupe key: prevents duplicate execution when two
-- operators (or double clicks) request the same operation.
create unique index if not exists background_tasks_active_dedupe_idx
  on background_tasks (dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running');

create index if not exists background_tasks_status_created_idx
  on background_tasks (status, created_at desc);
create index if not exists background_tasks_created_idx
  on background_tasks (created_at desc);
create index if not exists background_tasks_type_idx
  on background_tasks (type);
create index if not exists background_tasks_requested_by_idx
  on background_tasks (requested_by);

-- Immutable history of every worker submission, including retries.
create table if not exists task_results (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references background_tasks (id) on delete cascade,
  worker_id       text not null,
  status          text not null check (status in ('completed', 'failed', 'timed_out')),
  duration_ms     integer not null default 0,
  raw_response    text,
  parsed_response jsonb,
  error_code      text,
  error_message   text,
  created_at      timestamptz not null default now()
);

create index if not exists task_results_task_idx on task_results (task_id, created_at desc);

-- ── Statistics ──────────────────────────────────────────────────────────────
create table if not exists server_statistics (
  id           uuid primary key default gen_random_uuid(),
  source       text not null check (source in ('simulated', 'retrieved')),
  retrieved_at timestamptz not null,
  task_id      uuid references background_tasks (id) on delete set null,
  created_by   text,
  summary      jsonb not null,
  servers      jsonb not null default '[]'::jsonb,
  matches      jsonb not null default '[]'::jsonb,
  players      jsonb not null default '[]'::jsonb,
  notes        text,
  warnings     jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists server_statistics_retrieved_idx
  on server_statistics (retrieved_at desc);

create table if not exists players (
  id           uuid primary key default gen_random_uuid(),
  external_id  text not null,
  display_name text not null,
  platform     text,
  rank         text,
  status       text not null default 'offline'
               check (status in ('online', 'in-match', 'offline')),
  source       text not null check (source in ('simulated', 'retrieved')),
  last_seen_at timestamptz,
  updated_at   timestamptz not null default now()
);

create unique index if not exists players_external_id_idx on players (external_id);
create index if not exists players_status_idx on players (status);
create index if not exists players_display_name_idx on players (lower(display_name));

-- ── Activity log ────────────────────────────────────────────────────────────
create table if not exists activity_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references users (id) on delete set null,
  actor_email    text,
  action         text not null,
  category       text not null,
  target_type    text,
  target_id      text,
  description    text not null,
  metadata       jsonb not null default '{}'::jsonb,
  ip             text,
  created_at     timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on activity_logs (created_at desc);
create index if not exists activity_logs_category_idx on activity_logs (category, created_at desc);
create index if not exists activity_logs_actor_idx on activity_logs (actor_id, created_at desc);

-- ── Worker health ───────────────────────────────────────────────────────────
create table if not exists worker_status (
  worker_id          text primary key,
  hostname           text,
  platform           text,
  version            text,
  status             text not null default 'online' check (status in ('online', 'offline', 'degraded')),
  current_task_id    uuid,
  integration_mode   text,
  discord_connected  boolean,
  last_heartbeat_at  timestamptz not null default now(),
  started_at         timestamptz not null default now(),
  metadata           jsonb not null default '{}'::jsonb
);

-- ── API keys ────────────────────────────────────────────────────────────────
-- Only a SHA-256 hash of the key is stored. The plaintext key is shown once
-- when it is created and can never be recovered afterwards.
create table if not exists api_keys (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  prefix           text not null,
  key_hash         text not null,
  scopes           text[] not null default array[]::text[],
  created_by       uuid references users (id) on delete set null,
  created_by_email text,
  created_at       timestamptz not null default now(),
  last_used_at     timestamptz,
  revoked_at       timestamptz
);

create unique index if not exists api_keys_key_hash_idx on api_keys (key_hash);
create unique index if not exists api_keys_prefix_idx on api_keys (prefix);

-- ── Integration settings ────────────────────────────────────────────────────
create table if not exists integration_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- ── Migration bookkeeping ───────────────────────────────────────────────────
create table if not exists schema_migrations (
  id         text primary key,
  applied_at timestamptz not null default now()
);
