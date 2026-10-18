import type { Room } from './types';

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
