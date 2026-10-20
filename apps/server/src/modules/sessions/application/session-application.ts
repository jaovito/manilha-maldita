import type { SessionDependencies } from './ports/session-dependencies';
import { findSession } from './use-cases/find-session';
import { issueSession } from './use-cases/issue-session';
import { renameSession } from './use-cases/rename-session';

export function createSessionApplication(dependencies: SessionDependencies) {
  return {
    issue: (nickname: string) => issueSession(dependencies, nickname),
    find: (token: string | undefined) => findSession(dependencies, token),
    rename: (token: string, nickname: string) => renameSession(dependencies, token, nickname),
    clear: () => dependencies.repository.clear(),
  };
}

export type SessionApplication = ReturnType<typeof createSessionApplication>;
