import { expect, test } from 'bun:test';
import { getTableName, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  accounts,
  avatars,
  deckThemes,
  jobs,
  matchParticipants,
  matchResults,
  matchRewards,
  playerProgress,
  profiles,
  sessions,
  tableThemes,
} from '../../database/schema';
import { withDatabaseFixture } from './database-fixtures';

test('generated foreign keys preserve the schema targets and deletion policies in real PostgreSQL', () =>
  withDatabaseFixture(async (tx) => {
    for (const table of [
      accounts,
      avatars,
      deckThemes,
      tableThemes,
      profiles,
      sessions,
      playerProgress,
      matchResults,
      matchParticipants,
      matchRewards,
      jobs,
    ]) {
      const config = getTableConfig(table);
      const expected = config.foreignKeys
        .map((key) => ({
          name: key.getName(),
          target: getTableName(key.reference().foreignTable),
          action: key.onDelete ?? 'no action',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const actual = await tx.execute<{ name: string; target: string; action: string }>(sql`
      SELECT c.conname AS name, referenced.relname AS target,
        CASE c.confdeltype WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set null'
          WHEN 'a' THEN 'no action' ELSE c.confdeltype::text END AS action
      FROM pg_constraint c
      JOIN pg_class source ON source.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = source.relnamespace
      JOIN pg_class referenced ON referenced.oid = c.confrelid
      WHERE ns.nspname = 'app' AND source.relname = ${config.name} AND c.contype = 'f'
    `);

      expect(Array.from(actual).sort((a, b) => a.name.localeCompare(b.name))).toEqual(expected);
    }
  }));
