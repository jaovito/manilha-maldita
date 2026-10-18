import {
  clientMessageSchema,
  createRoomRequestSchema,
  guestRequestSchema,
  joinRoomRequestSchema,
  normalizeConfig,
  roomCodeSchema,
} from '@truco/game-protocol';
import { Hono } from 'hono';
import { getConnInfo, upgradeWebSocket, websocket } from 'hono/bun';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import type { RoomPort } from '../modules/transport/adapters/port';
import { sendSocketMessage } from '../modules/transport/adapters/outbound';
import { createLimiter, createSessions } from '../modules/transport/adapters/sessions';

export type { RoomPort } from '../modules/transport/adapters/port';
const COOKIE = 'truco_session';
const MAX_BYTES = 8192;
const publicErrors = new Set([
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_CLOSED',
  'NOT_MEMBER',
  'NOT_HOST',
  'INVALID_PHASE',
  'INVALID_COMMAND',
  'STALE_CONTEXT',
  'STALE_REVISION',
  'NOT_READY',
  'SEAT_TAKEN',
  'SESSION_CAPACITY',
  'ROOM_CAPACITY',
  'ROOM_BUSY',
  'CONNECTION_REPLACED',
]);
function errorCode(error: unknown): string {
  return error instanceof Error && publicErrors.has(error.message)
    ? error.message
    : 'INTERNAL_ERROR';
}
export function createTransport(options: {
  rooms: RoomPort;
  allowedOrigins: readonly string[];
  secureCookies?: boolean;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const sessions = createSessions(now);
  const limiter = createLimiter(now);
  const sockets = new Set<{ close(): void }>();
  const app = new Hono();

  app.get('/health', (context) => context.json({ status: 'ok' }));

  app.onError((error, context) => context.json({ code: errorCode(error) }, 400));

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BYTES,
      onError: (context) => context.json({ code: 'MESSAGE_TOO_LARGE' }, 413),
    }),
  );

  app.use('/api/*', async (context, next) => {
    if (context.req.method !== 'GET' || context.req.path.endsWith('/ws')) {
      if (!options.allowedOrigins.includes(context.req.header('Origin') ?? ''))
        return context.json({ code: 'FORBIDDEN_ORIGIN' }, 403);
    }
    // Proxy headers are deliberately ignored; only the actual peer identifies an IP.
    let ip = 'local';
    try {
      ip = getConnInfo(context).remote.address ?? 'local';
    } catch {
      /* app.request has no network peer. */
    }
    if (!limiter.allow(`ip:${ip}`, 120)) return context.json({ code: 'RATE_LIMITED' }, 429);
    const length = Number(context.req.header('Content-Length') ?? 0);
    if (length > MAX_BYTES) return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);

    await next();
  });

  app.post('/api/guest', async (context) => {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return context.json({ code: 'INVALID_MESSAGE' }, 400);
    }

    const parsed = guestRequestSchema.safeParse(input);
    if (!parsed.success) return context.json({ code: 'INVALID_MESSAGE' }, 400);
    const existing = sessions.find(getCookie(context, COOKIE));
    if (existing) return context.json({ nickname: existing.nickname });
    const { token, session } = sessions.issue(parsed.data.nickname);
    setCookie(context, COOKIE, token, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: options.secureCookies ?? false,
      path: '/api',
      maxAge: 86400,
    });
    return context.json({ nickname: session.nickname }, 201);
  });

  app.use('/api/*', async (context, next) => {
    const session = sessions.find(getCookie(context, COOKIE));
    if (!session) return context.json({ code: 'UNAUTHENTICATED' }, 401);
    if (!limiter.allow(`session:${session.id}`, 180))
      return context.json({ code: 'RATE_LIMITED' }, 429);

    await next();
  });

  app.get('/api/guest', (context) => {
    const session = sessions.find(getCookie(context, COOKIE));
    return context.json({ nickname: session?.nickname });
  });

  app.post('/api/rooms', async (context) => {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return context.json({ code: 'INVALID_MESSAGE' }, 400);
    }

    const parsed = createRoomRequestSchema.safeParse(input);
    if (!parsed.success) return context.json({ code: 'INVALID_MESSAGE' }, 400);
    const session = sessions.find(getCookie(context, COOKIE));
    if (!session) return context.json({ code: 'UNAUTHENTICATED' }, 401);
    return context.json(
      await options.rooms.create(session.id, session.nickname, normalizeConfig(parsed.data.config)),
      201,
    );
  });

  app.post('/api/rooms/:code/join', async (context) => {
    const code = roomCodeSchema.safeParse(context.req.param('code'));
    let input: unknown;
    const text = await context.req.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);
    try {
      input = JSON.parse(text);
    } catch {
      return context.json({ code: 'INVALID_MESSAGE' }, 400);
    }
    if (!code.success || !joinRoomRequestSchema.safeParse(input).success)
      return context.json({ code: 'INVALID_MESSAGE' }, 400);
    const session = sessions.find(getCookie(context, COOKIE));
    if (!session) return context.json({ code: 'UNAUTHENTICATED' }, 401);
    await options.rooms.join(code.data, session.id, session.nickname);
    return context.json({ code: code.data });
  });

  app.get(
    '/api/rooms/:code/ws',
    async (context, next) => {
      if (context.req.header('Upgrade')?.toLowerCase() !== 'websocket')
        return context.json({ code: 'INVALID_UPGRADE' }, 400);
      if (!roomCodeSchema.safeParse(context.req.param('code')).success)
        return context.json({ code: 'INVALID_MESSAGE' }, 400);
      return next();
    },
    upgradeWebSocket((context) => {
      const session = sessions.find(getCookie(context, COOKIE));
      const code = context.req.param('code') ?? '';
      if (!session) throw new Error('UNAUTHENTICATED');
      let connection: Promise<string>;
      let pending = 0;
      let chain = Promise.resolve();
      let closed = false;
      return {
        onOpen(_event, socket) {
          sockets.add(socket);
          connection = options.rooms.connect(code, session.id, {
            send(message) {
              if (closed) return;
              sendSocketMessage(socket, message, session.expiresAt <= now());
            },
            close() {
              socket.close(1000, 'CONNECTION_REPLACED');
            },
          });
          void connection.catch((error) => {
            sendSocketMessage(
              socket,
              { type: 'ERROR', commandId: null, code: errorCode(error) },
              session.expiresAt <= now(),
            );
            socket.close(1008);
          });
        },
        onMessage(event, socket) {
          if (closed) return;
          if (
            typeof event.data !== 'string' ||
            new TextEncoder().encode(event.data).length > MAX_BYTES
          ) {
            socket.close(1009, 'MESSAGE_TOO_LARGE');
            return;
          }
          if (!limiter.allow(`ws:${session.id}`, 60) || pending >= 16) {
            socket.close(1008, 'RATE_LIMITED');
            return;
          }
          let input: unknown;
          try {
            input = JSON.parse(event.data);
          } catch {
            sendSocketMessage(
              socket,
              { type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' },
              session.expiresAt <= now(),
            );
            return;
          }
          const parsed = clientMessageSchema.safeParse(input);
          if (!parsed.success) {
            sendSocketMessage(
              socket,
              { type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' },
              session.expiresAt <= now(),
            );
            return;
          }
          pending++;
          chain = chain
            .then(async () => {
              if (closed) return;
              if (!sessions.find(getCookie(context, COOKIE))) {
                socket.close(1008, 'SESSION_EXPIRED');
                return;
              }
              const connectionId = await connection;
              const reply = await options.rooms.receive(
                code,
                session.id,
                connectionId,
                parsed.data,
              );
              if (!closed) sendSocketMessage(socket, reply, session.expiresAt <= now());
              if (reply.type === 'ACK' && parsed.data.action.type === 'LEAVE')
                socket.close(1000, 'LEFT_ROOM');
            })
            .catch((error) => {
              if (!closed)
                sendSocketMessage(
                  socket,
                  { type: 'ERROR', commandId: parsed.data.commandId, code: errorCode(error) },
                  session.expiresAt <= now(),
                );
            })
            .finally(() => {
              pending--;
            });
        },
        onClose(_event, socket) {
          closed = true;
          sockets.delete(socket);
          void connection
            ?.then((id) => options.rooms.disconnect(code, session.id, id))
            .catch(() => {});
        },
      };
    }),
  );
  return {
    app,
    websocket,
    close() {
      for (const socket of sockets) socket.close();
      sockets.clear();
      sessions.clear();
      limiter.clear();
    },
  };
}
