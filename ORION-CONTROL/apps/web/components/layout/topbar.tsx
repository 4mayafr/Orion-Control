import type { Role } from '@orion/shared';
import { UserMenu } from './user-menu';
import { WorkerIndicator } from './worker-indicator';
import { MobileNav } from './mobile-nav';

export function Topbar({
  user,
  permissions,
  workerOnline,
  storageLabel,
}: {
  user: { name: string; email: string; role: Role };
  permissions: string[];
  workerOnline: boolean;
  storageLabel: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-edge/60 bg-void-950/85 px-4 py-2.5 backdrop-blur-md lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav permissions={permissions} />
        <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-600 sm:block">
          Operations Console
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden rounded-full border border-edge/70 bg-void-900/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-500 md:inline">
          {storageLabel}
        </span>
        <WorkerIndicator initialOnline={workerOnline} />
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </header>
  );
}
