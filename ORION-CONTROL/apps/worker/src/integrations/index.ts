import type { WorkerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { DiscordService } from '../discord/client.js';
import { MockIntegrationAdapter } from './mock.js';
import { ChannelRelayAdapter } from './channel-relay.js';
import type { IntegrationAdapter } from './types.js';

export function createIntegrationAdapter(
  config: WorkerConfig,
  discord: DiscordService,
  logger: Logger,
): IntegrationAdapter {
  if (config.integrationMode === 'channel') {
    return new ChannelRelayAdapter(discord, config, logger);
  }
  return new MockIntegrationAdapter(logger);
}
