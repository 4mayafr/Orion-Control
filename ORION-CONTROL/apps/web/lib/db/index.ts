/**
 * Store singleton.
 *
 * Cached on globalThis so Next.js hot reloads and lambda reuse do not create a
 * new connection pool per request.
 */

import path from 'node:path';
import { env, resolveStorageDriver } from '../env';
import { seedStore } from '../seed';
import { FileStore } from './file';
import { PostgresStore } from './postgres';
import type { Store } from './types';

const globalForStore = globalThis as unknown as {
  __orionStore?: Promise<Store>;
};

async function createStore(): Promise<Store> {
  const driver = resolveStorageDriver();

  if (driver === 'postgres') {
    const url = env.databaseUrl;
    if (!url) {
      throw new Error(
        'DATABASE_URL is required for PostgreSQL storage. Create a free Neon or Supabase database and set DATABASE_URL.',
      );
    }
    const store = new PostgresStore(url);
    await store.init();
    return store;
  }

  const filePath =
    (process.env.ORION_FILE_DB ?? '').trim() || path.join(process.cwd(), '.data', 'orion.json');
  const store = new FileStore(filePath, (message) => console.info(`[orion:db] ${message}`));
  await store.init();

  // Zero-config local experience: give the dashboard a month of clearly-labelled
  // simulated history on first run. Production (Postgres) is never auto-seeded.
  try {
    const result = await seedStore(store, { days: 30 });
    if (result.seeded) {
      console.info(
        `[orion:db] Seeded ${result.snapshots} SIMULATED daily snapshots for local development.`,
      );
    }
  } catch (error) {
    console.error('[orion:db] Local simulated seeding failed (continuing without it):', error);
  }

  return store;
}

export function getStore(): Promise<Store> {
  if (!globalForStore.__orionStore) {
    globalForStore.__orionStore = createStore().catch((error) => {
      // Do not cache a failed initialisation: the next request can retry once the
      // operator fixes the environment.
      globalForStore.__orionStore = undefined;
      throw error;
    });
  }
  return globalForStore.__orionStore;
}

export interface StorageInfo {
  driver: 'postgres' | 'file';
  label: string;
  persistent: boolean;
  detail: string;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  try {
    const store = await getStore();
    if (store.driver === 'postgres') {
      return {
        driver: 'postgres',
        label: 'PostgreSQL',
        persistent: true,
        detail: 'Hosted PostgreSQL. Data persists across deployments.',
      };
    }
    return {
      driver: 'file',
      label: 'Local JSON file',
      persistent: false,
      detail: 'Local development storage only. Not persistent on serverless hosting.',
    };
  } catch (error) {
    return {
      driver: resolveStorageDriverSafely(),
      label: 'Storage unavailable',
      persistent: false,
      detail: (error as Error).message,
    };
  }
}

function resolveStorageDriverSafely(): 'postgres' | 'file' {
  try {
    return resolveStorageDriver();
  } catch {
    return 'file';
  }
}

export type { Store } from './types';
