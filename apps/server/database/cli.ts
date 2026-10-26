import { runDatabaseCommand } from './commands';

try {
  console.log(await runDatabaseCommand(process.argv.slice(2)));
} catch {
  console.error('Database command failed. Check the target, TLS, permissions and migration state.');
  process.exitCode = 1;
}
