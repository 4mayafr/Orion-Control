import { mergeSettings, systemSettingsPatchSchema } from '@orion/shared';
import { recordActivity } from '@/lib/activity';
import { errorResponse, json, parseJson, requireSameOrigin } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser('settings.manage');
    const store = await getStore();
    return json(
      { settings: mergeSettings(await store.getSettings()) },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiUser('settings.manage');
    const patch = await parseJson(request, systemSettingsPatchSchema);
    const store = await getStore();

    await store.saveSettings(patch, actor.email);
    const settings = mergeSettings(await store.getSettings());

    await recordActivity({
      actor: { id: actor.id, email: actor.email },
      action: 'settings.updated',
      category: 'settings',
      description: 'System settings updated.',
      metadata: { ...patch },
    });

    return json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
}
