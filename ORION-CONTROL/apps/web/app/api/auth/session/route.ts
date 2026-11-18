import { json } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/current-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return json({ user: null }, { headers: { 'cache-control': 'no-store' } });
  return json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
