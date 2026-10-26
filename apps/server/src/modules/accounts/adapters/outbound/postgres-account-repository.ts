import type { SQL, TransactionSQL } from 'bun';
import type {
  AccountRepository,
  AccountSessionProfile,
  LoginRecord,
} from '../../application/ports/authentication';

type ProfileRow = { account_id: string; nickname: string };

export function createPostgresAccountRepository(client: SQL): AccountRepository {
  const inTransaction = <T>(run: (tx: TransactionSQL) => Promise<T>): Promise<T> =>
    client.begin(async (tx) => {
      await tx`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`;

      return run(tx);
    });

  return {
    register(login, passwordHash, nickname, tokenHash, ttlMs) {
      return inTransaction(async (tx) => {
        const [account] = await tx<
          { id: string }[]
        >`INSERT INTO app.accounts (login_name, password_hash)
          VALUES (${login}, ${passwordHash}) ON CONFLICT (login_name) DO NOTHING RETURNING id`;

        if (!account) return null;

        await tx`INSERT INTO app.profiles (account_id, nickname) VALUES (${account.id}, ${nickname})`;
        await tx`INSERT INTO app.player_progress (account_id) VALUES (${account.id})`;
        await tx`INSERT INTO app.sessions (account_id, token_hash, expires_at)
          VALUES (${account.id}, ${tokenHash}, statement_timestamp() + ${ttlMs} * interval '1 millisecond')`;

        return { accountId: account.id, nickname };
      });
    },

    findLogin(login) {
      return inTransaction<LoginRecord | null>(async (tx) => {
        const [row] = await tx<(ProfileRow & { password_hash: string; status: string })[]>`
          SELECT a.id AS account_id, p.nickname, a.password_hash, a.status
          FROM app.accounts a JOIN app.profiles p ON p.account_id = a.id WHERE a.login_name = ${login}`;

        return row
          ? {
              accountId: row.account_id,
              nickname: row.nickname,
              passwordHash: row.password_hash,
              active: row.status === 'active',
            }
          : null;
      });
    },

    issueSession(accountId, tokenHash, ttlMs, previousHash, verifiedPasswordHash) {
      return inTransaction(async (tx) => {
        // Bind issuance to the credential actually verified before Argon2 released control.
        const [account] =
          await tx`SELECT id FROM app.accounts WHERE id = ${accountId} AND status = 'active'
            AND password_hash = ${verifiedPasswordHash} FOR UPDATE`;

        if (!account) return false;

        if (previousHash)
          await tx`UPDATE app.sessions SET revoked_at = clock_timestamp()
          WHERE account_id = ${accountId} AND token_hash = ${previousHash} AND revoked_at IS NULL`;

        await tx`INSERT INTO app.sessions (account_id, token_hash, expires_at)
          VALUES (${accountId}, ${tokenHash}, statement_timestamp() + ${ttlMs} * interval '1 millisecond')`;

        return true;
      });
    },

    findSession(tokenHash) {
      return inTransaction<AccountSessionProfile | null>(async (tx) => {
        const [row] = await tx<
          (ProfileRow & { expires_at: Date })[]
        >`SELECT a.id AS account_id, p.nickname, s.expires_at
          FROM app.sessions s JOIN app.accounts a ON a.id = s.account_id
          JOIN app.profiles p ON p.account_id = a.id
          WHERE s.token_hash = ${tokenHash} AND s.revoked_at IS NULL
            AND s.expires_at > statement_timestamp() AND a.status = 'active'`;

        return row
          ? {
              accountId: row.account_id,
              nickname: row.nickname,
              expiresAt: row.expires_at.getTime(),
            }
          : null;
      });
    },

    revokeSession(tokenHash) {
      return inTransaction(async (tx) => {
        await tx`UPDATE app.sessions SET revoked_at = clock_timestamp()
          WHERE token_hash = ${tokenHash} AND revoked_at IS NULL`;
      });
    },
  };
}
