import type { ReactNode } from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';
import { requirePageUser, type CurrentUser } from '@/lib/auth/current-user';
import { getStorageInfo } from '@/lib/db';
import { getWorkerSummary } from '@/lib/worker-status';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { BrandMark } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

function isNextControlFlow(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    String((error as { digest: string }).digest).startsWith('NEXT_')
  );
}

function ConfigurationProblem({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="panel w-full max-w-2xl p-8">
        <BrandMark showTagline />
        <div className="mt-8 flex items-start gap-3 rounded-lg border border-signal-warning/25 bg-signal-warning/[0.06] p-4">
          <AlertTriangle className="mt-0.5 shrink-0 text-signal-warning" size={18} />
          <div>
            <p className="text-sm font-medium text-signal-warning">The dashboard cannot start yet</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{message}</p>
          </div>
        </div>
        <div className="mt-6 space-y-3 text-sm text-slate-400">
          <p className="flex items-center gap-2 font-medium text-slate-200">
            <Wrench size={15} className="text-brand-300" /> How to fix this
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed">
            <li>Create a free PostgreSQL database (Neon or Supabase) — see docs/DEPLOYMENT.md.</li>
            <li>
              Put its connection string in <code className="mono text-slate-200">DATABASE_URL</code>{' '}
              (apps/web/.env.local locally, or Vercel environment variables).
            </li>
            <li>
              Run <code className="mono text-slate-200">npm run db:migrate</code> to create the schema.
            </li>
            <li>Reload this page and create the first administrator at /setup.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let user: CurrentUser;
  try {
    user = await requirePageUser();
  } catch (error) {
    // Never swallow Next.js redirects; only surface real configuration errors.
    if (isNextControlFlow(error)) throw error;
    return <ConfigurationProblem message={(error as Error).message} />;
  }

  const [storage, worker] = await Promise.all([
    getStorageInfo(),
    getWorkerSummary().catch(() => null),
  ]);

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[258px_minmax(0,1fr)]">
      <Sidebar
        permissions={user.permissions}
        workerOnline={worker?.online ?? false}
        storageLabel={storage.driver === 'postgres' ? 'PostgreSQL' : 'Local file'}
      />
      <div className="flex min-h-screen min-w-0 flex-col">
        <Topbar
          user={{ name: user.name, email: user.email, role: user.role }}
          permissions={user.permissions}
          workerOnline={worker?.online ?? false}
          storageLabel={storage.driver === 'postgres' ? 'PostgreSQL storage' : 'Local file storage'}
        />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-2 text-[10px] uppercase tracking-[0.2em] text-slate-700 sm:px-6 lg:px-8">
          ORION CONTROL · Independent community operations platform · Not affiliated with Orion Drift
        </footer>
      </div>
    </div>
  );
}
