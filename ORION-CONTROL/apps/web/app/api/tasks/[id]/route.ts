import { TASK_TYPE_MAP } from '@orion/shared';
import { ApiError, errorResponse, json } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { getTaskDetail } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser('tasks.view');
    const { id } = await context.params;
    const detail = await getTaskDetail(id);
    if (!detail) throw new ApiError(404, 'TASK_NOT_FOUND', 'That task does not exist.');

    return json({
      task: detail.task,
      results: detail.results,
      definition: TASK_TYPE_MAP[detail.task.type] ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
