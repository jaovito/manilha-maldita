import { parseServerOptions, type ServerEnvironment } from './environment';
import { createPersistentBackend } from './persistent-backend';
import { startServer } from './runtime';

export { parseServerOptions } from './environment';

export async function main(env: ServerEnvironment = Bun.env) {
  const options = parseServerOptions(env);
  const backend = await createPersistentBackend(env);

  try {
    return startServer({ ...options, ...(backend ? { backend } : {}) });
  } catch (error) {
    await backend?.close();
    throw error;
  }
}

export function startupFailed() {
  console.error('SERVER_START_FAILED');
  process.exitCode = 1;
}

export async function shutdown(runtime: { stop(): Promise<void> }) {
  try {
    await runtime.stop();
  } catch {
    console.error('SERVER_STOP_FAILED');
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  const runtime = await main().catch(startupFailed);
  if (runtime) {
    process.once('SIGTERM', shutdown.bind(null, runtime));
    process.once('SIGINT', shutdown.bind(null, runtime));
  }
}
