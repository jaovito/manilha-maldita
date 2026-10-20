import { type ServerMessage, serverMessageSchema } from '@truco/game-protocol';
import type { WSContext } from 'hono/ws';

/** Bound native output queues before every message, including errors and late snapshots. */
export function sendSocketMessage(
  socket: WSContext,
  message: ServerMessage,
  expired: boolean,
): void {
  if (socket.readyState !== 1) return;
  if (expired) {
    socket.close(1008, 'SESSION_EXPIRED');
    return;
  }
  const parsed = serverMessageSchema.safeParse(message);
  if (!parsed.success) {
    socket.close(1011, 'INVALID_SERVER_MESSAGE');
    return;
  }
  const text = JSON.stringify(parsed.data);
  const raw: unknown = socket.raw;
  const buffered =
    typeof raw === 'object' &&
    raw !== null &&
    'getBufferedAmount' in raw &&
    typeof raw.getBufferedAmount === 'function'
      ? raw.getBufferedAmount()
      : 0;
  if (
    new TextEncoder().encode(text).length > 65536 ||
    typeof buffered !== 'number' ||
    buffered > 65536
  ) {
    socket.close(1009, 'OUTPUT_LIMIT');
    return;
  }
  socket.send(text);
}
