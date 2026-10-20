import type { RoomPort } from '../rooms';
import type { SessionApplication } from '../sessions';
import type { createLimiter } from './adapters/rate-limiter';

export const SESSION_COOKIE = 'truco_session';
export const MAX_MESSAGE_BYTES = 8192;

export type TransportDependencies = Readonly<{
  rooms: RoomPort;
  sessions: SessionApplication;
  limiter: ReturnType<typeof createLimiter>;
  allowedOrigins: readonly string[];
  secureCookies?: boolean;
  soloEnabled?: boolean;
  now: () => number;
}>;
