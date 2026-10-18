import { type Ports, RoomService } from '../modules/rooms';
import { createTransport } from './transport';

type RuntimeSources = Readonly<{
  wallTime?: () => number;
  randomValues?: (values: Uint32Array) => void;
  timer?: (delay: number, callback: () => void) => () => void;
}>;

/** Epoch milliseconds remain suitable for UI deadlines; backward wall-clock jumps cannot extend time. */
export function createRuntimePorts(sources: RuntimeSources = {}): Ports {
  const wallTime = sources.wallTime ?? Date.now;
  const randomValues =
    sources.randomValues ??
    ((values) => {
      crypto.getRandomValues(values);
    });
  const timer =
    sources.timer ??
    ((delay, callback) => {
      const handle = setTimeout(callback, delay);

      return () => clearTimeout(handle);
    });

  let lastTime = wallTime();
  const now = () => {
    lastTime = Math.max(lastTime, wallTime());

    return lastTime;
  };

  return {
    now,
    id: () => crypto.randomUUID(),
    randomInt(exclusiveMax) {
      if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax < 1 || exclusiveMax > 2 ** 32) {
        throw new Error('INVALID_RANDOM_BOUND');
      }

      const range = 2 ** 32;
      const limit = Math.floor(range / exclusiveMax) * exclusiveMax;
      const values = new Uint32Array(1);

      do {
        randomValues(values);
      } while ((values[0] ?? range) >= limit);

      return (values[0] ?? 0) % exclusiveMax;
    },
    schedule(at, callback) {
      if (!Number.isFinite(at) || at < 0) throw new Error('INVALID_SCHEDULE_TIME');

      let cancelled = false;
      let cancelTimer: () => void = () => {};
      const arm = () => {
        cancelTimer = timer(Math.max(1, Math.min(2147483647, at - now())), () => {
          if (cancelled) return;
          if (now() < at) arm();
          else callback();
        });
      };
      arm();

      return () => {
        cancelled = true;
        cancelTimer();
      };
    },
  };
}

export type ServerOptions = Readonly<{
  port?: number;
  hostname?: string;
  allowedOrigins?: readonly string[];
  secureCookies?: boolean;
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
  const rooms = new RoomService(ports);
  const transport = createTransport({
    rooms,
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
