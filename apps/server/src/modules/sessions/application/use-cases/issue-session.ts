import type { SessionDependencies } from '../ports/session-dependencies';

export function issueSession(dependencies: SessionDependencies, nickname: string) {
  const { repository, now, credentials, maximum, ttlMs } = dependencies;
  repository.removeExpired(now());

  if (repository.size >= maximum) throw new Error('SESSION_CAPACITY');

  const { token, id } = credentials();
  const session = { id, nickname, expiresAt: now() + ttlMs };
  repository.save(token, session);

  return { token, session };
}
