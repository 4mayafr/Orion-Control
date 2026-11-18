'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { APP_VERSION } from '@/lib/brand';
import { BrandMark } from '@/components/ui/primitives';
import { isActivePath, visibleSections } from './nav-items';

export function Sidebar({
  permissions,
  workerOnline,
  storageLabel,
}: {
  permissions: string[];
  workerOnline: boolean;
  storageLabel: string;
}) {
  const pathname = usePathname();
  const sections = visibleSections(permissions);

  return (
    <aside className="hidden border-r border-edge/60 bg-void-900/50 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[258px] lg:flex-col">
      <div className="px-5 py-5">
        <Link href="/dashboard" className="block">
          <BrandMark showTagline />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4 pt-2">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-2 text-[9px] font-semibold uppercase tracking-[0.26em] text-slate-600">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                        active
                          ? 'bg-brand-500/10 text-white ring-1 ring-inset ring-brand-500/25'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-400 shadow-[0_0_8px_1px_rgba(167,139,250,0.7)]" />
                      )}
                      <Icon
                        size={16}
                        strokeWidth={1.8}
                        className={cn(
                          'shrink-0 transition-colors',
                          active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-edge/60 p-4">
        <div className="flex items-center justify-between rounded-lg border border-edge/70 bg-void-850/70 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                workerOnline
                  ? 'bg-signal-success shadow-[0_0_8px_2px_rgba(52,211,153,0.45)]'
                  : 'bg-signal-danger shadow-[0_0_8px_2px_rgba(251,113,133,0.35)]',
              )}
            />
            <span className="text-[11px] font-medium text-slate-300">
              Worker {workerOnline ? 'online' : 'offline'}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-600">{storageLabel}</span>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
          ORION CONTROL v{APP_VERSION}
        </p>
      </div>
    </aside>
  );
}
