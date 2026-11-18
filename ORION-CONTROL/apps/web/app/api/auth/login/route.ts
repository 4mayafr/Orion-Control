import { loginRateLimit, loginSchema } from '@orion/shared';
import { recordActivity } from '@/lib/activity';
import {
  ApiError,
  errorResponse,
  getClientIp,
  parseJson,
  requireSameOrigin,
  storageAwareErrorResponse,
} from '@/lib/api';
import { verifyPassword, fakeVerify } from '@/lib/auth/password';
import { createSessionToken, sessionCookie } from '@/lib/auth/session';
import { getStore } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const ip = getClientIp(request);
    const limit = rateLimit(
      `login:${ip ?? 'unknown'}`,
      loginRateLimit.windowMs,
      loginRateLimit.maxAttempts,
    );
    if (!limit.ok) {
      throw new ApiError(
        429,
        'RATE_LIMITED',
        `Too many sign-in attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
      );
    }

    const input = await parseJson(request, loginSchema);
    const store = await getStore();
    const user = await store.getUserByEmail(input.email);

    if (!user) {
      await fakeVerify(input.password);
      await recordActivity({
        action: 'auth.login_failed',
        category: 'auth',
        description: `Failed sign-in for unknown account ${input.email}.`,
        ip,
      });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    if (user.status !== 'active') {
      await recordActivity({
        actor: { id: user.id, email: user.email },
        action: 'auth.login_blocked',
        category: 'auth',
        description: 'Sign-in blocked because the operator account is suspended.',
        ip,
      });
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This operator account is suspended.');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await recordActivity({
        actor: { id: user.id, email: user.email },
        action: 'auth.login_failed',
        category: 'auth',
        description: 'Failed sign-in: incorrect password.',
        ip,
      });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    await recordActivity({
      actor: { id: user.id, email: user.email },
      action: 'auth.login_succeeded',
      category: 'auth',
      description: `${user.name} signed in.`,
      ip,
    });

    const response = json({ ok: true, redirectTo: '/dashboard' });
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return storageAwareErrorResponse(error);
  }
}
