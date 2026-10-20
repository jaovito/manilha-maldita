import { createRoomService, createRuntimePorts } from '../modules/rooms';
import { createSessions } from '../modules/sessions';
import { createLimiter, createTransport } from '../modules/transport';

export type ServerOptions = Readonly<{
  port?: number;
  hostname?: string;
  allowedOrigins?: readonly string[];
  secureCookies?: boolean;
  environment?: string;
  soloEnabled?: boolean;
  devTools?: boolean;
}>;

export const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3001',
] as const;

export function startServer(options: ServerOptions = {}) {
  const ports = createRuntimePorts();
  const rooms = createRoomService(ports, {
    soloEnabled: options.soloEnabled === true,
    devTools: options.environment === 'development' && options.devTools === true,
  });
  const transport = createTransport({
    rooms,
    sessions: createSessions(ports.now),
    limiter: createLimiter(ports.now),
    soloEnabled: options.soloEnabled === true,
    allowedOrigins: options.allowedOrigins ?? DEFAULT_ORIGINS,
    secureCookies: options.secureCookies ?? false,
    now: ports.now,
  });

  try {
    const server = Bun.serve({
      port: options.port ?? 3001,
      hostname: options.hostname ?? '127.0.0.1',
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
