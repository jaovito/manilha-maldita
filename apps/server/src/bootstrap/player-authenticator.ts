import type { AccountApplication } from '../modules/accounts';
import type { PlayerApplication } from '../modules/progression';
import type { SessionApplication } from '../modules/sessions';
import type { PlayerAuthenticator, PlayerSession } from '../modules/transport';

export type PlayerAuthenticationRuntime = Readonly<{
  now(): number;
  schedule(delayMs: number, callback: () => void): () => void;
}>;

const MAX_AUTHORIZATIONS = 2048;

type Validation = { hash: string; accountId: string | null; validUntil: number; revoked: boolean };

type Lease = {
  checkedUntil: number;
  expiresAt: number;
  accountId: string;
  closers: Set<() => void>;
};

/** Five-second revocation lease, refreshed away from gameplay. Storage failure expires it closed. */
export function createPlayerAuthenticator(
  accounts: AccountApplication,
  players: PlayerApplication,
  guests: SessionApplication,
  tokenHash: (token: unknown) => Promise<string | null>,
  runtime: PlayerAuthenticationRuntime,
  leaseMs: number,
) {
  if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 10_000)
    throw new Error('INVALID_AUTH_LEASE');

  const leases = new Map<string, Lease>();
  const tickets = new WeakMap<PlayerSession, Validation>();
  const retained = new WeakMap<PlayerSession, Lease>();
  const validations = new Set<Validation>();
  let cancel: (() => void) | null = null;
  let refreshing: Promise<void> | null = null;
  let stopped = false;

  const invalidate = (hash: string) => {
    const lease = leases.get(hash);
    leases.delete(hash);

    for (const close of lease?.closers ?? []) {
      try {
        close();
      } catch {
        /* All other leases still need revocation. */
      }
    }
  };
  const arm = () => {
    if (cancel || refreshing || stopped || !leases.size) return;

    cancel = runtime.schedule(Math.floor(leaseMs / 2), () => {
      cancel = null;
      const keys = [...leases.keys()];
      let next = 0;
      const scan = async () => {
        while (next < keys.length && !stopped) {
          const hash = keys[next++];

          if (!hash) continue;

          const lease = leases.get(hash);

          if (!lease) continue;

          const checkedAt = runtime.now();

          try {
            const account = await accounts.sessionByHash(hash);

            if (leases.get(hash) !== lease) continue;
            if (
              !account ||
              account.accountId !== lease.accountId ||
              runtime.now() >= checkedAt + leaseMs
            ) {
              invalidate(hash);
              continue;
            }

            lease.expiresAt = account.expiresAt;
            lease.checkedUntil = checkedAt + leaseMs;
          } catch {
            if (leases.get(hash) === lease && runtime.now() >= lease.checkedUntil) invalidate(hash);
          }
        }
      };
      refreshing = Promise.all([scan(), scan(), scan(), scan()])
        .then(() => {})
        .finally(() => {
          refreshing = null;
          arm();
        });
    });
  };
  const authenticator: PlayerAuthenticator = {
    async resolve(guestToken, accountToken) {
      if (stopped) return undefined;
      if (accountToken === undefined) return guests.find(guestToken);

      const validUntil = runtime.now() + leaseMs;
      const hash = await tokenHash(accountToken);

      if (!hash) return undefined;

      for (const ticket of validations)
        if (runtime.now() >= ticket.validUntil) validations.delete(ticket);
      if (stopped || validations.size >= MAX_AUTHORIZATIONS) throw new Error('SESSION_CAPACITY');

      const ticket: Validation = { hash, accountId: null, validUntil, revoked: false };
      validations.add(ticket);
      let issued = false;

      try {
        const account = await accounts.sessionByHash(hash);

        if (!account) return undefined;

        ticket.accountId = account.accountId;
        const profile = await players.current(account.accountId);

        if (!profile || stopped || ticket.revoked || runtime.now() >= validUntil) return undefined;

        const session: PlayerSession = {
          id: `account_${account.accountId}`,
          nickname: profile.nickname,
          expiresAt: account.expiresAt,
          credentialId: hash,
          identity: { accountId: account.accountId, appearance: profile.appearance },
        };
        tickets.set(session, ticket);
        issued = true;

        return session;
      } finally {
        if (!issued) validations.delete(ticket);
      }
    },
    retain(session, close) {
      const hash = session.credentialId;
      const accountId = session.identity?.accountId;

      if (!hash || !accountId) return () => {};
      if (stopped || (!leases.has(hash) && leases.size >= MAX_AUTHORIZATIONS))
        throw new Error('SESSION_CAPACITY');

      const ticket = tickets.get(session);

      if (
        !ticket ||
        ticket.revoked ||
        runtime.now() >= ticket.validUntil ||
        runtime.now() >= session.expiresAt
      )
        throw new Error('UNAUTHENTICATED');

      tickets.delete(session);
      validations.delete(ticket);

      let lease = leases.get(hash);

      if (!lease) {
        lease = {
          checkedUntil: ticket.validUntil,
          expiresAt: session.expiresAt,
          accountId,
          closers: new Set(),
        };
        leases.set(hash, lease);
      }

      lease.checkedUntil = Math.max(lease.checkedUntil, ticket.validUntil);
      lease.expiresAt = session.expiresAt;
      lease.closers.add(close);
      retained.set(session, lease);
      arm();

      return () => {
        retained.delete(session);
        lease?.closers.delete(close);

        if (!lease?.closers.size && leases.get(hash) === lease) leases.delete(hash);
      };
    },
    valid(session: PlayerSession) {
      if (runtime.now() >= session.expiresAt) return false;
      if (!session.credentialId) return true;

      const lease = retained.get(session);

      return (
        !!lease &&
        leases.get(session.credentialId) === lease &&
        runtime.now() < lease.checkedUntil &&
        runtime.now() < lease.expiresAt
      );
    },
  };

  return {
    authenticator,
    revoke(event: Readonly<{ tokenHash: string } | { accountId: string }>) {
      for (const ticket of validations) {
        if (
          'tokenHash' in event
            ? ticket.hash === event.tokenHash
            : ticket.accountId === null || ticket.accountId === event.accountId
        )
          ticket.revoked = true;
      }
      if ('tokenHash' in event) invalidate(event.tokenHash);
      else
        for (const [hash, lease] of leases)
          if (lease.accountId === event.accountId) invalidate(hash);
    },
    async close() {
      stopped = true;
      cancel?.();
      cancel = null;
      for (const hash of leases.keys()) invalidate(hash);
      validations.clear();
      await refreshing;
    },
  };
}
