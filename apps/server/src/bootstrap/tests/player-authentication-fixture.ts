import { authenticationFixture } from '../../modules/accounts/application/tests/authentication-fixture';
import { createAccountApplication } from '../../modules/accounts';
import { appearanceFor, createPlayerApplication } from '../../modules/progression';
import { createSessions } from '../../modules/sessions';
import { createPlayerAuthenticator } from '../player-authenticator';

export const flushAuthentication = async () => {
  for (let index = 0; index < 40; index++) await Promise.resolve();
};

export function playerAuthenticationFixture() {
  const base = authenticationFixture();
  let now = 0;
  let sequence = 0;
  const timers = new Map<number, () => void>();
  let lookup = () => base.dependencies.repository.findSession('b'.repeat(64));
  const accounts = createAccountApplication({
    ...base.dependencies,
    repository: { ...base.dependencies.repository, findSession: () => lookup() },
  });
  const players = createPlayerApplication({
    async matchReward() {
      return { status: 'pending' };
    },
    async current() {
      return {
        nickname: 'Player',
        xp: '0',
        competitivePoints: '0',
        level: '1',
        appearance: appearanceFor(null, null, null),
      };
    },
    async catalog() {
      return { xpPerLevel: '500', avatars: [], decks: [], tables: [] };
    },
    async ranking() {
      return { entries: [], nextPage: null };
    },
    async select() {
      throw new Error('unused');
    },
    async rename() {},
  });
  const guests = createSessions(() => now);
  const runtime = {
    now: () => now,
    schedule(_delay: number, callback: () => void) {
      const id = sequence++;
      timers.set(id, callback);

      return () => {
        timers.delete(id);
      };
    },
  };
  const identity = createPlayerAuthenticator(
    accounts,
    players,
    guests,
    base.dependencies.tokenHash,
    runtime,
    5000,
  );

  return {
    ...identity,
    base,
    accounts,
    players,
    guests,
    runtime,
    timers,
    setNow(value: number) {
      now = value;
    },
    setLookup(value: typeof lookup) {
      lookup = value;
    },
    resolve: () => identity.authenticator.resolve(undefined, 'a'.repeat(64)),
    async session() {
      const session = await identity.authenticator.resolve(undefined, 'a'.repeat(64));
      if (!session) throw new Error('Missing fixture session');

      return session;
    },
    fire() {
      const next = timers.entries().next().value;
      if (!next) throw new Error('Missing fixture timer');

      timers.delete(next[0]);
      next[1]();
    },
  };
}
