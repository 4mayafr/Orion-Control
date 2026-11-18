import { errorResponse, json, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { createTask } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/statistics/refresh
 *
 * Creates a background task. It returns immediately — the request never waits
 * for the worker, which is the whole point of the queue.
 */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireApiUser('statistics.retrieve');

    const { task, duplicate } = await createTask({
      type: 'statistics.retrieve',
      actor: { id: user.id, email: user.email },
      payload: { requestedFrom: 'statistics-page' },
      dedupe: true,
    });

    return json(
      {
        task,
        duplicate,
        message: duplicate
          ? 'A retrieval is already queued or running. Reusing that task.'
          : 'Retrieval queued. The worker will claim it on its next poll.',
      },
      { status: duplicate ? 200 : 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
