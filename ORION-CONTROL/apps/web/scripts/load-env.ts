/**
 * Minimal .env loader for standalone scripts.
 *
 * Next.js loads env files itself, but `tsx scripts/*.ts` does not. Reading them
 * here keeps local scripts working with the same apps/web/.env.local file.
 * Existing process environment values always win.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function loadEnvFiles(): void {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!existsSync(fullPath)) continue;

    const contents = readFileSync(fullPath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const key = match[1];
      if (!key || process.env[key] !== undefined) continue;
      let value = match[2] ?? '';
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
