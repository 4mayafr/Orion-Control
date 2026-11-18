'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BrandMark } from '@/components/ui/primitives';
import { isActivePath, visibleSections } from './nav-items';

export function MobileNav({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sections = visibleSections(permissions);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost px-2 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-void-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-edge bg-void-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4">
              <BrandMark size="sm" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost px-2"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="px-2 pb-2 text-[9px] font-semibold uppercase tracking-[0.26em] text-slate-600">
                    {section.label}
                  </p>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActivePath(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]',
                              active
                                ? 'bg-brand-500/10 text-white ring-1 ring-inset ring-brand-500/25'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                            )}
                          >
                            <Icon size={16} strokeWidth={1.8} className={active ? 'text-brand-300' : 'text-slate-500'} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
