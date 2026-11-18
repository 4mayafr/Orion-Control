import Link from 'next/link';
import { Compass } from 'lucide-react';
import { buttonStyles, BrandMark } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandMark />
      <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-edge bg-void-900 text-brand-300">
        <Compass size={24} />
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.3em] text-slate-600">Error 404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">Signal lost</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        That route does not exist in the operations console. Check the address or return to the overview.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/dashboard" className={buttonStyles('primary')}>
          Return to dashboard
        </Link>
        <Link href="/" className={buttonStyles('secondary')}>
          Public site
        </Link>
      </div>
    </main>
  );
}
