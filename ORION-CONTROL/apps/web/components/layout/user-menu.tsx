'use client';

import { useState } from 'react';
import { ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import { ROLE_LABELS, type Role } from '@orion/shared';
import { cn } from '@/lib/cn';

export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  async function signOut() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, send the operator to the login screen.
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-edge/80 bg-void-900/70 py-1 pl-1 pr-2.5 text-left transition-colors hover:border-edge-bright"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/70 to-cyber-500/50 text-[11px] font-semibold text-white">
          {initials || 'OP'}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-[12px] font-medium text-slate-200">{name}</span>
          <span className="block text-[10px] uppercase tracking-wider text-slate-500">
            {ROLE_LABELS[role]}
          </span>
        </span>
        <ChevronDown size={14} className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-edge bg-void-900 shadow-2xl"
          >
            <div className="border-b border-edge/70 px-4 py-3">
              <p className="truncate text-sm font-medium text-slate-100">{name}</p>
              <p className="truncate text-xs text-slate-500">{email}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-brand-300">
                <ShieldCheck size={12} /> {ROLE_LABELS[role]}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={pending}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60"
            >
              <LogOut size={15} />
              {pending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
