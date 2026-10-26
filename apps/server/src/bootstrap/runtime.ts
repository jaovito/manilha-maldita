import { registerAccountRoutes } from '../modules/accounts/adapters/inbound/account-http';
import { registerAccountMaintenanceRoutes } from '../modules/accounts/adapters/inbound/account-maintenance-http';
import { hashAccountSessionToken } from '../modules/accounts/adapters/outbound/crypto-session-token';
import { registerPlayerRoutes } from '../modules/progression/adapters/inbound/player-http';
import { createRoomService, createRuntimePorts } from '../modules/rooms';
import { createSessions } from '../modules/sessions';
import { createLimiter, createTransport } from '../modules/transport';
import { DEFAULT_ORIGINS, SERVER_DEFAULTS, type ServerOptions } from './environment';
import { createPlayerAuthenticator } from './player-authenticator';

export { DEFAULT_ORIGINS, type ServerOptions } from './environment';

export function startServer(options: ServerOptions = {}) {
  const backend = options.backend;
  const accounts = backend?.accounts ?? options.accounts;

  if (
    accounts &&
    !['development', 'test'].includes(options.environment ?? SERVER_DEFAULTS.environment) &&
    !options.secureCookies
  )
    throw new Error('SECURE_ACCOUNT_COOKIES_REQUIRED');

  const operationalPorts = createRuntimePorts();
  const ports = options.ports ?? operationalPorts;
  const configuredPorts = backend ? { ...ports, results: backend.results } : ports;
  const rooms = createRoomService(configuredPorts, {
    soloEnabled: options.soloEnabled ?? SERVER_DEFAULTS.soloEnabled,
    devTools:
      options.environment === 'development' && (options.devTools ?? SERVER_DEFAULTS.devTools),
  });
  const sessions = createSessions(operationalPorts.now);
  const identity = backend
    ? createPlayerAuthenticator(
        backend.accounts,
        backend.players,
        sessions,
        hashAccountSessionToken,
        {
          now: operationalPorts.now,
          schedule: (delay, callback) =>
            operationalPorts.schedule(operationalPorts.now() + delay, callback),
        },
        backend.leaseMs,
      )
    : null;
  const unsubscribe = identity ? accounts?.subscribeRevocations(identity.revoke) : undefined;
  const transport = createTransport({
    rooms,
    sessions,
    accountsEnabled: Boolean(backend),
    ...(identity ? { playerAuthenticator: identity.authenticator } : {}),
    ...(backend ? { ready: backend.ready } : {}),
    limiter: createLimiter(operationalPorts.now),
    soloEnabled: options.soloEnabled ?? SERVER_DEFAULTS.soloEnabled,
    allowedOrigins: options.allowedOrigins ?? DEFAULT_ORIGINS,
    secureCookies: options.secureCookies ?? SERVER_DEFAULTS.secureCookies,
    now: operationalPorts.now,
    ...(options.trustedProxies ? { trustedProxies: options.trustedProxies } : {}),
    ...(accounts
      ? {
          registerAccounts: (app) => {
            registerAccountRoutes(
              app,
              accounts,
              options.allowedOrigins ?? DEFAULT_ORIGINS,
              options.secureCookies ?? false,
              options.trustedProxies,
            );

            if (backend) {
              registerAccountMaintenanceRoutes(
                app,
                backend.maintenance,
                options.secureCookies ?? false,
                options.trustedProxies,
              );
              registerPlayerRoutes(app, accounts, backend.players, (accountId, profile) =>
                rooms.updateIdentity(
                  `account_${accountId}`,
                  {
                    accountId,
                    appearance: profile.appearance,
                  },
                  profile.nickname,
                ),
              );
            }
          },
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
        unsubscribe?.();
        await identity?.close();
        await backend?.close();
      },
    };
  } catch (error) {
    transport.close();
    rooms.close();
    unsubscribe?.();
    void identity?.close();
    throw error;
  }
}
