import type { ReactNode } from 'react';
import { Activity, Lock, Radio, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/ui/primitives';
import Link from 'next/link';

const HIGHLIGHTS = [
  { icon: Activity, text: 'Live operational overview and historical statistics' },
  { icon: Radio, text: 'Background tasks executed by your own Discord worker' },
  { icon: ShieldCheck, text: 'Role-based permissions enforced on the server' },
];

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-overlay opacity-30" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-brand-600/15 blur-[140px]"
      />

      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="hidden lg:block">
          <Link href="/">
            <BrandMark size="lg" showTagline />
          </Link>
          <h2 className="mt-8 max-w-md text-3xl font-semibold leading-tight tracking-tight text-slate-100">
            A command centre for the people running the community.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Monitor servers, dispatch tasks to your Discord worker and keep a complete audit of every
            operation.
          </p>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((highlight) => {
              const Icon = highlight.icon;
              return (
                <li key={highlight.text} className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-400/20 bg-brand-500/10 text-brand-200">
                    <Icon size={14} />
                  </span>
                  {highlight.text}
                </li>
              );
            })}
          </ul>
          <div className="mt-10 flex items-center gap-2 rounded-lg border border-edge/70 bg-void-900/60 px-3 py-2 text-[11px] text-slate-500">
            <Lock size={13} className="text-cyber-400" />
            Operator sessions are signed, HttpOnly and expire after 8 hours.
          </div>
        </div>

        <div className="panel w-full p-6 sm:p-7">
          <div className="mb-6 lg:hidden">
            <BrandMark size="sm" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{description}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-edge/60 pt-4 text-xs text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
