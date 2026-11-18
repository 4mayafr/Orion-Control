import { recordActivity } from '@/lib/activity';
import { ApiError, errorResponse, json, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiUser('settings.manage');
    const { id } = await context.params;
    const store = await getStore();

    const revoked = await store.revokeApiKey(id, new Date().toISOString());
    if (!revoked) {
      throw new ApiError(404, 'API_KEY_NOT_FOUND', 'That key does not exist or is already revoked.');
    }

    await recordActivity({
      actor: { id: actor.id, email: actor.email },
      action: 'api_key.revoked',
      category: 'api_key',
      description: 'An API key was revoked.',
      targetType: 'api_key',
      targetId: id,
    });

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
