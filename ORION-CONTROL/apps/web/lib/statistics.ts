/**
 * Statistics read models.
 *
 * Distinguishes three states explicitly so the UI can never blur them:
 *   - a stored snapshot with source 'simulated' or 'retrieved'
 *   - a transient, clearly-labelled simulated placeholder (never stored)
 *   - unavailable (nothing to show)
 */

import {
  createSimulatedSnapshot,
  mergeSettings,
  statisticsSnapshotSchema,
  type StatSource,
  type StatisticsSnapshot,
} from '@orion/shared';
import { getStore } from './db/index';
import type { StatisticsRecord, Store } from './db/types';

export interface StatisticsPoint {
  timestamp: string;
  playersOnline: number;
  activeMatches: number;
  activeServers: number;
  healthScore: number;
  source: string;
}

export interface StatisticsOverview {
  latest: StatisticsRecord | null;
  latestSnapshot: StatisticsSnapshot | null;
  history: StatisticsPoint[];
  /** Transient placeholder used only when no snapshot exists yet. */
  placeholder: StatisticsSnapshot | null;
  source: StatSource;
  lastRetrievedAt: string | null;
  stale: boolean;
  notes: string | null;
  warnings: string[];
}

export function toSnapshot(record: StatisticsRecord): StatisticsSnapshot | null {
  const parsed = statisticsSnapshotSchema.safeParse({
    source: record.source,
    retrievedAt: record.retrievedAt,
    summary: record.summary,
    servers: record.servers,
    matches: record.matches,
    players: record.players,
    notes: record.notes ?? undefined,
    warnings: record.warnings,
  });
  return parsed.success ? parsed.data : null;
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1_000;

export async function getStatisticsOverview(
  limit = 30,
  store?: Store,
): Promise<StatisticsOverview> {
  const db = store ?? (await getStore());
  const [records, settings] = await Promise.all([db.listStatistics(limit), db.getSettings()]);
  const merged = mergeSettings(settings);
  const latest = records[0] ?? null;
  const latestSnapshot = latest ? toSnapshot(latest) : null;

  const history: StatisticsPoint[] = [...records]
    .reverse()
    .map((record) => ({
      timestamp: record.retrievedAt,
      playersOnline: record.summary.playersOnline,
      activeMatches: record.summary.activeMatches,
      activeServers: record.summary.activeServers,
      healthScore: record.summary.healthScore,
      source: record.source,
    }));

  const lastRetrievedAt = latest?.retrievedAt ?? null;
  const stale =
    lastRetrievedAt !== null && Date.now() - Date.parse(lastRetrievedAt) > STALE_AFTER_MS;

  const placeholder =
    !latest && merged.allowSimulatedFallback ? createSimulatedSnapshot({ seed: 4242 }) : null;

  return {
    latest,
    latestSnapshot,
    history,
    placeholder,
    source: latest?.source ?? (placeholder ? 'simulated' : 'unavailable'),
    lastRetrievedAt,
    stale,
    notes: latest?.notes ?? placeholder?.notes ?? null,
    warnings: latest?.warnings ?? placeholder?.warnings ?? [],
  };
}
