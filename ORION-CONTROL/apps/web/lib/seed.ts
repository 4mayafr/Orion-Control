/**
 * Seeding.
 *
 * Seeds a month of SIMULATED statistics so charts and the overview have
 * something to display before a real integration exists. Every seeded record is
 * stored with source = 'simulated' and rendered with a Simulated badge.
 *
 * Used by:
 *   - `npm run db:seed` (explicit, works for Postgres and the file driver)
 *   - the file driver's first-run bootstrap (zero-config local development)
 */

import { randomUUID } from 'node:crypto';
import { createSimulatedHistory } from '@orion/shared';
import type { Store } from './db/types';

export interface SeedOptions {
  days?: number;
  /** Seed even when statistics already exist. */
  force?: boolean;
}

export interface SeedResult {
  seeded: boolean;
  snapshots: number;
}

export async function seedStore(store: Store, options: SeedOptions = {}): Promise<SeedResult> {
  const existing = await store.getLatestStatistics();
  if (existing && !options.force) {
    return { seeded: false, snapshots: 0 };
  }

  const snapshots = createSimulatedHistory(options.days ?? 30);
  const now = new Date().toISOString();

  for (const snapshot of snapshots) {
    await store.createStatistics({
      id: randomUUID(),
      source: snapshot.source,
      retrievedAt: snapshot.retrievedAt,
      taskId: null,
      createdBy: 'seed-script',
      summary: snapshot.summary,
      servers: snapshot.servers,
      matches: snapshot.matches,
      players: snapshot.players,
      notes: snapshot.notes ?? null,
      warnings: snapshot.warnings,
      createdAt: now,
    });

    await store.upsertPlayers(
      snapshot.players.map((player) => ({
        id: randomUUID(),
        externalId: player.externalId,
        displayName: player.displayName,
        platform: player.platform ?? null,
        rank: player.rank ?? null,
        status: player.status,
        source: snapshot.source,
        lastSeenAt: player.lastSeenAt ?? null,
        updatedAt: now,
      })),
    );
  }

  await store.saveSettings(
    {
      seededAt: now,
      seedVersion: 1,
      seedSource: 'simulated',
    },
    null,
  );

  return { seeded: true, snapshots: snapshots.length };
}
