/**
 * Small structured logger. Secrets must never reach the log: helpers here
 * redact token-like values defensively.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, details?: Record<string, unknown>): void;
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

const SECRET_KEY_PATTERN = /(token|secret|key|password|authorization)/i;
const TOKEN_VALUE_PATTERN = /([A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,})/g;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (typeof value === 'string') {
    if (value.length > 24 && /^[A-Za-z0-9._-]+$/.test(value)) return '[redacted]';
    return value.replace(TOKEN_VALUE_PATTERN, '[redacted-token]');
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redact(entry, depth + 1),
      ]),
    );
  }
  return value;
}

export function createLogger(level: LogLevel): Logger {
  const threshold = ORDER[level];

  function write(entryLevel: LogLevel, message: string, details?: Record<string, unknown>) {
    if (ORDER[entryLevel] < threshold) return;
    const line = `${new Date().toISOString()} ${entryLevel.toUpperCase().padEnd(5)} ${message}`;
    const output = details ? `${line} ${JSON.stringify(redact(details))}` : line;
    if (entryLevel === 'error') console.error(output);
    else if (entryLevel === 'warn') console.warn(output);
    else console.log(output);
  }

  return {
    debug: (message, details) => write('debug', message, details),
    info: (message, details) => write('info', message, details),
    warn: (message, details) => write('warn', message, details),
    error: (message, details) => write('error', message, details),
  };
}

/** Only used to log which Discord bot connected — never the token itself. */
export function maskSecret(value: string | null | undefined, visible = 4): string {
  if (!value) return 'not configured';
  if (value.length <= visible) return '••••';
  return `••••${value.slice(-visible)}`;
}
