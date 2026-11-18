import { randomUUID, timingSafeEqual } from 'node:crypto';
import { setupSchema } from '@orion/shared';
import { recordActivity } from '@/lib/activity';
import {
  ApiError,
  errorResponse,
  getClientIp,
  json,
  parseJson,
  requireSameOrigin,
  storageAwareErrorResponse,
} from '@/lib/api';
import { hashPassword } from '@/lib/auth/password';
import { createSessionToken, sessionCookie } from '@/lib/auth/session';
import { getStore } from '@/lib/db';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const ip = getClientIp(request);

    const limit = rateLimit(`setup:${ip ?? 'unknown'}`, 10 * 60 * 1_000, 5);
    if (!limit.ok) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many setup attempts. Wait a few minutes.');
    }

    const configuredToken = env.setupToken;
    if (!configuredToken) {
      throw new ApiError(
        503,
        'SETUP_DISABLED',
        'Initial setup is disabled because INITIAL_ADMIN_SETUP_TOKEN is not set on the server.',
      );
    }

    const store = await getStore();
    if ((await store.countUsers()) > 0) {
      throw new ApiError(409, 'SETUP_COMPLETE', 'An operator account already exists. Use the sign-in page.');
    }

    const input = await parseJson(request, setupSchema);
    if (!safeEqual(input.token, configuredToken)) {
      await recordActivity({
        action: 'auth.setup_failed',
        category: 'auth',
        description: 'Setup rejected: invalid setup token.',
        ip,
      });
      throw new ApiError(401, 'INVALID_SETUP_TOKEN', 'The setup token is incorrect.');
    }

    const now = new Date().toISOString();
    const user = await store.createUser({
      id: randomUUID(),
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: 'admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });
    await store.setUserPermissions(user.id, []);

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await recordActivity({
      actor: { id: user.id, email: user.email },
      action: 'auth.setup_completed',
      category: 'auth',
      description: 'Initial administrator account created.',
      targetType: 'user',
      targetId: user.id,
      ip,
    });

    const response = json({ ok: true, redirectTo: '/dashboard' }, { status: 201 });
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return storageAwareErrorResponse(error);
  }
}
