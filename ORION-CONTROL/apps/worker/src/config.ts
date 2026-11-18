/**
 * Worker configuration.
 *
 * Validated at startup with actionable messages. The worker refuses to start
 * with an insecure API URL (plain http to a remote host) so an API key can never
 * be sent unencrypted.
 */

import os from 'node:os';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import type { LogLevel } from './logger.js';

// Load apps/worker/.env, then the repository-root .env as a fallback. Existing
// environment variables always win (dotenv does not override by default).
loadDotenv({ path: path.resolve(process.cwd(), '.env') });
loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  ORION_API_URL: z.string().min(1, 'ORION_API_URL is required'),
  ORION_WORKER_KEY: z.string().min(10, 'ORION_WORKER_KEY is required (create one in API Keys)'),
  WORKER_ID: z.string().max(120).optional(),
  INTEGRATION_MODE: z.enum(['mock', 'channel']).default('mock'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_GUILD_ID: z.string().regex(/^\d{5,25}$/, 'must be a numeric Discord snowflake').optional(),
  DISCORD_CHANNEL_ID: z.string().regex(/^\d{5,25}$/, 'must be a numeric Discord snowflake').optional(),
  DISCORD_TARGET_BOT_ID: z
    .string()
    .regex(/^\d{5,25}$/, 'must be a numeric Discord snowflake')
    .optional(),
  DISCORD_ENABLE_MESSAGE_CONTENT: z.enum(['true', 'false']).default('false'),
  DISCORD_TASK_TIMEOUT: z.coerce.number().int().min(1_000).max(600_000).default(60_000),
  DISCORD_TASK_POLL_INTERVAL: z.coerce.number().int().min(500).max(60_000).default(2_000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(5_000).max(300_000).default(20_000),
});

export interface WorkerConfig {
  apiUrl: string;
  apiKey: string;
  workerId: string;
  pollIntervalMs: number;
  taskTimeoutMs: number;
  heartbeatIntervalMs: number;
  integrationMode: 'mock' | 'channel';
  logLevel: LogLevel;
  spoolPath: string;
  discord: {
    token: string | null;
    guildId: string | null;
    channelId: string | null;
    targetBotId: string | null;
    enableMessageContent: boolean;
  };
}

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      'The worker configuration is incomplete or invalid.',
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`),
    );
  }
  const data = parsed.data;
  const issues: string[] = [];

  let apiUrl: URL | null = null;
  try {
    apiUrl = new URL(data.ORION_API_URL);
  } catch {
    issues.push('ORION_API_URL: must be a valid absolute URL, e.g. https://your-project.vercel.app');
  }

  if (apiUrl) {
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname);
    if (apiUrl.protocol !== 'https:' && !isLocal) {
      issues.push(
        'ORION_API_URL: must use https:// for remote hosts — the worker key must never travel over plain HTTP.',
      );
    }
    if (!['http:', 'https:'].includes(apiUrl.protocol)) {
      issues.push('ORION_API_URL: protocol must be http or https.');
    }
  }

  const token = clean(data.DISCORD_BOT_TOKEN);
  const guildId = clean(data.DISCORD_GUILD_ID);
  const channelId = clean(data.DISCORD_CHANNEL_ID);
  const targetBotId = clean(data.DISCORD_TARGET_BOT_ID);

  if (data.INTEGRATION_MODE === 'channel') {
    if (!token) issues.push('DISCORD_BOT_TOKEN: required when INTEGRATION_MODE=channel');
    if (!guildId) issues.push('DISCORD_GUILD_ID: required when INTEGRATION_MODE=channel');
    if (!channelId) issues.push('DISCORD_CHANNEL_ID: required when INTEGRATION_MODE=channel');
  }
  if (data.DISCORD_ENABLE_MESSAGE_CONTENT === 'true' && !token) {
    issues.push('DISCORD_ENABLE_MESSAGE_CONTENT: requires DISCORD_BOT_TOKEN');
  }

  if (issues.length > 0) {
    throw new ConfigError('The worker configuration is incomplete or invalid.', issues);
  }

  const rawWorkerId = clean(data.WORKER_ID) ?? os.hostname() ?? 'worker';
  const workerId = rawWorkerId.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120) || 'worker';

  return {
    apiUrl: (apiUrl?.toString() ?? data.ORION_API_URL).replace(/\/+$/, ''),
    apiKey: data.ORION_WORKER_KEY.trim(),
    workerId,
    pollIntervalMs: data.DISCORD_TASK_POLL_INTERVAL,
    taskTimeoutMs: data.DISCORD_TASK_TIMEOUT,
    heartbeatIntervalMs: data.HEARTBEAT_INTERVAL_MS,
    integrationMode: data.INTEGRATION_MODE,
    logLevel: data.LOG_LEVEL as LogLevel,
    spoolPath: path.resolve(process.cwd(), '.data', 'pending-results.json'),
    discord: {
      token,
      guildId,
      channelId,
      targetBotId,
      enableMessageContent: data.DISCORD_ENABLE_MESSAGE_CONTENT === 'true',
    },
  };
}

export function formatConfigError(error: ConfigError): string {
  return [
    '',
    'ORION CONTROL worker cannot start:',
    `  ${error.message}`,
    '',
    ...error.details.map((detail) => `  • ${detail}`),
    '',
    'Fix these values in apps/worker/.env (copy apps/worker/.env.example).',
    'Worker API keys are created in the dashboard: API Keys → Create worker key.',
    '',
  ].join('\n');
}
