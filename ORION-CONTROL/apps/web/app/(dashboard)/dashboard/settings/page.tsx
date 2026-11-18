import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, HardDrive, Radio, Server, ShieldCheck } from 'lucide-react';
import { INTEGRATION_MODE_LABELS, ROLE_LABELS, formatDateTime } from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStorageInfo, getStore } from '@/lib/db';
import { getWorkerSummary } from '@/lib/worker-status';
import { APP_VERSION } from '@/lib/brand';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  MetaItem,
  PageHeader,
} from '@/components/ui/primitives';
import { SettingsForm } from '@/components/settings/settings-form';
import { ChangePasswordForm } from '@/components/settings/change-password-form';
import { mergeSettings } from '@orion/shared';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requirePageUser('settings.manage');
  const store = await getStore();
  const [settingsRaw, storage, worker] = await Promise.all([
    store.getSettings(),
    getStorageInfo(),
    getWorkerSummary(),
  ]);
  const settings = mergeSettings(settingsRaw);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Operational thresholds, integration mode, storage health and your own account security."
      />

      {!storage.persistent && (
        <Alert variant="warning" title="Using local file storage" className="mb-4">
          This installation is writing to <span className="mono">apps/web/.data/orion.json</span>. That is
          convenient locally, but Vercel&apos;s filesystem is ephemeral. Configure{' '}
          <span className="mono">DATABASE_URL</span> before deploying. See docs/DEPLOYMENT.md.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <SettingsForm initial={settings} />
          <ChangePasswordForm />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Runtime environment" icon={<Server size={16} />} />
            <CardBody className="grid grid-cols-2 gap-4">
              <MetaItem label="Application" value={`ORION CONTROL v${APP_VERSION}`} />
              <MetaItem label="Operator" value={`${user.name} (${ROLE_LABELS[user.role]})`} />
              <MetaItem label="Storage driver" value={storage.label} />
              <MetaItem
                label="Persistence"
                value={
                  storage.persistent ? (
                    <span className="text-signal-success">Persistent</span>
                  ) : (
                    <span className="text-signal-warning">Local only</span>
                  )
                }
              />
              <MetaItem label="Integration mode" value={INTEGRATION_MODE_LABELS[settings.integrationMode]} />
              <MetaItem label="Worker" value={worker.online ? 'Online' : 'Offline'} />
              <MetaItem
                label="Session length"
                value="8 hours (signed HttpOnly cookie)"
              />
              <MetaItem
                label="Worker key"
                value={<Link href="/dashboard/api-keys" className="text-brand-300 hover:text-brand-200">Manage keys</Link>}
              />
            </CardBody>
            <div className="border-t border-edge/60 px-5 py-3">
              <p className="text-[11px] leading-relaxed text-slate-600">{storage.detail}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Component health" icon={<Radio size={16} />} />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-slate-400">
                  <Database size={13} className="text-brand-300" /> Database
                </span>
                <Badge variant={storage.persistent ? 'success' : 'warning'} dot>
                  {storage.persistent ? 'PostgreSQL' : 'Local file'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-slate-400">
                  <HardDrive size={13} className="text-cyber-300" /> Worker heartbeat
                </span>
                <span className="text-slate-300">
                  {worker.primary ? formatDateTime(worker.primary.lastHeartbeatAt) : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck size={13} className="text-signal-success" /> Permissions
                </span>
                <span className="text-slate-300">Enforced server-side</span>
              </div>
              <div className="divider" />
              <p className="text-[11px] leading-relaxed text-slate-600">
                Public health probe:{' '}
                <Link href="/api/health" className="mono text-brand-300 hover:text-brand-200">
                  /api/health
                </Link>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Deployment reminders" />
            <CardBody className="space-y-2 text-[12px] leading-relaxed text-slate-500">
              <p>• Set DATABASE_URL and SESSION_SECRET on Vercel before the first production visit.</p>
              <p>• Run npm run db:migrate against the production database.</p>
              <p>• Configure the worker with a worker-scoped API key and the production URL.</p>
              <p>• Keep the Discord bot token only on the Chromebook.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
