# Deployment

Target arrangement:

- **Website:** Vercel Hobby (free), `*.vercel.app` subdomain, HTTPS.
- **Database:** free hosted PostgreSQL — Neon (recommended) or Supabase.
- **Worker:** Node.js on the Chromebook's Linux container.

Nothing here requires a paid plan. Read the free-tier caveats at the end.

---

## 1. Create the database

### Neon (recommended)

1. Sign up at <https://neon.tech> and create a project in the region closest to you.
2. Open **Connection Details** and copy the **pooled** connection string (its host contains `-pooler`).
3. Keep `sslmode=require` in the URL. The application enables TLS automatically for non-local hosts.

### Supabase (alternative)

1. Create a project at <https://supabase.com>.
2. **Project Settings → Database → Connection string → URI**.
3. Use the **pooler** connection string (port `6543`) for serverless deployments.

### Apply the schema

Temporarily put the connection string in `apps/web/.env.local`:

```dotenv
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
```

Then:

```bash
npm run db:migrate
```

Expected output lists `0001_init.sql applied`. Re-running is safe.

Optional simulated history (clearly labelled):

```bash
npm run db:seed
```

Remove the production connection string from your local env file afterwards.

---

## 2. Vercel project

### Import

1. Push the repository to GitHub (see README step 4).
2. Vercel → **Add New → Project → Import Git Repository**.
3. **Root Directory:** `apps/web`.
4. Framework preset: **Next.js**.
5. Build command: `npm run build` (the website's `prebuild` compiles `@orion/shared` first).
6. Install command: leave default. Vercel installs from the repository root, which is required for npm workspaces.
7. Deploy.

### Environment variables

Project → **Settings → Environment Variables** (Production, and Preview if you use it):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL URL |
| `SESSION_SECRET` | 48 random bytes, base64url (≥ 32 chars) |
| `INITIAL_ADMIN_SETUP_TOKEN` | One-time bootstrap secret |
| `CRON_SECRET` | Random secret used by Vercel Cron for `/api/maintenance/reap` |
| `NEXT_PUBLIC_APP_NAME` | Optional display name |

Generate secrets locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Do not add Discord variables to Vercel. The bot token belongs only on the Chromebook.

Redeploy after adding variables.

### Cron

`apps/web/vercel.json` schedules `/api/maintenance/reap` once per day at 04:00 UTC. Vercel Hobby allows only daily crons. Expired tasks are also reaped lazily whenever the task list, claim or status endpoints run, so the daily job is only a safety net.

If `CRON_SECRET` is set, Vercel sends it as `Authorization: Bearer <secret>`; the endpoint also accepts a signed-in administrator's session.

### First administrator

Open `https://<project>.vercel.app/setup`, paste `INITIAL_ADMIN_SETUP_TOKEN`, and create the account. Setup automatically disables once an operator exists.

After creating the administrator, **remove `INITIAL_ADMIN_SETUP_TOKEN`** from the Vercel environment variables (and from local env files) and redeploy. The endpoint already refuses to run once an operator exists, but leaving the token configured is unnecessary risk.

Then:

1. **API Keys → Create worker key** (scope `worker`).
2. Copy the key; it will not be shown again.
3. **Settings** — adjust the offline threshold and integration mode if needed.

---

## 3. Chromebook worker

### Prerequisites

In the ChromeOS Linux terminal:

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # 20.x or newer
```

(`nvm` works equally well if you prefer per-user installs.)

### Install

```bash
git clone https://github.com/<you>/orion-control.git
cd orion-control
npm install
cp apps/worker/.env.example apps/worker/.env
```

Edit `apps/worker/.env`:

```dotenv
ORION_API_URL=https://<project>.vercel.app
ORION_WORKER_KEY=orion_wk_…
WORKER_ID=chromebook-orion
INTEGRATION_MODE=channel

DISCORD_BOT_TOKEN=…
DISCORD_GUILD_ID=…
DISCORD_CHANNEL_ID=…
# Optional: restrict accepted responses to one bot
DISCORD_TARGET_BOT_ID=

DISCORD_TASK_TIMEOUT=60000
DISCORD_TASK_POLL_INTERVAL=2000
HEARTBEAT_INTERVAL_MS=20000
LOG_LEVEL=info
```

Start in mock mode first to prove connectivity, then switch to `channel` once Discord is configured (see [DISCORD.md](DISCORD.md)).

### Run

Development:

```bash
npm run dev:worker
```

Stable compiled run:

```bash
npm run build --workspace @orion/worker
npm run start --workspace @orion/worker
```

Long-running in the background:

```bash
nohup npm run start --workspace @orion/worker > worker.log 2>&1 &
tail -f worker.log
```

ChromeOS suspends the Linux container when the Chromebook sleeps, so the worker stops. The website stays online and marks it offline; restart the worker afterwards. Do not expose any port — the worker only makes outbound HTTPS requests.

---

## 4. Verification checklist

After deployment, verify each item:

- [ ] `GET /api/health` returns `status: "ok"` with `storage: "postgres"` and `persistentStorage: true`.
- [ ] Signed-out navigation to `/dashboard` redirects to `/login`.
- [ ] Wrong password is rejected; 9 rapid attempts return `429`.
- [ ] Setup page redirects to `/login` once an administrator exists.
- [ ] Non-admin operator cannot open `/dashboard/api-keys` (redirect with a permission notice) or call `POST /api/settings` (403).
- [ ] Worker shows online within ~20 seconds of starting.
- [ ] **Retrieve statistics** completes and the new snapshot appears with the correct source badge.
- [ ] Task detail shows raw and parsed responses.
- [ ] Stopping the worker leaves the site usable and shows the worker offline; a new task stays queued.
- [ ] Revoking the worker key makes the worker log `401` responses; a new key restores operation.
- [ ] Activity logs contain sign-in, task creation and worker submission entries.
- [ ] Worker log contains no bot token or API key.

---

## 5. Free-tier limits

| Service | Limits that matter |
| --- | --- |
| Vercel Hobby | One cron execution per day; no commercial use; serverless function duration limits; cold starts |
| Neon Free | Storage and compute-hour caps; scale-to-zero means the first query after idle may be slower |
| Supabase Free | 500 MB database; projects can be paused after inactivity (unpause in the dashboard) |
| Discord | API rate limits; the worker executes sequentially |
| Chromebook | Must be awake and online for tasks |

The design keeps the website independent of all worker-side limits: if the worker or Discord is unavailable, the site still serves dashboards and task history.

---

## 6. Updating the deployment

1. Push to GitHub.
2. Vercel redeploys automatically.
3. On the Chromebook:

```bash
cd orion-control
git pull
npm install
npm run build --workspace @orion/worker
# restart the worker process
```

If you added a migration, run `npm run db:migrate` with the production `DATABASE_URL` before deploying code that depends on it.

---

## 7. Security checklist

- [ ] `SESSION_SECRET` is unique per environment and at least 32 characters.
- [ ] `INITIAL_ADMIN_SETUP_TOKEN` was random and is not committed.
- [ ] `.env`, `.env.local`, `apps/worker/.env` and `.data/` are ignored by Git.
- [ ] Database connection string includes TLS; never commit it.
- [ ] Discord token exists only in `apps/worker/.env`.
- [ ] Worker API key is worker-scoped and rotated if the machine is lost.
- [ ] All operators use individual accounts (no shared logins).
- [ ] `CRON_SECRET` is set in production.
- [ ] Verify `/api/health` and a signed-out `/dashboard` redirect after each deployment.
