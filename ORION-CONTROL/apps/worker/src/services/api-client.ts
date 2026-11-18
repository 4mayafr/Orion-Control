/**
 * HTTP client for the cloud API.
 *
 * All requests are outbound from the Chromebook. Network failures are retried
 * with exponential backoff; 4xx responses (bad key, invalid task) are not
 * retried because repeating them cannot succeed.
 */

import type {
  ClaimResponse,
  HeartbeatRequest,
  WorkerResultRequest,
} from '@orion/shared';
import type { WorkerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { WORKER_VERSION } from '../version.js';
import { sleep, safeJsonParse, truncate } from '../util.js';

export class WorkerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'WorkerApiError';
  }
}

export class OrionApiClient {
  constructor(
    private readonly config: WorkerConfig,
    private readonly logger: Logger,
  ) {}

  private async request<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs?: number },
  ): Promise<T> {
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
      try {
        const response = await fetch(`${this.config.apiUrl}${path}`, {
          method: init.method,
          headers: {
            authorization: `Bearer ${this.config.apiKey}`,
            'content-type': 'application/json',
            'user-agent': `orion-worker/${WORKER_VERSION}`,
          },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: controller.signal,
        });

        const text = await response.text();
        const payload = text ? safeJsonParse<Record<string, unknown>>(text) : null;

        if (!response.ok) {
          const envelope = payload as { error?: { code?: string; message?: string } } | null;
          throw new WorkerApiError(
            envelope?.error?.message ?? `HTTP ${response.status} from ${path}`,
            response.status,
            envelope?.error?.code ?? 'HTTP_ERROR',
            response.status >= 500 || response.status === 429,
          );
        }

        return payload as T;
      } catch (error) {
        const normalized =
          error instanceof Error && error.name === 'AbortError'
            ? new WorkerApiError(`Request to ${path} timed out.`, 0, 'REQUEST_TIMEOUT', true)
            : error;

        const apiError = normalized instanceof WorkerApiError ? normalized : null;
        lastError = normalized instanceof Error ? normalized : new Error(String(normalized));

        if (apiError && !apiError.retryable) break;
        if (attempt === maxAttempts) break;

        const delay = 600 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
        this.logger.warn(
          `API ${init.method} ${path} failed (attempt ${attempt}/${maxAttempts}): ${lastError.message}. Retrying in ${delay}ms.`,
        );
        await sleep(delay);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error(`Request to ${path} failed.`);
  }

  claim(workerId: string): Promise<ClaimResponse> {
    return this.request<ClaimResponse>('/api/worker/tasks/claim', {
      method: 'POST',
      body: { workerId, version: WORKER_VERSION, integrationMode: this.config.integrationMode },
      timeoutMs: 20_000,
    });
  }

  heartbeat(payload: HeartbeatRequest): Promise<{ ok: boolean; serverTime: string }> {
    return this.request('/api/worker/heartbeat', {
      method: 'POST',
      body: payload,
      timeoutMs: 15_000,
    });
  }

  submitResult(
    taskId: string,
    payload: WorkerResultRequest,
  ): Promise<{ ok: boolean; status: string; warnings?: string[]; retried?: boolean }> {
    return this.request(`/api/worker/tasks/${encodeURIComponent(taskId)}/result`, {
      method: 'POST',
      body: payload,
      timeoutMs: 25_000,
    });
  }

  describeTarget(): string {
    return truncate(this.config.apiUrl, 120);
  }
}
