/**
 * System settings stored in `integration_settings` (one row per key).
 * Defaults are applied for any missing key, so a fresh database works without
 * a seeding step.
 */

import { z } from 'zod';

export const INTEGRATION_MODES = ['mock', 'channel'] as const;
export type IntegrationMode = (typeof INTEGRATION_MODES)[number];

export const INTEGRATION_MODE_LABELS: Record<IntegrationMode, string> = {
  mock: 'Simulated integration',
  channel: 'Discord channel relay',
};

export const DEFAULT_SETTINGS = {
  /** A worker is shown offline after this many seconds without a heartbeat. */
  workerOfflineAfterSeconds: 90,
  /** Default task timeout when a task type does not override it. */
  defaultTaskTimeoutMs: 60_000,
  /** Completed task retention for the task list (informational). */
  taskRetentionDays: 30,
  /** Expected worker integration mode, shown on the Discord page. */
  integrationMode: 'mock' as IntegrationMode,
  /** Show clearly-labelled simulated placeholders when nothing was retrieved. */
  allowSimulatedFallback: true,
} as const;

export const systemSettingsSchema = z.object({
  workerOfflineAfterSeconds: z.number().int().min(20).max(3_600),
  defaultTaskTimeoutMs: z.number().int().min(5_000).max(600_000),
  taskRetentionDays: z.number().int().min(1).max(365),
  integrationMode: z.enum(INTEGRATION_MODES),
  allowSimulatedFallback: z.boolean(),
});

export type SystemSettings = z.infer<typeof systemSettingsSchema>;
export const systemSettingsPatchSchema = systemSettingsSchema.partial();

export function mergeSettings(raw: Record<string, unknown> | null | undefined): SystemSettings {
  const candidate = {
    ...DEFAULT_SETTINGS,
    ...(raw ?? {}),
  };
  const parsed = systemSettingsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
}
