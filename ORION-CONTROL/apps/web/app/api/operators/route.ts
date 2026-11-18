import { randomUUID } from 'node:crypto';
import { operatorCreateSchema, resolvePermissions } from '@orion/shared';
import { recordActivity } from '@/lib/activity';
import { ApiError, errorResponse, json, parseJson, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { hashPassword } from '@/lib/auth/password';
import { getStore } from '@/lib/db';
import { toUserDTO } from '@/lib/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser('operators.view');
    const store = await getStore();
    const users = await store.listUsers();
    const items = await Promise.all(
      users.map(async (user) => {
        const overrides = await store.getUserPermissions(user.id);
        return toUserDTO(user, resolvePermissions(user.role, overrides), overrides);
      }),
    );
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiUser('operators.manage');
    const input = await parseJson(request, operatorCreateSchema);
    const store = await getStore();

    const existing = await store.getUserByEmail(input.email);
    if (existing) {
      throw new ApiError(409, 'EMAIL_IN_USE', 'An operator with that email already exists.');
    }

    const now = new Date().toISOString();
    const user = await store.createUser({
      id: randomUUID(),
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    await store.setUserPermissions(user.id, []);

    await recordActivity({
      actor: { id: actor.id, email: actor.email },
      action: 'operator.created',
      category: 'operator',
      description: `Operator ${user.email} created with role ${user.role}.`,
      targetType: 'user',
      targetId: user.id,
    });

    return json(
      { user: toUserDTO(user, resolvePermissions(user.role, []), []) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
