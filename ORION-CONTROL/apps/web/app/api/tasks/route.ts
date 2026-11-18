import {
  TASK_TYPE_MAP,
  isTaskType,
  taskCreateSchema,
  taskListQuerySchema,
  type TaskType,
} from '@orion/shared';
import { ApiError, errorResponse, json, parseJson, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { createTask, reapTasks } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser('tasks.view');
    const url = new URL(request.url);
    const parsed = taskListQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) {
      throw new ApiError(400, 'INVALID_QUERY', 'Invalid task filters.', parsed.error.flatten());
    }

    await reapTasks();
    const store = await getStore();
    const [result, counts] = await Promise.all([
      store.listTasks({
        status: parsed.data.status,
        type: parsed.data.type,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      }),
      store.countTasksByStatus(),
    ]);

    return json({
      items: result.items,
      total: result.total,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      counts,
      permissions: {
        canCreate: user.permissions.includes('tasks.create'),
        canManage: user.permissions.includes('tasks.manage'),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireApiUser('tasks.create');
    const input = await parseJson(request, taskCreateSchema);

    if (!isTaskType(input.type)) {
      throw new ApiError(400, 'UNKNOWN_TASK_TYPE', `Unknown task type "${input.type}".`);
    }
    const type: TaskType = input.type;
    const definition = TASK_TYPE_MAP[type];
    if (!definition) {
      throw new ApiError(400, 'UNKNOWN_TASK_TYPE', `Unknown task type "${type}".`);
    }
    if (!user.permissions.includes(definition.permission)) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        `Creating "${definition.label}" requires the "${definition.permission}" permission.`,
      );
    }

    const { task, duplicate } = await createTask({
      type,
      actor: { id: user.id, email: user.email },
      payload: input.payload,
      dedupe: input.dedupe,
    });

    return json({ task, duplicate }, { status: duplicate ? 200 : 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
