/**
 * Discord channel relay adapter.
 *
 * Discord does not allow bots to invoke another bot's slash commands (see
 * docs/DISCORD.md). This adapter therefore posts an explicit request into the
 * configured private channel and parses a response posted there by an authorised
 * bot. It will not use self-bots, user tokens or token impersonation.
 *
 * Correlation: each request carries an `orion:<taskId>` marker. If the responder
 * echoes it, the match is exact; otherwise the first authorised bot response
 * after the request is accepted, which is why responses should arrive in the
 * dedicated channel.
 */

import { Events, PermissionFlagsBits, type Client, type Message, type TextChannel } from 'discord.js';
import type { TaskType } from '@orion/shared';
import type { WorkerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { DiscordService } from '../discord/client.js';
import { flattenDiscordMessageSafe, type FlattenedMessage } from './message-flatten.js';
import {
  parsePlayerDirectoryResponse,
  parseStatisticsResponse,
  rawResponseJson,
} from '../parsers/message-parser.js';
import { IntegrationError, type IntegrationAdapter, type IntegrationRequest, type IntegrationResult } from './types.js';

const REQUEST_TITLES: Partial<Record<TaskType, string>> = {
  'statistics.retrieve': 'Current server statistics',
  'players.retrieve': 'Current player directory',
};

export class ChannelRelayAdapter implements IntegrationAdapter {
  readonly name = 'discord-channel-relay';
  readonly mode = 'channel' as const;

  constructor(
    private readonly discord: DiscordService,
    private readonly config: WorkerConfig,
    private readonly logger: Logger,
  ) {}

  async execute(request: IntegrationRequest): Promise<IntegrationResult> {
    if (request.type === 'discord.channel_check') {
      return this.diagnostics();
    }

    const title = REQUEST_TITLES[request.type];
    if (!title) {
      throw new IntegrationError(
        `The channel relay does not support task type "${request.type}".`,
        'UNSUPPORTED_TASK_TYPE',
        false,
      );
    }

    const channel = await this.resolveChannel();
    const client = this.discord.getClient();
    const marker = `orion:${request.taskId.slice(0, 8)}`;
    const content = [
      '**ORION CONTROL · automated request**',
      `Request: ${title}`,
      `Marker: \`${marker}\``,
      '',
      request.type === 'statistics.retrieve'
        ? 'Please post the current server statistics in this channel (server rows and totals).'
        : 'Please post the current player directory in this channel.',
    ].join('\n');

    const selfId = client.user?.id;
    const targetBotId = this.config.discord.targetBotId;

    // Register the listener before sending so a fast response is not missed.
    const responsePromise = this.waitForResponse(client, channel, marker, request, selfId, targetBotId);

    let requestMessage: Message;
    try {
      requestMessage = await channel.send({ content, allowedMentions: { parse: [] } });
    } catch (error) {
      throw new IntegrationError(
        `Could not post the request in #${channel.name}: ${(error as Error).message}`,
        'DISCORD_SEND_FAILED',
        true,
      );
    }
    this.logger.info(`Posted relay request ${marker} in #${channel.name} (message ${requestMessage.id}).`);

    let message: Message;
    try {
      message = await responsePromise;
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      throw new IntegrationError(
        `Relay request failed: ${(error as Error).message}`,
        'RELAY_FAILED',
        true,
      );
    }

    const flattened = flattenDiscordMessageSafe(message);
    const rawResponse = rawResponseJson(flattened);

    if (request.type === 'statistics.retrieve') {
      const parsed = parseStatisticsResponse(flattened);
      return {
        rawResponse,
        parsedResponse: parsed.snapshot,
        notes: [`Response received from ${message.author.tag}.`, ...parsed.warnings],
      };
    }

    const parsed = parsePlayerDirectoryResponse(flattened);
    return {
      rawResponse,
      parsedResponse: parsed.directory,
      notes: [`Response received from ${message.author.tag}.`, ...parsed.warnings],
    };
  }

  private async resolveChannel(): Promise<TextChannel> {
    const resolved = this.discord.getResolvedChannel() ?? (await this.discord.validateChannel());
    const client = this.discord.getClient();
    if (!client.isReady()) {
      throw new IntegrationError(
        'Discord is not connected. The worker will reconnect; the task can be retried.',
        'DISCORD_DISCONNECTED',
        true,
      );
    }
    const channel = await client.channels.fetch(resolved.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      throw new IntegrationError(
        'The configured operations channel is no longer available.',
        'CHANNEL_UNAVAILABLE',
        true,
      );
    }
    return channel as TextChannel;
  }

  private waitForResponse(
    client: Client,
    channel: TextChannel,
    marker: string,
    request: IntegrationRequest,
    selfId: string | undefined,
    targetBotId: string | null,
  ): Promise<Message> {
    return new Promise<Message>((resolve, reject) => {
      const requestStart = Date.now();

      const onMessage = (message: Message) => {
        if (message.channelId !== channel.id) return;
        if (!message.author.bot) return;
        if (selfId && message.author.id === selfId) return;
        if (targetBotId && message.author.id !== targetBotId) return;
        if (message.createdTimestamp < requestStart - 2_000) return;

        // The request message carries `marker` for traceability. Any authorised
        // bot reply in this private channel after the request is accepted; the
        // marker is available to integrations that want strict correlation.
        void marker;
        cleanup();
        resolve(message);
      };

      const onAbort = () => {
        cleanup();
        reject(
          new IntegrationError(
            'The task was aborted before a Discord response arrived.',
            'ABORTED',
            true,
          ),
        );
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(
          new IntegrationError(
            `No authorised Discord response arrived within ${Math.round(request.timeoutMs / 1000)}s. Post the response in #${channel.name} or check DISCORD_TARGET_BOT_ID.`,
            'RESPONSE_TIMEOUT',
            true,
          ),
        );
      }, request.timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        client.off(Events.MessageCreate, onMessage);
        request.signal.removeEventListener('abort', onAbort);
      }

      client.on(Events.MessageCreate, onMessage);
      request.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private async diagnostics(): Promise<IntegrationResult> {
    const resolved = await this.discord.validateChannel();
    const channel = await this.resolveChannel();
    const client = this.discord.getClient();
    const permissions = client.user ? channel.permissionsFor(client.user) : null;

    const diagnostics = {
      connected: this.discord.isConnected(),
      botTag: this.discord.getBotTag(),
      guildIdMasked: `••••${resolved.guildId.slice(-4)}`,
      guildName: resolved.guildName,
      channelIdMasked: `••••${resolved.channelId.slice(-4)}`,
      channelName: resolved.channelName,
      permissions: {
        viewChannel: permissions?.has(PermissionFlagsBits.ViewChannel) ?? false,
        sendMessages: permissions?.has(PermissionFlagsBits.SendMessages) ?? false,
        readMessageHistory: permissions?.has(PermissionFlagsBits.ReadMessageHistory) ?? false,
        embedLinks: permissions?.has(PermissionFlagsBits.EmbedLinks) ?? false,
      },
      checkedAt: new Date().toISOString(),
    };

    return {
      rawResponse: JSON.stringify(diagnostics, null, 2),
      parsedResponse: diagnostics,
      notes: ['Channel diagnostics completed without sending a request message.'],
    };
  }
}

export type { FlattenedMessage };
