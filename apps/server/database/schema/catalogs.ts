import { sql } from 'drizzle-orm';
import { boolean, check, integer, text } from 'drizzle-orm/pg-core';
import { app } from './namespace';

// Assets are curated, same-origin paths. No uploads, arbitrary URLs or executable theme code.
export const avatars = app.table(
  'avatars',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url').notNull(),
    spriteIndex: integer('sprite_index').notNull().default(0),
    requiredLevel: integer('required_level').notNull().default(1),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    check('avatars_id', sql`${table.id} ~ '^[a-z][a-z0-9-]{0,63}$'`),
    check('avatars_name', sql`char_length(btrim(${table.name})) BETWEEN 1 AND 64`),
    check('avatars_sprite', sql`${table.spriteIndex} BETWEEN 0 AND 3`),
    check('avatars_level', sql`${table.requiredLevel} >= 1`),
    check('avatars_order', sql`${table.sortOrder} >= 0`),
    check(
      'avatars_asset',
      sql`${table.avatarUrl} ~ '^/art/([A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+[.](png|webp|svg)$'`,
    ),
  ],
);

export const deckThemes = app.table(
  'deck_themes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    assetKey: text('asset_key').notNull(),
    requiredLevel: integer('required_level').notNull().default(1),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    check('deck_themes_id', sql`${table.id} ~ '^[a-z][a-z0-9-]{0,63}$'`),
    check('deck_themes_name', sql`char_length(btrim(${table.name})) BETWEEN 1 AND 64`),
    check('deck_themes_asset', sql`${table.assetKey} ~ '^[a-z][a-z0-9-]{0,63}$'`),
    check('deck_themes_level', sql`${table.requiredLevel} >= 1`),
    check('deck_themes_order', sql`${table.sortOrder} >= 0`),
  ],
);

export const tableThemes = app.table(
  'table_themes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    assetKey: text('asset_key').notNull(),
    requiredLevel: integer('required_level').notNull().default(1),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    check('table_themes_id', sql`${table.id} ~ '^[a-z][a-z0-9-]{0,63}$'`),
    check('table_themes_name', sql`char_length(btrim(${table.name})) BETWEEN 1 AND 64`),
    check('table_themes_asset', sql`${table.assetKey} ~ '^[a-z][a-z0-9-]{0,63}$'`),
    check('table_themes_level', sql`${table.requiredLevel} >= 1`),
    check('table_themes_order', sql`${table.sortOrder} >= 0`),
  ],
);
