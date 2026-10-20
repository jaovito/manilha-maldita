import { createSessionCredentials } from './adapters/outbound/crypto-session-credentials';
import { InMemorySessionRepository } from './adapters/outbound/in-memory-session-repository';
import { createSessionApplication } from './application/session-application';

/** Module composition; transport consumes the application API, not its storage. */
export function createSessions(now: () => number, maximum = 10000, ttlMs = 86400000) {
  return createSessionApplication({
    repository: new InMemorySessionRepository(),
    credentials: createSessionCredentials,
    now,
    maximum,
    ttlMs,
  });
}
