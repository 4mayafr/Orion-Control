import { claimRequestSchema } from '@orion/shared';
import { authenticateWorker } from '@/lib/api-keys';
import { errorResponse, json, parseJson } from '@/lib/api';
import { claimNextTask, reapTasks } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worker/tasks/claim
 *
 * The worker polls this endpoint. Claiming is atomic: when two workers poll
 * simultaneously, Postgres `for update skip locked` gives the task to exactly
 * one of them.
 */
export async function POST(request: Request) {
  try {
    const { store } = await authenticateWorker(request);
    const input = await parseJson(request, claimRequestSchema);

    await reapTasks(store);
    const task = await claimNextTask(input.workerId);

    return json({
      task,
      pollAfterMs: 2_000,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
