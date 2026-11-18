import { changePasswordSchema } from '@orion/shared';
import { recordActivity } from '@/lib/activity';
import { ApiError, errorResponse, json, parseJson, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { getStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireApiUser();
    const input = await parseJson(request, changePasswordSchema);

    const store = await getStore();
    const record = await store.getUserById(user.id);
    if (!record) throw new ApiError(404, 'OPERATOR_NOT_FOUND', 'Operator account not found.');

    const valid = await verifyPassword(input.currentPassword, record.passwordHash);
    if (!valid) {
      throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Your current password is incorrect.');
    }

    await store.updateUser(user.id, { passwordHash: await hashPassword(input.newPassword) });

    await recordActivity({
      actor: { id: user.id, email: user.email },
      action: 'auth.password_changed',
      category: 'auth',
      description: 'Password changed by the operator.',
    });

    return json({
      ok: true,
      note: 'Existing sessions remain valid until they expire (up to 8 hours).',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
