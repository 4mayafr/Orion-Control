/**
 * Server-side environment access.
 *
 * Nothing here throws at import time: throwing during `next build` would break
 * deployments for a missing runtime secret. Instead each accessor fails with a
 * human-readable message the moment it is actually needed.
 */

export type StorageDriverName = 'postgres' | 'file';

function trimmed(value: string | undefined | null): string {
  return (value ?? '').trim();
}

const DEV_FALLBACK_SECRET = 'orion-control-local-development-only-session-secret-do-not-use-in-production';

export const env = {
  get databaseUrl(): string | null {
    return trimmed(process.env.DATABASE_URL) || null;
  },
  get sessionSecret(): string {
    const secret = trimmed(process.env.SESSION_SECRET);
    if (secret.length >= 32) return secret;
    if (process.env.NODE_ENV !== 'production') return DEV_FALLBACK_SECRET;
    throw new Error(
      'SESSION_SECRET is missing or too short. Set a value of at least 32 characters in your Vercel environment variables (see README step 7).',
    );
  },
  get usingDevSessionSecret(): boolean {
    const secret = trimmed(process.env.SESSION_SECRET);
    return secret.length < 32 && process.env.NODE_ENV !== 'production';
  },
  get setupToken(): string | null {
    return trimmed(process.env.INITIAL_ADMIN_SETUP_TOKEN) || null;
  },
  get cronSecret(): string | null {
    return trimmed(process.env.CRON_SECRET) || null;
  },
  get appName(): string {
    return trimmed(process.env.NEXT_PUBLIC_APP_NAME) || 'ORION CONTROL';
  },
  get allowSimulated(): boolean {
    return trimmed(process.env.ORION_ALLOW_SIMULATED) !== 'false';
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
  get isVercel(): boolean {
    return Boolean(trimmed(process.env.VERCEL));
  },
  get forcedStorageDriver(): StorageDriverName | null {
    const value = trimmed(process.env.ORION_STORAGE).toLowerCase();
    if (value === 'file') return 'file';
    if (value === 'postgres') return 'postgres';
    return null;
  },
};

export function resolveStorageDriver(): StorageDriverName {
  if (env.forcedStorageDriver) return env.forcedStorageDriver;
  if (env.databaseUrl) return 'postgres';
  // A serverless filesystem is ephemeral. Refuse to pretend otherwise unless
  // the operator explicitly forced the file driver for a local test.
  if (env.isProduction && env.isVercel) {
    throw new Error(
      'DATABASE_URL is not set. Vercel cannot persist the local JSON database. Create a free Neon or Supabase PostgreSQL database and add DATABASE_URL to your Vercel environment variables (see docs/DEPLOYMENT.md).',
    );
  }
  return 'file';
}
