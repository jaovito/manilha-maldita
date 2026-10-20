import type { GuestSession } from '../../domain/entities/guest-session';

/** Bearer credentials stay inside this boundary, never in room identities. */
export interface SessionRepository {
  readonly size: number;
  find(token: string): GuestSession | undefined;
  save(token: string, session: GuestSession): void;
  remove(token: string): void;
  removeExpired(time: number): void;
  clear(): void;
}
