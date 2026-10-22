import { expect, test } from 'bun:test';
import { createAccountSecurity } from './account-security';

const pepper = 'ab'.repeat(32);

test('explicit account composition applies environment costs, pepper and a shared capacity limit', async () => {
  const service = createAccountSecurity({
    PASSWORD_PEPPER: pepper,
    PASSWORD_MAX_CONCURRENCY: '1',
    ARGON2_ITERATIONS: '3',
  });
  const password = 'fixture password for composition';
  const pending = service.hash(password);

  await expect(service.hash(password)).rejects.toThrow('PASSWORD_CAPACITY_EXCEEDED');
  const hash = await pending;
  expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=3,p=1\$/);
  expect(await service.verify(password, hash)).toBe(true);
  expect(
    await createAccountSecurity({ PASSWORD_PEPPER: 'cd'.repeat(32) }).verify(password, hash),
  ).toBe(false);
  expect(() => createAccountSecurity({})).toThrow(/^INVALID_ACCOUNT_SECURITY_ENVIRONMENT$/);
});
