import type { SessionRepository } from './session-repository';

export type SessionDependencies = Readonly<{
  repository: SessionRepository;
  now: () => number;
  credentials: () => Readonly<{ token: string; id: string }>;
  maximum: number;
  ttlMs: number;
}>;
