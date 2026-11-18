import {
  BarChart3,
  Bot,
  ClipboardList,
  Gauge,
  KeyRound,
  ScrollText,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@orion/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  description: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operations',
    items: [
      {
        href: '/dashboard',
        label: 'Overview',
        icon: Gauge,
        permission: 'dashboard.view',
        description: 'Live operational picture',
      },
      {
        href: '/dashboard/statistics',
        label: 'Server Statistics',
        icon: BarChart3,
        permission: 'statistics.view',
        description: 'Servers, matches and history',
      },
      {
        href: '/dashboard/players',
        label: 'Player Directory',
        icon: Users,
        permission: 'statistics.view',
        description: 'Known players and status',
      },
      {
        href: '/dashboard/tasks',
        label: 'Background Tasks',
        icon: ClipboardList,
        permission: 'tasks.view',
        description: 'Queue, results and errors',
      },
      {
        href: '/dashboard/discord',
        label: 'Discord Integration',
        icon: Bot,
        permission: 'statistics.view',
        description: 'Worker and integration health',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        href: '/dashboard/logs',
        label: 'Activity Logs',
        icon: ScrollText,
        permission: 'operators.view',
        description: 'Audit trail',
      },
      {
        href: '/dashboard/operators',
        label: 'Operators',
        icon: UserCog,
        permission: 'operators.view',
        description: 'Accounts, roles and permissions',
      },
      {
        href: '/dashboard/api-keys',
        label: 'API Keys',
        icon: KeyRound,
        permission: 'settings.manage',
        description: 'Worker credentials',
      },
      {
        href: '/dashboard/settings',
        label: 'Settings',
        icon: Settings,
        permission: 'settings.manage',
        description: 'System and account settings',
      },
    ],
  },
];

export function visibleSections(permissions: string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
