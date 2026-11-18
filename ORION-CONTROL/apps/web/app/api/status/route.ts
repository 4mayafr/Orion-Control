import { mergeSettings } from '@orion/shared';
import { errorResponse, json } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { getStorageInfo, getStore } from '@/lib/db';
import { getWorkerSummary } from '@/lib/worker-status';
import type { StatusResponse } from '@/lib/status-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser('dashboard.view');
    const store = await getStore();
    const [settingsRaw, counts, latest, storage] = await Promise.all([
      store.getSettings(),
      store.countTasksByStatus(),
      store.listStatistics(1),
      getStorageInfo(),
    ]);
    const settings = mergeSettings(settingsRaw);
    const workerSummary = await getWorkerSummary(store, settings);
    const primary = workerSummary.primary;
    const latestRecord = latest[0] ?? null;

    const body: StatusResponse = {
      serverTime: new Date().toISOString(),
      worker: {
        online: workerSummary.online,
        workerId: primary?.workerId ?? null,
        hostname: primary?.hostname ?? null,
        lastHeartbeatAt: primary?.lastHeartbeatAt ?? null,
        integrationMode: primary?.integrationMode ?? null,
        discordConnected: primary?.discordConnected ?? null,
        offlineAfterSeconds: settings.workerOfflineAfterSeconds,
        heartbeatAgeSeconds: primary?.heartbeatAgeSeconds ?? null,
      },
      tasks: {
        queued: counts.queued,
        running: counts.running,
        completed: counts.completed,
        failed: counts.failed,
        timed_out: counts.timed_out,
      },
      statistics: {
        source: latestRecord?.source ?? 'unavailable',
        lastRetrievedAt: latestRecord?.retrievedAt ?? null,
        stale:
          latestRecord !== null &&
          Date.now() - Date.parse(latestRecord.retrievedAt) > 24 * 60 * 60 * 1_000,
      },
      storage: { driver: storage.driver, label: storage.label, persistent: storage.persistent },
      integration: { mode: settings.integrationMode },
    };

    return json(body, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
