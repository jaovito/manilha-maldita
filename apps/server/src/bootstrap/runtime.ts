import { registerAccountRoutes } from '../modules/accounts/adapters/inbound/account-http';
import { DEFAULT_ORIGINS, SERVER_DEFAULTS, type ServerOptions } from './environment';
import { createRoomService, createRuntimePorts } from '../modules/rooms';
import { createSessions } from '../modules/sessions';
import { createLimiter, createTransport } from '../modules/transport';

export { DEFAULT_ORIGINS, type ServerOptions } from './environment';

export function startServer(options: ServerOptions = {}) {
  const accounts = options.accounts;

  if (
    accounts &&
    (options.environment ?? SERVER_DEFAULTS.environment) === 'production' &&
    !options.secureCookies
  )
    throw new Error('SECURE_ACCOUNT_COOKIES_REQUIRED');

  const ports = createRuntimePorts();
  const rooms = createRoomService(ports, {
    soloEnabled: options.soloEnabled ?? SERVER_DEFAULTS.soloEnabled,
    devTools:
      options.environment === 'development' && (options.devTools ?? SERVER_DEFAULTS.devTools),
  });
  const transport = createTransport({
    rooms,
    sessions: createSessions(ports.now),
    limiter: createLimiter(ports.now),
    soloEnabled: options.soloEnabled ?? SERVER_DEFAULTS.soloEnabled,
    allowedOrigins: options.allowedOrigins ?? DEFAULT_ORIGINS,
    secureCookies: options.secureCookies ?? SERVER_DEFAULTS.secureCookies,
    now: ports.now,
    ...(accounts
      ? {
          registerAccounts: (app) =>
            registerAccountRoutes(
              app,
              accounts,
              options.allowedOrigins ?? DEFAULT_ORIGINS,
              options.secureCookies ?? false,
            ),
        }
      : {}),
  });

  try {
    const server = Bun.serve({
      port: options.port ?? SERVER_DEFAULTS.port,
      hostname: options.hostname ?? SERVER_DEFAULTS.hostname,
      fetch: transport.app.fetch,
      websocket: {
        ...transport.websocket,
        maxPayloadLength: 8192,
        idleTimeout: 120,
        sendPings: true,
      },
    });

    let stopped = false;

    return {
      server,
      rooms,
      async stop() {
        if (stopped) return;

        stopped = true;
        transport.close();
        rooms.close();
        await server.stop(true);
      },
    };
  } catch (error) {
    transport.close();
    rooms.close();
    throw error;
  }
}
