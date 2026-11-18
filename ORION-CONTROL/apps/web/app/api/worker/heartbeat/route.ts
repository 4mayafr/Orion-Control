import { heartbeatRequestSchema, mergeSettings } from '@orion/shared';
import { authenticateWorker } from '@/lib/api-keys';
import { errorResponse, json, parseJson } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worker/heartbeat
 *
 * Authenticated with a worker API key. Records the worker's liveness and
 * reported state. Heartbeats are the only source of worker online status.
 */
export async function POST(request: Request) {
  try {
    const { store } = await authenticateWorker(request);
    const input = await parseJson(request, heartbeatRequestSchema);
    const now = new Date().toISOString();

    await store.upsertWorker({
      workerId: input.workerId,
      hostname: input.hostname ?? null,
      platform: input.platform ?? null,
      version: input.version ?? null,
      status: input.discordConnected === false ? 'degraded' : 'online',
      currentTaskId: input.currentTaskId ?? null,
      integrationMode: input.integrationMode ?? null,
      discordConnected: input.discordConnected ?? null,
      lastHeartbeatAt: now,
      startedAt: now,
      metadata: {
        uptimeSeconds: input.uptimeSeconds ?? null,
        note: input.note ?? null,
        discordGuildName: input.discordGuildName ?? null,
        discordChannelName: input.discordChannelName ?? null,
      },
    });

    const [counts, settings] = await Promise.all([store.countTasksByStatus(), store.getSettings()]);
    const merged = mergeSettings(settings);

    return json({
      ok: true,
      serverTime: now,
      offlineAfterSeconds: merged.workerOfflineAfterSeconds,
      queuedTasks: counts.queued,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
