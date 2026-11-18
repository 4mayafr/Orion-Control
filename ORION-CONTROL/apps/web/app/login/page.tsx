import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { Alert } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  let storageProblem: string | null = null;
  let hasOperators = true;

  try {
    const store = await getStore();
    hasOperators = (await store.countUsers()) > 0;
  } catch (error) {
    storageProblem = (error as Error).message;
  }

  if (!storageProblem && !hasOperators) {
    redirect('/setup');
  }

  return (
    <AuthShell
      title="Operator sign in"
      description="Authenticate to access the operations console."
      footer={
        <span>
          Need the architecture and deployment guide? See{' '}
          <span className="mono text-slate-400">README.md</span> and{' '}
          <span className="mono text-slate-400">docs/</span>.
        </span>
      }
    >
      {storageProblem ? (
        <div className="space-y-4">
          <Alert variant="danger" title="Database unavailable">
            {storageProblem}
          </Alert>
          <p className="text-sm leading-relaxed text-slate-400">
            Set <span className="mono text-slate-200">DATABASE_URL</span> and run{' '}
            <span className="mono text-slate-200">npm run db:migrate</span>, then reload this page.
          </p>
        </div>
      ) : (
        <LoginForm />
      )}
      <p className="mt-4 text-center text-[11px] text-slate-600">
        <Link href="/" className="hover:text-slate-400">
          ← Back to the public site
        </Link>
      </p>
    </AuthShell>
  );
}
