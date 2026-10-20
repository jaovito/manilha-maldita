import type { SessionRepository } from '../../application/ports/session-repository';
import { type GuestSession, isSessionActive } from '../../domain/entities/guest-session';

/** Process-local only: no bearer credentials are persisted. */
export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, GuestSession>();

  get size() {
    return this.sessions.size;
  }

  find(token: string) {
    return this.sessions.get(token);
  }

  save(token: string, session: GuestSession) {
    this.sessions.set(token, session);
  }

  remove(token: string) {
    this.sessions.delete(token);
  }

  removeExpired(time: number) {
    for (const [token, session] of this.sessions) {
      if (!isSessionActive(session, time)) this.sessions.delete(token);
    }
  }

  clear() {
    this.sessions.clear();
  }
}
