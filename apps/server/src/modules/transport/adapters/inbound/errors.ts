const publicErrors = new Set([
  'PERSISTENCE_UNAVAILABLE',
  'SOLO_DISABLED',
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
export function errorCode(error: unknown): string {
  return error instanceof Error && publicErrors.has(error.message)
    ? error.message
    : 'INTERNAL_ERROR';
}
