import { isSessionActive } from '../../domain/entities/guest-session';
import type { SessionDependencies } from '../ports/session-dependencies';

export function findSession(
  { repository, now }: Pick<SessionDependencies, 'repository' | 'now'>,
  token: string | undefined,
) {
  if (!token) return undefined;

  const session = repository.find(token);
  if (session && isSessionActive(session, now())) return session;

  repository.remove(token);
  return undefined;
}
