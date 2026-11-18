/**
 * Database migration runner.
 *
 * Applies every .sql file in database/migrations exactly once, in filename
 * order, inside a transaction. Safe to run repeatedly.
 *
 * Usage:  npm run db:migrate
 */

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { loadEnvFiles } from './load-env';

loadEnvFiles();

async function resolveMigrationsDirectory(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), 'database/migrations'),
    path.resolve(process.cwd(), '../../database/migrations'),
    path.resolve(process.cwd(), '../database/migrations'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next location.
    }
  }
  throw new Error(
    `Could not find the migrations directory. Looked in:\n${candidates.map((value) => `  - ${value}`).join('\n')}`,
  );
}

async function main(): Promise<void> {
  const connectionString = (process.env.DATABASE_URL ?? '').trim();
  if (!connectionString) {
    console.error(
      [
        'DATABASE_URL is not set.',
        '',
        'Create a free PostgreSQL database (Neon or Supabase), copy its connection',
        'string into apps/web/.env.local, then run this command again.',
        'See docs/DEPLOYMENT.md for the full walkthrough.',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const directory = await resolveMigrationsDirectory();
  const host = (() => {
    try {
      return new URL(connectionString).host;
    } catch {
      return 'configured database';
    }
  })();

  console.log(`Connecting to ${host} …`);
  const client = new Client({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (await client.query<{ id: string }>('select id from schema_migrations')).rows.map((row) => row.id),
    );

    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`↷ ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(path.join(directory, file), 'utf8');
      console.log(`→ ${file}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (id) values ($1)', [file]);
        await client.query('commit');
        console.log(`✓ ${file} applied`);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed and was rolled back: ${(error as Error).message}`);
      }
    }

    console.log('\nMigrations complete.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('\nMigration failed:', (error as Error).message);
  process.exitCode = 1;
});
