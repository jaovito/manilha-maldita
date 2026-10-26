import { readMatchReward } from './postgres-match-reward';
import type { SQL, TransactionSQL } from 'bun';
import type { PlayerProgress, PlayerRepository, Selection } from '../../application/ports/players';
import {
  appearanceFor,
  avatarDefinitions,
  deckDefinitions,
  tableDefinitions,
} from '../../domain/appearance';
import { levelForXp } from '../../domain/policy';

type ProgressRow = {
  nickname: string;
  xp: string;
  competitive_points: string;
  avatar_id: string | null;
  deck_theme_id: string | null;
  table_theme_id: string | null;
};

export function createPostgresPlayers(client: SQL, xpPerLevel: bigint): PlayerRepository {
  const within = <T>(run: (tx: TransactionSQL) => Promise<T>) =>
    client.begin(async (tx) => {
      await tx`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`;

      return run(tx);
    });
  const project = (row: ProgressRow): PlayerProgress => ({
    nickname: row.nickname,
    xp: String(row.xp),
    competitivePoints: String(row.competitive_points),
    level: levelForXp(BigInt(row.xp), xpPerLevel).toString(),
    appearance: appearanceFor(row.avatar_id, row.deck_theme_id, row.table_theme_id),
  });
  const current = (accountId: string) =>
    within(async (tx) => {
      const [row] = await tx<ProgressRow[]>`SELECT p.nickname,
      CASE WHEN v.active AND g.xp >= (v.required_level::bigint - 1) * ${xpPerLevel.toString()}::bigint THEN p.avatar_id ELSE NULL END AS avatar_id,
      CASE WHEN d.active AND g.xp >= (d.required_level::bigint - 1) * ${xpPerLevel.toString()}::bigint THEN p.deck_theme_id ELSE NULL END AS deck_theme_id,
      CASE WHEN t.active AND g.xp >= (t.required_level::bigint - 1) * ${xpPerLevel.toString()}::bigint THEN p.table_theme_id ELSE NULL END AS table_theme_id,
      g.xp, g.competitive_points
      FROM app.profiles p JOIN app.player_progress g ON g.account_id = p.account_id
      JOIN app.accounts a ON a.id = p.account_id
      LEFT JOIN app.avatars v ON v.id = p.avatar_id
      LEFT JOIN app.deck_themes d ON d.id = p.deck_theme_id
      LEFT JOIN app.table_themes t ON t.id = p.table_theme_id
      WHERE p.account_id = ${accountId} AND a.status = 'active'`;

      return row ? project(row) : null;
    });

  return {
    current,
    matchReward: (accountId, matchId) => readMatchReward(client, accountId, matchId),

    async select(accountId: string, selection: Selection) {
      await within(async (tx) => {
        const [progress] = await tx<{ xp: string }[]>`SELECT g.xp FROM app.player_progress g
          JOIN app.accounts a ON a.id = g.account_id WHERE g.account_id = ${accountId} AND a.status = 'active' FOR UPDATE OF g`;

        if (!progress) throw new Error('ACCOUNT_UNAVAILABLE');

        const level = levelForXp(BigInt(progress.xp), xpPerLevel);
        const [avatar] =
          selection.avatarId === null
            ? [null]
            : await tx<
                { id: string; required_level: number }[]
              >`SELECT id, required_level FROM app.avatars WHERE id = ${selection.avatarId} AND active`;
        const [deck] =
          selection.deckThemeId === null
            ? [null]
            : await tx<
                { id: string; required_level: number }[]
              >`SELECT id, required_level FROM app.deck_themes WHERE id = ${selection.deckThemeId} AND active`;
        const [table] =
          selection.tableThemeId === null
            ? [null]
            : await tx<
                { id: string; required_level: number }[]
              >`SELECT id, required_level FROM app.table_themes WHERE id = ${selection.tableThemeId} AND active`;
        const requested = [selection.avatarId, selection.deckThemeId, selection.tableThemeId];
        const found = [avatar, deck, table];

        if (
          found.some(
            (entry, index) =>
              requested[index] !== null && (!entry || BigInt(entry.required_level) > level),
          )
        )
          throw new Error('COSMETIC_LOCKED');
        if (
          (avatar && !avatarDefinitions.some((entry) => entry.id === avatar.id)) ||
          (deck && !deckDefinitions.some((entry) => entry.id === deck.id)) ||
          (table && !tableDefinitions.some((entry) => entry.id === table.id))
        )
          throw new Error('COSMETIC_UNAVAILABLE');

        await tx`UPDATE app.profiles SET avatar_id = ${selection.avatarId}, deck_theme_id = ${selection.deckThemeId}, table_theme_id = ${selection.tableThemeId} WHERE account_id = ${accountId}`;
      });
      const value = await current(accountId);

      if (!value) throw new Error('ACCOUNT_UNAVAILABLE');

      return value;
    },

    catalog() {
      return within(async (tx) => {
        const avatars = await tx<
          { id: string; required_level: number }[]
        >`SELECT id, required_level FROM app.avatars WHERE active ORDER BY sort_order, id`;
        const decks = await tx<
          { id: string; required_level: number }[]
        >`SELECT id, required_level FROM app.deck_themes WHERE active ORDER BY sort_order, id`;
        const tables = await tx<
          { id: string; required_level: number }[]
        >`SELECT id, required_level FROM app.table_themes WHERE active ORDER BY sort_order, id`;

        return {
          xpPerLevel: xpPerLevel.toString(),
          avatars: avatars.flatMap((row) => {
            const item = avatarDefinitions.find((entry) => entry.id === row.id);
            return item ? [{ ...item, requiredLevel: row.required_level }] : [];
          }),
          decks: decks.flatMap((row) => {
            const item = deckDefinitions.find((entry) => entry.id === row.id);
            return item ? [{ ...item, requiredLevel: row.required_level }] : [];
          }),
          tables: tables.flatMap((row) => {
            const item = tableDefinitions.find((entry) => entry.id === row.id);
            return item ? [{ ...item, requiredLevel: row.required_level }] : [];
          }),
        };
      });
    },

    ranking(page) {
      return within(async (tx) => {
        const rows = await tx<(ProgressRow & { account_id: string })[]>`SELECT p.nickname,
          CASE WHEN v.active AND g.xp >= (v.required_level::bigint - 1) * ${xpPerLevel.toString()}::bigint THEN p.avatar_id ELSE NULL END AS avatar_id,
          p.deck_theme_id, p.table_theme_id, g.xp, g.competitive_points
          FROM app.player_progress g JOIN app.accounts a ON a.id = g.account_id JOIN app.profiles p ON p.account_id = a.id LEFT JOIN app.avatars v ON v.id = p.avatar_id
          WHERE a.status = 'active' AND g.competitive_points > 0 ORDER BY g.competitive_points DESC, g.account_id ASC LIMIT 51 OFFSET ${(page - 1) * 50}`;

        return {
          entries: rows.slice(0, 50).map((row, index) => ({
            rank: (page - 1) * 50 + index + 1,
            nickname: row.nickname,
            competitivePoints: String(row.competitive_points),
            avatar: appearanceFor(row.avatar_id, row.deck_theme_id, row.table_theme_id).avatar,
          })),
          nextPage: rows.length > 50 && page < 1000 ? page + 1 : null,
        };
      });
    },

    async rename(accountId, nickname) {
      await within(async (tx) => {
        await tx`UPDATE app.profiles SET nickname = ${nickname} WHERE account_id = ${accountId}
          AND EXISTS (SELECT 1 FROM app.accounts WHERE id = ${accountId} AND status = 'active')`;
      });
    },
  };
}
