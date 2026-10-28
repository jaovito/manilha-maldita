import { expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { authAudit } from '../../database/schema';
import { rejectsConstraint, withDatabaseFixture } from './database-fixtures';
import { withProgressionFixture } from './progression-fixture';

test('audit JSONB constraints reject unexpected fields, types, controls and unbounded values', () =>
  withDatabaseFixture(async (tx) => {
    for (const clientContext of [
      [],
      'payload',
      { cookie: 'secret' },
      { userAgent: 1 },
      { userAgent: '' },
      { userAgent: 'x'.repeat(513) },
      { userAgent: 'a\nb' },
      { clientVersion: '1\n' },
      { clientVersion: 1 },
    ])
      await rejectsConstraint(tx, 'auth_audit_context_shape', (sp) =>
        sp.insert(authAudit).values({ event: 'login_failure', clientContext }),
      );
    await expect(
      tx.transaction((sp) =>
        sp.execute(
          sql`INSERT INTO app.auth_audit(event, client_ip) VALUES ('login_failure', '192.0.2.1/24')`,
        ),
      ),
    ).resolves.toBeDefined();
  }));

test('account deletion clears attached audit context and late audit writes cannot restore it', () =>
  withProgressionFixture(async ({ client, accounts, maintenance }) => {
    const accountId = accounts[0]!;
    const context = {
      clientIp: '2001:db8::1',
      clientContext: {
        userAgent: "audit-fixture '; DROP TABLE app.accounts; --",
        clientVersion: '1.0',
      },
    };
    await maintenance.audit('login_success', accountId, context);
    const [before] =
      await client`SELECT id, host(client_ip) AS ip, client_context FROM app.auth_audit WHERE account_id = ${accountId}`;
    expect(before?.ip).toBe(context.clientIp);
    expect(before?.client_context).toEqual(context.clientContext);

    await Promise.all([
      maintenance.audit('password_changed', accountId, context),
      client`DELETE FROM app.accounts WHERE id = ${accountId}`,
    ]);
    const [after] =
      await client`SELECT account_id, client_ip, client_context FROM app.auth_audit WHERE id = ${before?.id}`;
    expect(after).toEqual({ account_id: null, client_ip: null, client_context: null });
    await maintenance.audit('login_success', accountId, context);
    await maintenance.audit('account_deleted', undefined, context);
    expect(
      await client`SELECT id FROM app.auth_audit WHERE client_ip = ${context.clientIp}::inet`,
    ).toHaveLength(0);
    expect(await client`SELECT id FROM app.accounts WHERE id = ${accounts[1]}`).toHaveLength(1);
  }));
