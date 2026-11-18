/**
 * Discord client lifecycle.
 *
 * Deliberately minimal intents: Guilds + GuildMessages are not privileged. The
 * MESSAGE_CONTENT intent is only requested when the operator enables it in both
 * the Discord Developer Portal and the worker environment, because requesting a
 * privileged intent that is disabled prevents the bot from connecting at all.
 */

import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';
import type { WorkerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { truncate } from '../util.js';

export interface ResolvedChannel {
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  canView: boolean;
  canSend: boolean;
  canReadHistory: boolean;
}

export class DiscordService {
  private client: Client | null = null;
  private connected = false;
  private resolvedChannel: ResolvedChannel | null = null;

  constructor(
    private readonly config: WorkerConfig,
    private readonly logger: Logger,
  ) {}

  async connect(): Promise<void> {
    const token = this.config.discord.token;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN is not configured.');
    }

    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
    if (this.config.discord.enableMessageContent) {
      intents.push(GatewayIntentBits.MessageContent);
    }

    const client = new Client({ intents });
    client.on(Events.Error, (error) => this.logger.error(`Discord client error: ${error.message}`));
    client.on(Events.Warn, (message) => this.logger.warn(`Discord warning: ${message}`));
    client.on(Events.ShardDisconnect, (_event, shardId) => {
      this.connected = false;
      this.logger.warn(`Discord shard ${shardId} disconnected.`);
    });
    client.on(Events.ShardReconnecting, (shardId) => {
      this.logger.info(`Discord shard ${shardId} reconnecting…`);
    });
    client.on(Events.ShardResume, (shardId) => {
      this.connected = true;
      this.logger.info(`Discord shard ${shardId} resumed.`);
    });

    this.client = client;

    try {
      await client.login(token);
    } catch (error) {
      this.client = null;
      this.connected = false;
      await client.destroy().catch(() => undefined);
      throw new Error(
        `Discord login failed: ${truncate((error as Error).message, 300)}. Check DISCORD_BOT_TOKEN and that the bot is invited to the guild.`,
      );
    }

    this.connected = true;
    this.logger.info(`Discord connected as ${client.user?.tag ?? 'unknown bot'}.`);
  }

  isConnected(): boolean {
    return this.connected && Boolean(this.client?.isReady());
  }

  getBotTag(): string | null {
    return this.client?.user?.tag ?? null;
  }

  getClient(): Client {
    if (!this.client) throw new Error('The Discord client is not initialised.');
    return this.client;
  }

  getResolvedChannel(): ResolvedChannel | null {
    return this.resolvedChannel;
  }

  /**
   * Validates that the configured channel exists, is text-based and belongs to
   * the configured guild. Anything else is a configuration error, not data.
   */
  async validateChannel(): Promise<ResolvedChannel> {
    const { guildId, channelId } = this.config.discord;
    if (!guildId || !channelId) {
      throw new Error('DISCORD_GUILD_ID and DISCORD_CHANNEL_ID must both be configured.');
    }
    const client = this.getClient();
    if (!client.isReady()) {
      throw new Error('Discord is not connected, so the channel cannot be validated.');
    }

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      throw new Error(
        `Guild ${guildId} is not available to this bot. Invite the bot to the guild and check DISCORD_GUILD_ID.`,
      );
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      throw new Error(
        `Channel ${channelId} was not found in guild "${guild.name}". Check DISCORD_CHANNEL_ID.`,
      );
    }
    if (channel.guildId !== guild.id) {
      throw new Error('The configured channel does not belong to the configured guild.');
    }
    if (!channel.isTextBased()) {
      throw new Error('The configured channel is not a text channel.');
    }

    const textChannel = channel as TextChannel;
    const permissions = client.user ? textChannel.permissionsFor(client.user) : null;
    const canView = permissions?.has(PermissionFlagsBits.ViewChannel) ?? false;
    const canSend = permissions?.has(PermissionFlagsBits.SendMessages) ?? false;
    const canReadHistory = permissions?.has(PermissionFlagsBits.ReadMessageHistory) ?? false;

    if (!canView || !canSend) {
      throw new Error(
        'The bot lacks View Channel or Send Messages in the configured channel. Grant those permissions to the bot role.',
      );
    }

    this.resolvedChannel = {
      guildId: guild.id,
      guildName: guild.name,
      channelId: textChannel.id,
      channelName: textChannel.name,
      canView,
      canSend,
      canReadHistory,
    };
    this.logger.info(
      `Discord target validated: #${textChannel.name} in "${guild.name}" (view=${canView}, send=${canSend}, history=${canReadHistory}).`,
    );
    return this.resolvedChannel;
  }

  async destroy(): Promise<void> {
    this.connected = false;
    this.resolvedChannel = null;
    if (this.client) {
      await this.client.destroy().catch(() => undefined);
      this.client = null;
    }
  }
}
