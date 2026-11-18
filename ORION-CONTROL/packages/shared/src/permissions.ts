/**
 * Roles and permissions.
 *
 * These rules are the single source of truth and are enforced on the SERVER
 * (API routes and server components). Hiding a button in the UI is never
 * treated as security.
 *
 * Roles give a default permission set. A per-operator override row can grant or
 * revoke an individual permission on top of the role.
 */

export const ROLES = ['admin', 'operator', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'dashboard.view',
  'statistics.view',
  'statistics.retrieve',
  'tasks.view',
  'tasks.create',
  'tasks.manage',
  'operators.view',
  'operators.manage',
  'station.create',
  'settings.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  operator: 'Operator',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full control: operators, API keys, settings and every operation.',
  operator: 'Runs operations: retrieves statistics, creates and manages tasks.',
  viewer: 'Read-only access to dashboards, statistics and task history.',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'View overview dashboard',
  'statistics.view': 'View server statistics',
  'statistics.retrieve': 'Request statistics retrieval (creates background tasks)',
  'tasks.view': 'View background task history and results',
  'tasks.create': 'Create background tasks',
  'tasks.manage': 'Retry, cancel and manage background tasks',
  'operators.view': 'View operators and activity logs',
  'operators.manage': 'Invite, edit, suspend and remove operators',
  'station.create': 'Create monitored stations (reserved for station management)',
  'settings.manage': 'Manage settings, integrations and API keys',
};

export const PERMISSION_GROUPS: Array<{ label: string; permissions: Permission[] }> = [
  {
    label: 'Operations',
    permissions: ['dashboard.view', 'statistics.view', 'statistics.retrieve', 'station.create'],
  },
  {
    label: 'Background tasks',
    permissions: ['tasks.view', 'tasks.create', 'tasks.manage'],
  },
  {
    label: 'Administration',
    permissions: ['operators.view', 'operators.manage', 'settings.manage'],
  },
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  operator: [
    'dashboard.view',
    'statistics.view',
    'statistics.retrieve',
    'tasks.view',
    'tasks.create',
    'tasks.manage',
    'operators.view',
  ],
  viewer: ['dashboard.view', 'statistics.view', 'tasks.view'],
};

export interface PermissionOverride {
  permission: string;
  granted: boolean;
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Resolve the effective permission set for an operator.
 * Overrides are applied in order, the last matching override wins.
 */
export function resolvePermissions(role: Role, overrides: PermissionOverride[] = []): Permission[] {
  const effective = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const override of overrides) {
    if (!isPermission(override.permission)) continue;
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }
  return [...effective].sort();
}

export function hasPermission(
  role: Role,
  permission: Permission,
  overrides: PermissionOverride[] = [],
): boolean {
  return resolvePermissions(role, overrides).includes(permission);
}
