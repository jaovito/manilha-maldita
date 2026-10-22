import { parseServerOptions, type ServerEnvironment } from './environment';
import { startServer } from './runtime';

export { parseServerOptions } from './environment';

export function main(env: ServerEnvironment = Bun.env) {
  return startServer(parseServerOptions(env));
}

if (import.meta.main) main();
