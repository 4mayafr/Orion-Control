import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { toApiKeyDTO } from '@/lib/dto';
import { PageHeader } from '@/components/ui/primitives';
import { ApiKeysManager } from '@/components/api-keys/api-keys-manager';

export const metadata: Metadata = { title: 'API Keys' };

export default async function ApiKeysPage() {
  await requirePageUser('settings.manage');
  const store = await getStore();
  const keys = await store.listApiKeys();

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="API keys"
        description="Worker credentials used for outbound HTTPS polling, heartbeats and result submission. Keys are scoped, hashed and revocable."
      />
      <ApiKeysManager initialKeys={keys.map(toApiKeyDTO)} />
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-600">
        <KeyRound size={12} /> Only hashes are stored. A lost key cannot be recovered — revoke it and
        generate a new one.
      </p>
    </div>
  );
}
