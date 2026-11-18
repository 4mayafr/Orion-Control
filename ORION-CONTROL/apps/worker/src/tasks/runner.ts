/**
 * Task runner.
 *
 * One task at a time: a Chromebook should stay responsive, and sequential
 * execution keeps Discord rate limits and channel correlation simple. If the
 * website rejects a result permanently (4xx), it is logged; transient failures
 * are spooled to disk and replayed later.
 */

import type { WorkerTaskAssignment } from '@orion/shared';
import type { WorkerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { OrionApiClient, WorkerApiError } from '../services/api-client.js';
import type { ResultSpool } from '../services/result-spool.js';
import { sleep, truncate } from '../util.js';
import { TaskExecutor } from './executor.js';

export class TaskRunner {
  private stopping = false;
  private loopPromise: Promise<void> | null = null;
  private currentTaskId: string | null = null;

  constructor(
    private readonly api: OrionApiClient,
    private readonly spool: ResultSpool,
    private readonly executor: TaskExecutor,
    private readonly config: WorkerConfig,
    private readonly logger: Logger,
  ) {}

  getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  start(): void {
    this.stopping = false;
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.executor.cancelCurrent();
    await this.loopPromise;
    this.loopPromise = null;
  }

  /** Replay results that could not be submitted earlier. */
  private async flushSpool(): Promise<void> {
    const entries = this.spool.list();
    if (entries.length === 0) return;

    for (const entry of entries) {
      if (this.stopping) return;
      try {
        await this.api.submitResult(entry.taskId, entry.payload);
        await this.spool.remove(entry.taskId);
        this.logger.info(`Spooled result for task ${entry.taskId} submitted.`);
      } catch (error) {
        if (error instanceof WorkerApiError && error.status >= 400 && error.status < 500) {
          await this.spool.remove(entry.taskId);
          this.logger.error(
            `Spooled result for ${entry.taskId} was permanently rejected: ${error.message}`,
          );
          continue;
        }
        this.logger.warn(
          `Could not submit spooled result for ${entry.taskId}; will retry later. ${truncate((error as Error).message, 160)}`,
        );
        break;
      }
    }
  }

  private async loop(): Promise<void> {
    await this.flushSpool();

    while (!this.stopping) {
      try {
        const claim = await this.api.claim(this.config.workerId);

        if (claim.task) {
          await this.handleTask(claim.task);
          continue;
        }

        await this.idle(claim.pollAfterMs ?? this.config.pollIntervalMs);
      } catch (error) {
        this.logger.warn(
          `Could not reach the ORION CONTROL API (${truncate((error as Error).message, 200)}). Retrying with backoff.`,
        );
        await this.flushSpool();
        await this.idle(Math.min(15_000, this.config.pollIntervalMs * 3));
      }
    }

    this.logger.info('Worker loop stopped.');
  }

  /** Sleep in small chunks so shutdown is prompt. */
  private async idle(ms: number): Promise<void> {
    const deadline = Date.now() + ms;
    while (!this.stopping && Date.now() < deadline) {
      await sleep(Math.min(250, deadline - Date.now()));
    }
  }

  private async handleTask(task: WorkerTaskAssignment): Promise<void> {
    this.currentTaskId = task.id;
    this.logger.info(`Claimed task ${task.id} (${task.type}), attempt ${task.attempts}/${task.maxAttempts}.`);

    try {
      const payload = await this.executor.execute(task);

      try {
        const response = await this.api.submitResult(task.id, payload);
        this.logger.info(
          `Submitted task ${task.id}: ${response.status}${response.retried ? ' (retry queued by server)' : ''}.`,
        );
      } catch (error) {
        if (error instanceof WorkerApiError && error.status >= 400 && error.status < 500) {
          this.logger.error(
            `Result for task ${task.id} was rejected: ${error.code} — ${error.message}`,
          );
        } else {
          await this.spool.add({
            taskId: task.id,
            payload,
            queuedAt: new Date().toISOString(),
          });
          this.logger.warn(
            `Could not submit result for ${task.id}; spooled for retry. ${truncate((error as Error).message, 160)}`,
          );
        }
      }
    } finally {
      this.currentTaskId = null;
    }
  }
}
