import { clientMessageSchema, roomCodeSchema } from '@truco/game-protocol';
import type { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import {
  SESSION_COOKIE as COOKIE,
  MAX_MESSAGE_BYTES as MAX_BYTES,
  type TransportDependencies,
} from '../../../contracts';
import { sendSocketMessage } from '../../outbound/socket-publisher';
import { errorCode } from '../errors';

export function registerRoomSocket(
  app: Hono,
  options: TransportDependencies,
  sockets: Set<{ close(): void }>,
) {
  const { sessions, limiter, now } = options;

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
}
