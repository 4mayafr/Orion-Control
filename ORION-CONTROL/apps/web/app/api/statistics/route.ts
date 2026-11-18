import { errorResponse, json } from '@/lib/api';
import { requireApiUser } from '@/lib/auth/current-user';
import { getStatisticsOverview } from '@/lib/statistics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireApiUser('statistics.view');
    const limitParam = Number(new URL(request.url).searchParams.get('limit') ?? '30');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 180) : 30;

    const overview = await getStatisticsOverview(limit);
    return json(
      {
        latest: overview.latest,
        history: overview.history,
        source: overview.source,
        lastRetrievedAt: overview.lastRetrievedAt,
        stale: overview.stale,
        notes: overview.notes,
        warnings: overview.warnings,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
