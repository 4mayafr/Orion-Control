import { json } from '@/lib/api';
import { getStorageInfo } from '@/lib/db';
import { APP_VERSION } from '@/lib/brand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public health probe. Exposes no configuration values or credentials. */
export async function GET() {
  const storage = await getStorageInfo();
  return json(
    {
      status: storage.persistent ? 'ok' : 'degraded',
      app: 'orion-control',
      version: APP_VERSION,
      storage: storage.driver,
      persistentStorage: storage.persistent,
      time: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
