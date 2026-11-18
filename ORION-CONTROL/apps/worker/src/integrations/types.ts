import type { TaskType } from '@orion/shared';

export type IntegrationMode = 'mock' | 'channel';

export interface IntegrationRequest {
  taskId: string;
  type: TaskType;
  payload: Record<string, unknown>;
  timeoutMs: number;
  signal: AbortSignal;
}

export interface IntegrationResult {
  /** Verbatim response for the audit trail (message text, embeds, payload). */
  rawResponse: string;
  /** Validated domain object; the website re-validates before storing it. */
  parsedResponse: unknown;
  notes?: string[];
}

export interface IntegrationAdapter {
  readonly name: string;
  readonly mode: IntegrationMode;
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = true,
    readonly rawResponse?: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}
