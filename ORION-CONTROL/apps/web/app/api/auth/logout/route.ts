import { recordActivity } from '@/lib/activity';
import { errorResponse, json, requireSameOrigin } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/current-user';
import { clearedSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await getCurrentUser().catch(() => null);

    if (user) {
      await recordActivity({
        actor: { id: user.id, email: user.email },
        action: 'auth.logout',
        category: 'auth',
        description: `${user.name} signed out.`,
      });
    }

    const response = json({ ok: true });
    response.cookies.set(clearedSessionCookie());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
