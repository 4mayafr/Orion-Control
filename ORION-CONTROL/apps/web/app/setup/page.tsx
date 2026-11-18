import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { env } from '@/lib/env';
import { getStore } from '@/lib/db';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetupForm } from '@/components/auth/setup-form';
import { Alert, CodeBlock } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Initial setup' };
export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  let storageProblem: string | null = null;
  let hasOperators = false;

  try {
    const store = await getStore();
    hasOperators = (await store.countUsers()) > 0;
  } catch (error) {
    storageProblem = (error as Error).message;
  }

  if (!storageProblem && hasOperators) {
    redirect('/login');
  }

  const tokenConfigured = Boolean(env.setupToken);

  return (
    <AuthShell
      title="Create the first administrator"
      description="One-time bootstrap for a fresh ORION CONTROL installation."
      footer={
        <span>
          Already have an account?{' '}
          <Link href="/login" className="text-brand-300 hover:text-brand-200">
            Sign in
          </Link>
        </span>
      }
    >
      {storageProblem ? (
        <Alert variant="danger" title="Database unavailable">
          {storageProblem}
        </Alert>
      ) : !tokenConfigured ? (
        <div className="space-y-4">
          <Alert variant="warning" title="Setup token is not configured">
            Add <span className="mono">INITIAL_ADMIN_SETUP_TOKEN</span> to your environment before
            creating the first administrator. This prevents anyone who finds a fresh deployment from
            claiming it.
          </Alert>
          <div className="rounded-lg border border-edge bg-void-950/70 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
              <KeyRound size={12} /> Generate a token
            </p>
            <CodeBlock>{`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`}</CodeBlock>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-500">
            Add it to <span className="mono text-slate-300">apps/web/.env.local</span> (or your Vercel
            environment variables) as <span className="mono text-slate-300">INITIAL_ADMIN_SETUP_TOKEN</span>,
            restart the website, and reload this page.
          </p>
        </div>
      ) : (
        <SetupForm />
      )}
    </AuthShell>
  );
}
