import { randomUUID } from 'node:crypto';
import { apiKeyCreateSchema } from '@orion/shared';
import { recordActivity } from '@/lib/activity';
import { errorResponse, json, parseJson, requireSameOrigin } from '@/lib/api';
import { generateApiKey } from '@/lib/api-keys';
import { requireApiUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { toApiKeyDTO } from '@/lib/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser('settings.manage');
    const store = await getStore();
    const keys = await store.listApiKeys();
    return json({ items: keys.map(toApiKeyDTO) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiUser('settings.manage');
    const input = await parseJson(request, apiKeyCreateSchema);
    const store = await getStore();

    const generated = generateApiKey();
    const key = await store.createApiKey({
      id: randomUUID(),
      name: input.name,
      prefix: generated.prefix,
      keyHash: generated.hash,
      scopes: input.scopes,
      createdBy: actor.id,
      createdByEmail: actor.email,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    });

    await recordActivity({
      actor: { id: actor.id, email: actor.email },
      action: 'api_key.created',
      category: 'api_key',
      description: `API key "${key.name}" created (${key.prefix}…).`,
      targetType: 'api_key',
      targetId: key.id,
      metadata: { scopes: key.scopes },
    });

    return json(
      {
        apiKey: toApiKeyDTO(key),
        secret: generated.raw,
        warning: 'Copy this key now. It is stored as a hash and cannot be shown again.',
      },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
