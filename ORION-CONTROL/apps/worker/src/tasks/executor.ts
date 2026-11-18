/**
 * Task executor.
 *
 * Applies the effective timeout (the lower of the server deadline and the local
 * DISCORD_TASK_TIMEOUT), aborts the adapter on expiry and converts every failure
 * into a structured result. Raw responses are preserved even when parsing fails.
 */

import { isTaskType, type WorkerTaskAssignment, type WorkerResultRequest } from '@orion/shared';
import type { WorkerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { IntegrationError, type IntegrationAdapter } from '../integrations/types.js';
import { truncate } from '../util.js';

export class TaskExecutor {
  private current: AbortController | null = null;

  constructor(
    private readonly adapter: IntegrationAdapter,
    private readonly config: WorkerConfig,
    private readonly logger: Logger,
  ) {}

  getAdapterName(): string {
    return this.adapter.name;
  }

  cancelCurrent(): void {
    this.current?.abort();
  }

  async execute(task: WorkerTaskAssignment): Promise<WorkerResultRequest> {
    const startedAt = Date.now();
    const timeoutMs = Math.min(task.timeoutMs, this.config.taskTimeoutMs);
    const controller = new AbortController();
    this.current = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (!isTaskType(task.type)) {
        throw new IntegrationError(
          `This worker does not recognise task type "${task.type}". Update the worker or remove the task.`,
          'UNSUPPORTED_TASK_TYPE',
          false,
        );
      }

      this.logger.info(
        `Executing ${task.type} with ${this.adapter.name} (timeout ${timeoutMs}ms).`,
      );
      const result = await this.adapter.execute({
        taskId: task.id,
        type: task.type,
        payload: task.payload,
        timeoutMs,
        signal: controller.signal,
      });

      return {
        workerId: this.config.workerId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        rawResponse: truncate(result.rawResponse, 199_000),
        parsedResponse: result.parsedResponse,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      if (controller.signal.aborted) {
        return {
          workerId: this.config.workerId,
          status: 'timed_out',
          durationMs: timeoutMs,
          error: {
            code: 'EXECUTION_TIMEOUT',
            message: `No result within ${timeoutMs} ms.`,
            retryable: true,
          },
        };
      }

      if (error instanceof IntegrationError) {
        this.logger.warn(`Task ${task.id} failed: ${error.code} — ${error.message}`);
        return {
          workerId: this.config.workerId,
          status: 'failed',
          durationMs,
          ...(error.rawResponse ? { rawResponse: truncate(error.rawResponse, 199_000) } : {}),
          error: {
            code: error.code,
            message: truncate(error.message, 1_900),
            retryable: error.retryable,
          },
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Task ${task.id} threw an unexpected error: ${message}`);
      return {
        workerId: this.config.workerId,
        status: 'failed',
        durationMs,
        error: {
          code: 'EXECUTION_FAILED',
          message: truncate(message, 1_900),
          retryable: true,
        },
      };
    } finally {
      clearTimeout(timer);
      this.current = null;
    }
  }
}
