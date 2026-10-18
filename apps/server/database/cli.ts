import { connectLocalDatabase } from './connect';
import { migrateLocalDatabase } from './migrate';
import { developmentSeeds } from './seeds/registry';
import { runSeeds } from './seeds/run';

const action = process.argv[2];
if (action !== 'migrate' && action !== 'seed') throw new Error('Use migrate or seed.');
const target = process.argv.includes('--test') ? 'test' : 'development';
const connection = connectLocalDatabase(target);
try {
  if (action === 'migrate') {
    await migrateLocalDatabase(connection.db);
    console.log(`Local migrations applied: ${target}.`);
  } else {
    const ids = await runSeeds(connection.db, developmentSeeds);
    console.log(
      ids.length ? `Seeds applied: ${ids.join(', ')}.` : 'No product seeds registered yet.',
    );
  }
} finally {
  await connection.close();
}
