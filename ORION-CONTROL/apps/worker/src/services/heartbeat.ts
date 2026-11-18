/**
 * Heartbeats are the only source of worker online status on the website.
 * They include the current task, integration mode and Discord state (names
 * only — never channel IDs).
 */

import os from 'node:os';
import type { WorkerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { DiscordService } from '../discord/client.js';
import { OrionApiClient } from './api-client.js';
import { WORKER_VERSION } from '../version.js';
import { truncate } from '../util.js';

export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private readonly startedAt = new Date().toISOString();

  constructor(
    private readonly api: OrionApiClient,
    private readonly config: WorkerConfig,
    private readonly discord: DiscordService,
    private readonly getCurrentTaskId: () => string | null,
    private readonly logger: Logger,
  ) {}

  start(): void {
    void this.send();
    this.timer = setInterval(() => {
      void this.send();
    }, this.config.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async send(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const resolved = this.discord.getResolvedChannel();
      await this.api.heartbeat({
        workerId: this.config.workerId,
        hostname: os.hostname(),
        platform: `${os.platform()} ${os.release()} (${os.arch()})`,
        version: WORKER_VERSION,
        currentTaskId: this.getCurrentTaskId(),
        integrationMode: this.config.integrationMode,
        discordConnected: this.discord.isConnected(),
        uptimeSeconds: Math.round(process.uptime()),
        ...(resolved?.guildName ? { discordGuildName: resolved.guildName } : {}),
        ...(resolved?.channelName ? { discordChannelName: resolved.channelName } : {}),
      });
    } catch (error) {
      this.logger.warn(
        `Heartbeat failed: ${truncate((error as Error).message, 200)}. The website may show the worker as offline.`,
      );
    } finally {
      this.inFlight = false;
    }
  }

  getStartedAt(): string {
    return this.startedAt;
  }
}
