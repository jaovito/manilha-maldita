import { normalizeAuditContext } from '../audit-context';
import type { SQL, TransactionSQL } from 'bun';
import type { AccountMaintenanceRepository } from '../../application/ports/account-maintenance';

export function createPostgresAccountMaintenance(client: SQL): AccountMaintenanceRepository {
  const within = <T>(run: (tx: TransactionSQL) => Promise<T>) =>
    client.begin(async (tx) => {
      await tx`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`;

      return run(tx);
    });

  return {
    credentials(accountId) {
      return within(async (tx) => {
        const [row] = await tx<
          { login_name: string; password_hash: string }[]
        >`SELECT login_name, password_hash FROM app.accounts WHERE id = ${accountId} AND status = 'active'`;

        return row ? { login: row.login_name, passwordHash: row.password_hash } : null;
      });
    },

    setRecovery(accountId, expectedPasswordHash, recoveryHash) {
      return within(async (tx) => {
        const accounts =
          await tx`SELECT id FROM app.accounts WHERE id = ${accountId} AND password_hash = ${expectedPasswordHash} AND status = 'active' FOR UPDATE`;

        if (!accounts.length) return false;

        await tx`INSERT INTO app.account_security (account_id, recovery_hash) VALUES (${accountId}, ${recoveryHash})
          ON CONFLICT (account_id) DO UPDATE SET recovery_hash = EXCLUDED.recovery_hash`;

        return true;
      });
    },

    recoveryAccount(login, recoveryHash) {
      return within(async (tx) => {
        const [row] = await tx<
          { id: string }[]
        >`SELECT a.id FROM app.accounts a JOIN app.account_security s ON s.account_id = a.id
          WHERE a.login_name = ${login} AND a.status = 'active' AND s.recovery_hash = ${recoveryHash}`;

        return row?.id ?? null;
      });
    },

    reset(login, expectedRecoveryHash, newPasswordHash, newRecoveryHash) {
      return within(async (tx) => {
        const [row] = await tx<
          { id: string }[]
        >`SELECT a.id FROM app.accounts a JOIN app.account_security s ON s.account_id = a.id
          WHERE a.login_name = ${login} AND a.status = 'active' AND s.recovery_hash = ${expectedRecoveryHash} FOR UPDATE OF a, s`;

        if (!row) return null;

        await tx`UPDATE app.accounts SET password_hash = ${newPasswordHash} WHERE id = ${row.id}`;
        await tx`UPDATE app.account_security SET recovery_hash = ${newRecoveryHash}, password_changed_at = clock_timestamp() WHERE account_id = ${row.id}`;
        await tx`UPDATE app.sessions SET revoked_at = clock_timestamp() WHERE account_id = ${row.id} AND revoked_at IS NULL`;

        return row.id;
      });
    },

    change(accountId, expectedPasswordHash, newPasswordHash) {
      return within(async (tx) => {
        const [row] = await tx`UPDATE app.accounts SET password_hash = ${newPasswordHash}
          WHERE id = ${accountId} AND password_hash = ${expectedPasswordHash} AND status = 'active' RETURNING id`;

        if (!row) return false;

        await tx`INSERT INTO app.account_security (account_id, recovery_hash) VALUES (${accountId}, NULL)
          ON CONFLICT (account_id) DO UPDATE SET recovery_hash = NULL, password_changed_at = clock_timestamp()`;
        await tx`UPDATE app.sessions SET revoked_at = clock_timestamp() WHERE account_id = ${accountId} AND revoked_at IS NULL`;

        return true;
      });
    },

    delete(accountId, expectedPasswordHash) {
      return within(async (tx) => {
        const rows =
          await tx`DELETE FROM app.accounts WHERE id = ${accountId} AND password_hash = ${expectedPasswordHash} AND status = 'active' RETURNING id`;

        return rows.length > 0;
      });
    },

    async audit(event, accountId, context) {
      await within(async (tx) => {
        // Serialize with account deletion: late audit writes cannot restore identifying context.
        const [account] = accountId
          ? await tx<
              { id: string }[]
            >`SELECT id FROM app.accounts WHERE id = ${accountId} FOR KEY SHARE`
          : [];
        const keepContext = event !== 'account_deleted' && (!accountId || Boolean(account));
        const safe = normalizeAuditContext(keepContext ? context : undefined);

        const hints = Object.keys(safe.clientContext).length ? safe.clientContext : null;

        await tx`INSERT INTO app.auth_audit (event, account_id, client_ip, client_context)
          VALUES (${event}, ${account?.id ?? null}, ${safe.clientIp}::inet, ${hints}::jsonb)`;
      });
    },
  };
}
