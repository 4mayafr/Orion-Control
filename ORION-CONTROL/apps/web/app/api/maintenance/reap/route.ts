import { errorResponse, json } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/current-user';
import { env } from '@/lib/env';
import { reapTasks } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(request: Request): Promise<boolean> {
  const secret = env.cronSecret;
  const header = request.headers.get('authorization') ?? '';

  if (secret && header === `Bearer ${secret}`) return true;

  // Vercel Cron requests identify themselves with this user agent. When
  // CRON_SECRET is configured, Vercel also sends it as a bearer token above.
  if (!secret && (request.headers.get('user-agent') ?? '').includes('vercel-cron')) return true;

  // Administrators can trigger maintenance manually from a signed-in browser.
  const user = await getCurrentUser().catch(() => null);
  return Boolean(user?.permissions.includes('settings.manage'));
}

export async function GET(request: Request) {
  try {
    if (!(await authorize(request))) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Not authorised.' } }, { status: 401 });
    }
    const result = await reapTasks();
    return json({ ok: true, ...result, serverTime: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = GET;
