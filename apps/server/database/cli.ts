import { runDatabaseCommand } from './commands';
import { databaseFailureMessage } from './diagnostics';

try {
  console.log(await runDatabaseCommand(process.argv.slice(2)));
} catch (error) {
  console.error(databaseFailureMessage(error));
  process.exitCode = 1;
}
