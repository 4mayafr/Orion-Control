/**
 * Result spool.
 *
 * If the website is unreachable when a task finishes, the result is written to a
 * small JSON file and retried on the next polling cycle. The server is
 * idempotent about results: once a task is no longer running, duplicate
 * submissions are rejected, so a spool replay can never double-execute work.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { WorkerResultRequest } from '@orion/shared';
import type { Logger } from '../logger.js';
import { truncate } from '../util.js';

export interface SpoolEntry {
  taskId: string;
  payload: WorkerResultRequest;
  queuedAt: string;
}

const MAX_ENTRIES = 50;

export class ResultSpool {
  private entries: SpoolEntry[] = [];
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly logger: Logger,
  ) {}

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      this.entries = Array.isArray(parsed) ? (parsed as SpoolEntry[]).slice(-MAX_ENTRIES) : [];
      if (this.entries.length > 0) {
        this.logger.info(`Loaded ${this.entries.length} spooled result(s) awaiting submission.`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Could not read the result spool (${truncate(String(error), 160)}). Starting empty.`);
      }
      this.entries = [];
    }
  }

  list(): SpoolEntry[] {
    return [...this.entries];
  }

  async add(entry: SpoolEntry): Promise<void> {
    this.entries = [...this.entries.filter((item) => item.taskId !== entry.taskId), entry].slice(
      -MAX_ENTRIES,
    );
    await this.persist();
  }

  async remove(taskId: string): Promise<void> {
    const before = this.entries.length;
    this.entries = this.entries.filter((item) => item.taskId !== taskId);
    if (this.entries.length !== before) await this.persist();
  }

  private async persist(): Promise<void> {
    const payload = JSON.stringify(this.entries, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, this.filePath);
    });
    await this.writeChain.catch((error) => {
      this.logger.warn(`Could not write the result spool: ${truncate(String(error), 160)}`);
    });
  }
}
