import { operatorUpdateSchema, resolvePermissions } from '@orion/shared';
import { recordActivity } from '@/lib/activity';
import { ApiError, errorResponse, json, parseJson, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { hashPassword } from '@/lib/auth/password';
import { getStore } from '@/lib/db';
import { toUserDTO } from '@/lib/dto';
import type { Store } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function activeAdminsExcluding(store: Store, userId: string): Promise<number> {
  const users = await store.listUsers();
  return users.filter(
    (user) => user.role === 'admin' && user.status === 'active' && user.id !== userId,
  ).length;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiUser('operators.manage');
    const { id } = await context.params;
    const input = await parseJson(request, operatorUpdateSchema);
    const store = await getStore();

    const target = await store.getUserById(id);
    if (!target) throw new ApiError(404, 'OPERATOR_NOT_FOUND', 'That operator does not exist.');

    const removingAdminAccess =
      (input.role !== undefined && input.role !== 'admin' && target.role === 'admin') ||
      (input.status === 'suspended' && target.role === 'admin' && target.status === 'active');

    if (removingAdminAccess && (await activeAdminsExcluding(store, target.id)) === 0) {
      throw new ApiError(
        409,
        'LAST_ADMIN',
        'This is the last active administrator. Promote another operator before changing this account.',
      );
    }
    if (target.id === actor.id && input.status === 'suspended') {
      throw new ApiError(409, 'CANNOT_SUSPEND_SELF', 'You cannot suspend your own account.');
    }
    if (target.id === actor.id && input.role !== undefined && input.role !== 'admin') {
      throw new ApiError(409, 'CANNOT_DEMOTE_SELF', 'You cannot remove your own administrator role.');
    }

    const updated = await store.updateUser(id, {
      name: input.name,
      role: input.role,
      status: input.status,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
    });
    if (!updated) throw new ApiError(404, 'OPERATOR_NOT_FOUND', 'That operator does not exist.');

    if (input.permissions) {
      await store.setUserPermissions(id, input.permissions);
    }

    const overrides = await store.getUserPermissions(id);
    const permissions = resolvePermissions(updated.role, overrides);

    await recordActivity({
      actor: { id: actor.id, email: actor.email },
      action: 'operator.updated',
      category: 'operator',
      description: `Operator ${updated.email} updated.`,
      targetType: 'user',
      targetId: updated.id,
      metadata: {
        role: updated.role,
        status: updated.status,
        permissionsChanged: Boolean(input.permissions),
        passwordReset: Boolean(input.password),
      },
    });

    return json({ user: toUserDTO(updated, permissions, overrides) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiUser('operators.manage');
    const { id } = await context.params;
    const store = await getStore();

    const target = await store.getUserById(id);
    if (!target) throw new ApiError(404, 'OPERATOR_NOT_FOUND', 'That operator does not exist.');
    if (target.id === actor.id) {
      throw new ApiError(409, 'CANNOT_DELETE_SELF', 'You cannot delete your own account.');
    }
    if (target.role === 'admin' && (await activeAdminsExcluding(store, target.id)) === 0) {
      throw new ApiError(409, 'LAST_ADMIN', 'You cannot delete the last active administrator.');
    }

    await store.deleteUser(id);

    await recordActivity({
      actor: { id: actor.id, email: actor.email },
      action: 'operator.deleted',
      category: 'operator',
      description: `Operator ${target.email} deleted.`,
      targetType: 'user',
      targetId: id,
    });

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
