import type { Metadata } from 'next';
import Link from 'next/link';
import { Filter, ScrollText, Search } from 'lucide-react';
import { formatDateTime } from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { Badge, Card, CardHeader, EmptyState, PageHeader, buttonStyles } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Activity Logs' };

const CATEGORIES = [
  'auth',
  'task',
  'statistics',
  'operator',
  'api_key',
  'settings',
  'worker',
  'system',
] as const;

const PAGE_SIZE = 50;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageUser('operators.view');
  const params = await searchParams;

  const category =
    typeof params.category === 'string' && (CATEGORIES as readonly string[]).includes(params.category)
      ? params.category
      : undefined;
  const search = typeof params.search === 'string' ? params.search.slice(0, 120) : undefined;
  const pageParam = typeof params.page === 'string' ? Number(params.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const store = await getStore();
  const result = await store.listLogs({
    category,
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function href(overrides: Record<string, string | undefined>): string {
    const query = new URLSearchParams();
    if (category) query.set('category', category);
    if (search) query.set('search', search);
    if (page > 1) query.set('page', String(page));
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) query.delete(key);
      else query.set(key, value);
    }
    const value = query.toString();
    return value ? `/dashboard/logs?${value}` : '/dashboard/logs';
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Activity logs"
        description="Immutable audit trail of sign-ins, task lifecycle events, operator changes, API keys and settings."
      />

      <Card>
        <CardHeader
          title="Audit trail"
          description={`${result.total} record${result.total === 1 ? '' : 's'}${category ? ` in ${category}` : ''}`}
          icon={<ScrollText size={16} />}
        />

        <div className="flex flex-col gap-3 border-b border-edge/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-600">
              <Filter size={11} /> Category
            </span>
            <Link
              href={href({ category: undefined, page: undefined })}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px]',
                !category
                  ? 'border-brand-400/40 bg-brand-500/10 text-brand-200'
                  : 'border-edge/70 text-slate-500 hover:text-slate-300',
              )}
            >
              All
            </Link>
            {CATEGORIES.map((value) => (
              <Link
                key={value}
                href={href({ category: value, page: undefined })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px]',
                  category === value
                    ? 'border-brand-400/40 bg-brand-500/10 text-brand-200'
                    : 'border-edge/70 text-slate-500 hover:text-slate-300',
                )}
              >
                {value}
              </Link>
            ))}
          </div>

          <form action="/dashboard/logs" method="get" className="flex items-center gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Search descriptions, actions, actors…"
                className="input h-8 w-64 py-1 pl-8 text-[12px]"
                aria-label="Search activity logs"
              />
            </div>
            <button type="submit" className={buttonStyles('secondary', 'sm')}>
              Search
            </button>
          </form>
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={18} />}
            title="No activity matches"
            description="Try clearing the category or search filter."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Actor</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap text-[11px] text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="max-w-[170px] truncate text-[12px] text-slate-400">
                      {log.actorEmail ?? 'system'}
                    </td>
                    <td>
                      <Badge variant="neutral">{log.category}</Badge>
                    </td>
                    <td className="mono text-[11px] text-brand-200/90">{log.action}</td>
                    <td className="max-w-[420px] text-[12px] leading-relaxed text-slate-300">
                      {log.description}
                      {Object.keys(log.metadata).length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-600 hover:text-slate-400">
                            Metadata
                          </summary>
                          <pre className="mono mt-1 whitespace-pre-wrap break-words rounded border border-edge/60 bg-void-950/70 p-2 text-[10px] text-slate-500">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="mono text-[11px] text-slate-600">{log.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-edge/60 px-4 py-3 text-[11px] text-slate-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className={buttonStyles('secondary', 'sm')}>
                Previous
              </Link>
            ) : (
              <span className={cn(buttonStyles('secondary', 'sm'), 'pointer-events-none opacity-40')}>
                Previous
              </span>
            )}
            {page < totalPages ? (
              <Link href={href({ page: String(page + 1) })} className={buttonStyles('secondary', 'sm')}>
                Next
              </Link>
            ) : (
              <span className={cn(buttonStyles('secondary', 'sm'), 'pointer-events-none opacity-40')}>
                Next
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
