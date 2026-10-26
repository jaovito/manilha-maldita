import { expect, test } from 'bun:test';
import { createPersistentBackend } from '../../src/bootstrap/persistent-backend';

import {
  ensurePersistentCatalogs,
  persistentEnvironment as environment,
} from './persistent-fixture';

test('persistent main is opt-in, rejects unavailable storage and releases resources after bind failure', async () => {
  await ensurePersistentCatalogs();
  const { main } = await import('../../src/bootstrap/main');
  expect(await createPersistentBackend({})).toBeNull();
  await expect(
    createPersistentBackend({
      ...environment(),
      DATABASE_URL: 'postgres://fixture:fixture@127.0.0.1:1/truco_test',
    }),
  ).rejects.toThrow('PERSISTENT_BACKEND_START_FAILED');
  await expect(main({ ...environment(), PORT: '0', HOST: '192.0.2.1' })).rejects.toThrow();
});
