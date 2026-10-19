import type { ClientMessage } from '@truco/game-protocol';
import type { Room } from './state/types';

/** Rejections never poison the next writer; removed/replaced rooms cannot accept stale work. */
export function serializeRoom<T>(room: Room, isCurrent: () => boolean, task: () => T): Promise<T> {
  if (room.pending >= 64) return Promise.reject(new Error('ROOM_BUSY'));

  room.pending++;
  const result = room.chain.then(() => {
    if (!isCurrent()) throw new Error('ROOM_NOT_FOUND');

    return task();
  });
  room.chain = result
    .then(
      () => {},
      () => {},
    )
    .finally(() => {
      room.pending--;
    });

  return result;
}

export function cacheKey(sessionId: string, message: ClientMessage): string {
  return JSON.stringify([sessionId, message.matchId, message.commandId]);
}
