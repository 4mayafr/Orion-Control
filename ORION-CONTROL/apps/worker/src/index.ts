/**
 * ORION CONTROL worker entrypoint.
 *
 * Run with `npm run dev:worker` (development) or `npm run build` + `npm start`
 * inside apps/worker. Requires only outbound HTTPS: it never listens on a port.
 */

import os from 'node:os';
import { ConfigError, formatConfigError, loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { DiscordService } from './discord/client.js';
import { createIntegrationAdapter } from './integrations/index.js';
import { OrionApiClient } from './services/api-client.js';
import { HeartbeatService } from './services/heartbeat.js';
import { ResultSpool } from './services/result-spool.js';
import { TaskExecutor } from './tasks/executor.js';
import { TaskRunner } from './tasks/runner.js';
import { WORKER_NAME, WORKER_VERSION } from './version.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info(`${WORKER_NAME} v${WORKER_VERSION} starting.`, {
    workerId: config.workerId,
    apiUrl: config.apiUrl,
    integrationMode: config.integrationMode,
    hostname: os.hostname(),
    node: process.version,
  });

  if (config.integrationMode === 'mock') {
    logger.info(
      'Integration mode is "mock": tasks produce clearly-labelled simulated data and no Discord traffic is generated.',
    );
  }

  const api = new OrionApiClient(config, logger);
  const discord = new DiscordService(config, logger);

  if (config.discord.token) {
    try {
      await discord.connect();
    } catch (error) {
      if (config.integrationMode === 'channel') {
        logger.error((error as Error).message);
        logger.error(
          'Channel mode requires a working Discord connection. Fix the credentials and restart the worker.',
        );
        process.exitCode = 1;
        return;
      }
      logger.warn(
        `${(error as Error).message} Continuing in mock mode without Discord connectivity.`,
      );
    }
  } else {
    logger.info('No DISCORD_BOT_TOKEN configured; Discord is disabled for this worker.');
  }

  if (config.integrationMode === 'channel') {
    try {
      await discord.validateChannel();
    } catch (error) {
      logger.error(`Discord channel validation failed: ${(error as Error).message}`);
      await discord.destroy();
      process.exitCode = 1;
      return;
    }
  }

  const adapter = createIntegrationAdapter(config, discord, logger);
  const spool = new ResultSpool(config.spoolPath, logger);
  await spool.load();

  const executor = new TaskExecutor(adapter, config, logger);
  const runner = new TaskRunner(api, spool, executor, config, logger);
  const heartbeat = new HeartbeatService(
    api,
    config,
    discord,
    () => runner.getCurrentTaskId(),
    logger,
  );

  runner.start();
  heartbeat.start();

  logger.info(`Worker ready. Polling ${api.describeTarget()} every ${config.pollIntervalMs}ms.`);

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}. Stopping gracefully…`);
    heartbeat.stop();
    await runner.stop();
    await discord.destroy();
    logger.info('Worker stopped.');
    process.exit(0);
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  });
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    void shutdown('uncaughtException');
  });
}

main().catch((error) => {
  if (error instanceof ConfigError) {
    console.error(formatConfigError(error));
  } else {
    console.error('ORION CONTROL worker failed to start:', error);
  }
  process.exit(1);
});
