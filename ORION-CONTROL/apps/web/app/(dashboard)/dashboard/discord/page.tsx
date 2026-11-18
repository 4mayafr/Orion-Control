import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bot,
  ExternalLink,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wifi,
} from 'lucide-react';
import {
  INTEGRATION_MODE_LABELS,
  TASK_TYPE_MAP,
  formatDateTime,
  formatRelativeTime,
  mergeSettings,
  type IntegrationMode,
} from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { getWorkerSummary } from '@/lib/worker-status';
import { getTaskSummary } from '@/lib/tasks';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui/primitives';
import { TaskStatusBadge } from '@/components/tasks/task-status-badge';
import { DiscordCheckButton } from '@/components/discord/discord-check-button';

export const metadata: Metadata = { title: 'Discord Integration' };

const WORKER_VARIABLES = [
  { name: 'DISCORD_BOT_TOKEN', note: 'Bot token from the Discord Developer Portal (never stored in the cloud database).' },
  { name: 'DISCORD_GUILD_ID', note: 'Server that contains the private operations channel.' },
  { name: 'DISCORD_CHANNEL_ID', note: 'Private channel used for requests and responses; validated against the guild.' },
  { name: 'DISCORD_TARGET_BOT_ID', note: 'Optional. Restricts accepted responses to one authorised bot.' },
  { name: 'ORION_API_URL', note: 'Base URL of this website, e.g. https://your-project.vercel.app.' },
  { name: 'ORION_WORKER_KEY', note: 'Worker-scoped API key created on the API Keys page.' },
  { name: 'INTEGRATION_MODE', note: 'mock for simulated data, channel for the Discord relay adapter.' },
];

export default async function DiscordPage() {
  const user = await requirePageUser('statistics.view');
  const store = await getStore();
  const [worker, settingsRaw, taskSummary, recent] = await Promise.all([
    getWorkerSummary(),
    store.getSettings(),
    getTaskSummary(),
    store.listTasks({ limit: 30, offset: 0 }),
  ]);
  const settings = mergeSettings(settingsRaw);
  const mode: IntegrationMode = settings.integrationMode;
  const primary = worker.primary;
  const metadata = (primary?.metadata ?? {}) as Record<string, unknown>;
  const guildName = typeof metadata.discordGuildName === 'string' ? metadata.discordGuildName : null;
  const channelName =
    typeof metadata.discordChannelName === 'string' ? metadata.discordChannelName : null;

  const discordTasks = recent.items.filter(
    (task) => task.type.startsWith('discord.') || task.type.startsWith('statistics.'),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Integration"
        title="Discord integration"
        description="The worker connects to Discord, relays authorised requests through your private channel and submits parsed results to ORION CONTROL."
        actions={
          <DiscordCheckButton enabled={user.permissions.includes('settings.manage')} />
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Worker"
          value={worker.online ? 'Online' : 'Offline'}
          hint={
            primary ? `Last heartbeat ${formatRelativeTime(primary.lastHeartbeatAt)}` : 'Never connected'
          }
          icon={<Radio size={18} />}
          tone={worker.online ? 'success' : 'danger'}
        />
        <StatCard
          label="Discord connection"
          value={
            primary?.discordConnected === null || primary?.discordConnected === undefined
              ? 'Unknown'
              : primary.discordConnected
                ? 'Connected'
                : 'Disconnected'
          }
          hint="Reported by the worker on each heartbeat"
          icon={<Wifi size={18} />}
          tone={primary?.discordConnected ? 'success' : 'warning'}
        />
        <StatCard
          label="Integration mode"
          value={INTEGRATION_MODE_LABELS[mode]}
          hint="Configured in Settings and INTEGRATION_MODE"
          icon={<Bot size={18} />}
          tone="brand"
          badge={
            <Badge variant={mode === 'channel' ? 'success' : 'warning'}>
              {mode === 'channel' ? 'Live relay' : 'Simulated'}
            </Badge>
          }
        />
        <StatCard
          label="Discord tasks"
          value={discordTasks.length}
          hint={`${taskSummary.queued} queued · ${taskSummary.running} running overall`}
          icon={<Terminal size={18} />}
          tone="cyan"
        />
      </div>

      {!worker.online && (
        <Alert variant="warning" title="Worker offline" className="mb-4">
          The website remains fully available. Discord operations cannot run until the Chromebook worker
          starts and sends a heartbeat.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Resolved Discord target"
            description="Names reported by the worker. Raw IDs are never stored in the database."
            icon={<ShieldCheck size={16} />}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Guild', value: guildName },
                { label: 'Channel', value: channelName },
                { label: 'Worker', value: primary?.workerId ?? null },
                { label: 'Platform', value: primary?.platform ?? null },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-edge/70 bg-void-850/40 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">{row.label}</p>
                  <p className="mt-1 truncate text-[13px] text-slate-300">
                    {row.value ?? 'Not reported yet'}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[12px] leading-relaxed text-slate-500">
              The worker validates that <span className="mono text-slate-300">DISCORD_CHANNEL_ID</span>{' '}
              belongs to <span className="mono text-slate-300">DISCORD_GUILD_ID</span> before it posts
              anything. It reports only the resolved names, plus its heartbeat.
            </p>
            {primary && (
              <p className="text-[11px] text-slate-600">
                Last heartbeat {formatDateTime(primary.lastHeartbeatAt)} · version{' '}
                {primary.version ?? 'unknown'} · mode {primary.integrationMode ?? 'unknown'}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Configuration checklist"
            description="Worker environment variables"
            icon={<Terminal size={16} />}
          />
          <CardBody className="space-y-3">
            {WORKER_VARIABLES.map((variable) => (
              <div key={variable.name} className="rounded-lg border border-edge/60 bg-void-850/30 px-3 py-2">
                <p className="mono text-[11px] text-brand-200">{variable.name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{variable.note}</p>
              </div>
            ))}
            <p className="text-[11px] text-slate-600">
              Full setup walkthrough: <span className="mono text-slate-400">docs/DISCORD.md</span>
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 border-signal-warning/25">
        <CardHeader
          title="Bot-to-bot limitation — read before wiring a target bot"
          description="Why ORION CONTROL uses a relay adapter instead of invoking slash commands"
          icon={<ShieldAlert size={16} className="text-signal-warning" />}
          actions={<Badge variant="warning">Platform constraint</Badge>}
        />
        <CardBody className="space-y-3 text-[13px] leading-relaxed text-slate-400">
          <p>
            Discord does not allow a bot to invoke another bot&apos;s slash command. Interactions are
            created by human users; there is no supported API for bot-triggered application commands,
            and user-account automation (&quot;self-bots&quot;) violates the Discord Terms of Service.
            ORION CONTROL will never use token impersonation or self-bot automation.
          </p>
          <p>
            The worker therefore implements a <strong className="text-slate-200">channel relay</strong>:
            it posts a request into your private operations channel and parses the response posted
            there by an authorised integration bot (optionally restricted with{' '}
            <span className="mono text-slate-300">DISCORD_TARGET_BOT_ID</span>). This works when the
            target bot supports being relayed to, provides an official API or webhook, or you operate
            the relay yourself.
          </p>
          <p>
            If the target bot exposes none of those, automated retrieval is not possible. In that case
            the mock adapter keeps the pipeline testable and every result stays labelled Simulated.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="https://docs.discord.com/developers/interactions/application-commands"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-brand-300 hover:text-brand-200"
            >
              Discord application commands docs <ExternalLink size={12} />
            </a>
            <a
              href="https://docs.discord.com/developers/platform/bots"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-brand-300 hover:text-brand-200"
            >
              Discord bots platform docs <ExternalLink size={12} />
            </a>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Recent Discord operations"
          description="Statistics retrievals, player retrievals and channel diagnostics"
          icon={<Bot size={16} />}
          actions={
            <Link href="/dashboard/tasks" className="text-[11px] text-brand-300 hover:text-brand-200">
              All tasks
            </Link>
          }
        />
        {discordTasks.length === 0 ? (
          <EmptyState
            icon={<Bot size={18} />}
            title="No Discord tasks yet"
            description="Use “Retrieve statistics” on the statistics page, or run channel diagnostics above."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Duration</th>
                  <th>Worker</th>
                </tr>
              </thead>
              <tbody>
                {discordTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/dashboard/tasks/${task.id}`} className="block">
                        <span className="text-[13px] text-slate-200">
                          {TASK_TYPE_MAP[task.type]?.label ?? task.type}
                        </span>
                        <span className="mono block text-[10px] text-slate-600">
                          {task.id.slice(0, 8)}…
                        </span>
                      </Link>
                    </td>
                    <td>
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="text-[12px] text-slate-500">{formatRelativeTime(task.createdAt)}</td>
                    <td className="mono text-[12px] text-slate-400">
                      {task.durationMs === null ? '—' : `${Math.round(task.durationMs / 100) / 10}s`}
                    </td>
                    <td className="mono text-[11px] text-slate-500">{task.workerId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
