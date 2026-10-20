import { isSessionActive } from '../../domain/entities/guest-session';
import type { SessionDependencies } from '../ports/session-dependencies';

export function renameSession(
  { repository, now }: Pick<SessionDependencies, 'repository' | 'now'>,
  token: string,
  nickname: string,
) {
  const session = repository.find(token);
  if (!session || !isSessionActive(session, now())) return undefined;

  const renamed = { ...session, nickname };
  repository.save(token, renamed);

  return renamed;
}
