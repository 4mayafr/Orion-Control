/**
 * Worker health.
 *
 * Status is derived from the most recent heartbeat, never from a stored "online"
 * flag: a crashed Chromebook must show as offline even though its last heartbeat
 * said online.
 */

import { mergeSettings, type SystemSettings } from '@orion/shared';
import { getStore } from './db/index';
import type { Store, WorkerStatusRecord } from './db/types';

export interface WorkerView extends WorkerStatusRecord {
  online: boolean;
  heartbeatAgeSeconds: number | null;
}

export interface WorkerSummary {
  offlineAfterSeconds: number;
  workers: WorkerView[];
  primary: WorkerView | null;
  online: boolean;
  anyDiscordDisconnected: boolean;
}

export function toWorkerView(
  worker: WorkerStatusRecord,
  offlineAfterSeconds: number,
  now: number = Date.now(),
): WorkerView {
  const heartbeat = Date.parse(worker.lastHeartbeatAt);
  const ageSeconds = Number.isNaN(heartbeat) ? null : Math.max(0, Math.round((now - heartbeat) / 1_000));
  const online = ageSeconds !== null && ageSeconds <= offlineAfterSeconds;
  return { ...worker, online, heartbeatAgeSeconds: ageSeconds };
}

export async function getWorkerSummary(
  store?: Store,
  settings?: SystemSettings,
): Promise<WorkerSummary> {
  const db = store ?? (await getStore());
  const resolvedSettings = settings ?? mergeSettings(await db.getSettings());
  const offlineAfterSeconds = resolvedSettings.workerOfflineAfterSeconds;
  const records = await db.listWorkers();
  const workers = records.map((record) => toWorkerView(record, offlineAfterSeconds));
  const primary = workers[0] ?? null;
  return {
    offlineAfterSeconds,
    workers,
    primary,
    online: workers.some((worker) => worker.online),
    anyDiscordDisconnected: workers.some((worker) => worker.online && worker.discordConnected === false),
  };
}
