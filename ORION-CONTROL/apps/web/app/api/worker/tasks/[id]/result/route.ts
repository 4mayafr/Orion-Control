import { workerResultSchema } from '@orion/shared';
import { authenticateWorker } from '@/lib/api-keys';
import { errorResponse, json, parseJson } from '@/lib/api';
import { submitTaskResult } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worker/tasks/:id/result
 *
 * Only the worker that claimed the task can submit, and only while it is
 * running. The endpoint validates the parsed payload against the statistics
 * schema before anything is stored as retrieved data.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await authenticateWorker(request);
    const { id } = await context.params;
    const input = await parseJson(request, workerResultSchema);

    // Task ownership (task.workerId === input.workerId) is enforced inside
    // submitTaskResult, against the stored task row.
    const outcome = await submitTaskResult(id, input.workerId, input);

    return json({
      ok: true,
      taskId: id,
      status: outcome.task.status,
      warnings: outcome.warnings,
      retried: outcome.retried,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
