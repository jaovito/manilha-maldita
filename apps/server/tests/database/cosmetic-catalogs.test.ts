import { expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { avatars, deckThemes, tableThemes } from '../../database/schema';
import { rejectsConstraint, withDatabaseFixture } from './database-fixtures';

test('three independent cosmetic catalogs expose only curated presentation metadata', () => {
  for (const table of [avatars, deckThemes, tableThemes]) {
    const config = getTableConfig(table);
    expect(config.columns).toHaveLength(6);
    expect(config.checks).toHaveLength(5);
    expect(config.columns.map((column) => column.name)).not.toContain('power');
  }
});

test('avatar URLs reject remote hosts, traversal, scripts and query fragments', () =>
  withDatabaseFixture(async (tx) => {
    for (const avatarUrl of [
      'https://remote.example/avatar.png',
      '//remote/avatar.png',
      '/art/../secret.png',
      '/art/avatar.svg?token=secret',
      '/art/avatar.png#fragment',
      'javascript:alert(1)',
    ]) {
      await rejectsConstraint(tx, 'avatars_asset', (sp) =>
        sp.insert(avatars).values({ id: 'invalid', name: 'Invalid', avatarUrl }),
      );
    }

    const [avatar] = await tx
      .insert(avatars)
      .values({ id: 'rogue', name: 'Trapaceiro', avatarUrl: '/art/avatars/rogue.png' })
      .returning();
    expect(avatar).toMatchObject({ requiredLevel: 1, active: true, sortOrder: 0 });
    await rejectsConstraint(tx, 'avatars_level', (sp) =>
      sp
        .insert(avatars)
        .values({ id: 'bad-level', name: 'Bad', avatarUrl: '/art/a.png', requiredLevel: 0 }),
    );
    await rejectsConstraint(tx, 'avatars_order', (sp) =>
      sp
        .insert(avatars)
        .values({ id: 'bad-order', name: 'Bad', avatarUrl: '/art/a.png', sortOrder: -1 }),
    );
    await rejectsConstraint(tx, 'avatars_name', (sp) =>
      sp.insert(avatars).values({ id: 'bad-name', name: ' ', avatarUrl: '/art/a.png' }),
    );
  }));

test('deck and table styles are allowlisted keys with valid unlock requirements', () =>
  withDatabaseFixture(async (tx) => {
    for (const table of [deckThemes, tableThemes]) {
      const name = getTableConfig(table).name;
      await rejectsConstraint(tx, `${name}_asset`, (sp) =>
        sp.insert(table).values({
          id: 'invalid-asset',
          name: 'Bad',
          assetKey: 'https://arbitrary.example/code.js',
        }),
      );
      await rejectsConstraint(tx, `${name}_level`, (sp) =>
        sp
          .insert(table)
          .values({ id: 'invalid-level', name: 'Bad', assetKey: 'valid', requiredLevel: -1 }),
      );
      await rejectsConstraint(tx, `${name}_order`, (sp) =>
        sp
          .insert(table)
          .values({ id: 'invalid-order', name: 'Bad', assetKey: 'valid', sortOrder: -1 }),
      );
      await rejectsConstraint(tx, `${name}_id`, (sp) =>
        sp.insert(table).values({ id: '../invalid', name: 'Bad', assetKey: 'valid' }),
      );
      await rejectsConstraint(tx, `${name}_name`, (sp) =>
        sp.insert(table).values({ id: 'invalid-name', name: '', assetKey: 'valid' }),
      );
      const [item] = await tx
        .insert(table)
        .values({ id: 'classic', name: 'Clássico', assetKey: 'classic', requiredLevel: 6 })
        .returning();
      expect(item).toMatchObject({ requiredLevel: 6, active: true });
    }
  }));
