import { errorResponse, json, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { retryTask } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireApiUser('tasks.manage');
    const { id } = await context.params;
    const task = await retryTask(id, { id: user.id, email: user.email });
    return json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}
