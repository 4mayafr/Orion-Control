/**
 * Seed simulated statistics history.
 *
 * Usage:
 *   npm run db:seed            # add only if no statistics exist
 *   npm run db:seed -- --force # add another 30 days anyway
 *   npm run db:seed -- --days=14
 *
 * Everything created here is stored with source = 'simulated' and is labelled as
 * such in the interface. This is placeholder data, not Orion Drift telemetry.
 */

import { getStore } from '../lib/db/index';
import { seedStore } from '../lib/seed';
import { loadEnvFiles } from './load-env';

loadEnvFiles();

async function main(): Promise<void> {
  const daysArgument = process.argv.find((argument) => argument.startsWith('--days='));
  const days = daysArgument ? Number(daysArgument.split('=')[1]) : 30;
  const force = process.argv.includes('--force');

  if (!Number.isFinite(days) || days < 1 || days > 365) {
    console.error('--days must be a number between 1 and 365.');
    process.exitCode = 1;
    return;
  }

  const store = await getStore();
  console.log(`Storage driver: ${store.driver}`);

  const result = await seedStore(store, { days, force });
  if (!result.seeded) {
    console.log(
      'Statistics already exist, so nothing was seeded. Use "-- --force" to add another simulated history block.',
    );
  } else {
    console.log(`Seeded ${result.snapshots} SIMULATED daily snapshots (${days} days).`);
    console.log('They are stored with source = simulated and labelled in the interface.');
  }

  if (store.driver === 'postgres') {
    console.log('\nNext: open the website and create the first administrator at /setup.');
  }

  await store.close();
}

main().catch((error) => {
  console.error('Seeding failed:', (error as Error).message);
  process.exitCode = 1;
});
