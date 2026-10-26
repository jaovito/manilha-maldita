import { z } from 'zod';

const amount = z.string().regex(/^(0|[1-9][0-9]{0,18})$/);
const cosmeticId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const name = z.string().min(1).max(64);
export const deckThemeSchema = z.enum(['classic', 'ember', 'arcane']);
export const tableThemeSchema = z.enum(['classic', 'burgundy', 'midnight']);
export const avatarSchema = z.strictObject({
  id: cosmeticId,
  avatarUrl: z.literal('/art/avatars-pixel.png'),
  spriteIndex: z.number().int().min(0).max(3),
});
export const playerProgressSchema = z.strictObject({
  nickname: z.string().min(1).max(24),
  xp: amount,
  competitivePoints: amount,
  level: amount.refine((value) => value !== '0'),
  appearance: z.strictObject({
    avatar: avatarSchema,
    deck: z.strictObject({ id: deckThemeSchema, assetKey: deckThemeSchema }),
    table: z.strictObject({ id: tableThemeSchema, assetKey: tableThemeSchema }),
  }),
});
const requiredLevel = z.number().int().min(1).max(2_147_483_647);
export const playerCatalogSchema = z.strictObject({
  xpPerLevel: amount.refine((value) => BigInt(value) > 0n && BigInt(value) <= 1_000_000n),
  avatars: z.array(avatarSchema.extend({ name, requiredLevel })).max(256),
  decks: z
    .array(
      z.strictObject({
        id: deckThemeSchema,
        assetKey: deckThemeSchema,
        name,
        requiredLevel,
        style: z.strictObject({
          backUrl: z.enum([
            '/art/card-back.png',
            '/art/cosmetics/deck-ember.png',
            '/art/cosmetics/deck-arcane.png',
          ]),
          rankStyle: z.enum(['pixel', 'engraved', 'ornate']),
          suitStyle: z.enum(['classic', 'angular', 'runic']),
          palette: z.enum(['parchment', 'ember', 'arcane']),
        }),
      }),
    )
    .max(256),
  tables: z
    .array(
      z.strictObject({
        id: tableThemeSchema,
        assetKey: tableThemeSchema,
        name,
        requiredLevel,
        style: z.strictObject({
          felt: z.enum(['green', 'burgundy', 'midnight']),
          frame: z.enum(['wood', 'gold']),
        }),
      }),
    )
    .max(256),
});
export const rankingSchema = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        rank: z.number().int().min(1).max(50_000),
        nickname: z.string().min(1).max(24),
        competitivePoints: amount,
        avatar: avatarSchema,
      }),
    )
    .max(50),
  nextPage: z.number().int().min(1).max(1000).nullable(),
});
export const accountNicknameSchema = z.strictObject({ nickname: z.string().min(1).max(24) });
export const recoveryResponseSchema = z.strictObject({
  recoveryCode: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PlayerProgress = z.infer<typeof playerProgressSchema>;
export type PlayerCatalog = z.infer<typeof playerCatalogSchema>;
export type RankingPage = z.infer<typeof rankingSchema>;
export type DeckTheme = z.infer<typeof deckThemeSchema>;
export type TableTheme = z.infer<typeof tableThemeSchema>;

export const matchRewardSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('pending') }),
  z.strictObject({ status: z.literal('none') }),
  z.strictObject({ status: z.literal('granted'), xp: amount, competitivePoints: amount }),
]);
export type MatchReward = z.infer<typeof matchRewardSchema>;
