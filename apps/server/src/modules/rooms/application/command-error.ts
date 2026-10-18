const SAFE_ERRORS = new Set([
  'STALE_CONTEXT',
  'STALE_REVISION',
  'INVALID_PHASE',
  'INVALID_COMMAND',
  'NOT_HOST',
  'NOT_READY',
  'ROOM_FULL',
  'SEAT_TAKEN',
  'INVALID_SEAT',
  'NOT_YOUR_TURN',
  'CARD_NOT_OWNED',
  'INVALID_CARD',
  'INVALID_COVERED_PLAY',
  'TEAM_CANNOT_RAISE',
  'MAXIMUM_STAKE',
  'TEAM_CANNOT_RESPOND',
  'NOT_YOUR_DECISION',
  'DECISION_PAUSED',
]);

/** Only rule codes cross the transport boundary; unexpected exception details stay private. */
export function commandError(error: unknown): string {
  return error instanceof Error && SAFE_ERRORS.has(error.message)
    ? error.message
    : 'INVALID_COMMAND';
}
