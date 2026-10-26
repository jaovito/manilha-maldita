import type {
  avatarDefinitions,
  deckDefinitions,
  PlayerAppearance,
  tableDefinitions,
} from '../../domain/appearance';

export type MatchReward =
  | Readonly<{ status: 'pending' | 'none' }>
  | Readonly<{ status: 'granted'; xp: string; competitivePoints: string }>;

export type PlayerProgress = Readonly<{
  nickname: string;
  xp: string;
  competitivePoints: string;
  level: string;
  appearance: PlayerAppearance;
}>;

export type Selection = Readonly<{
  avatarId: string | null;
  deckThemeId: string | null;
  tableThemeId: string | null;
}>;

type CatalogItem<T> = Omit<T, 'requiredLevel'> & Readonly<{ requiredLevel: number }>;
export type PlayerCatalog = Readonly<{
  xpPerLevel: string;
  avatars: readonly CatalogItem<(typeof avatarDefinitions)[number]>[];
  decks: readonly CatalogItem<(typeof deckDefinitions)[number]>[];
  tables: readonly CatalogItem<(typeof tableDefinitions)[number]>[];
}>;
export type RankingPage = Readonly<{
  entries: readonly Readonly<{
    rank: number;
    nickname: string;
    competitivePoints: string;
    avatar: PlayerAppearance['avatar'];
  }>[];
  nextPage: number | null;
}>;

export type PlayerRepository = Readonly<{
  matchReward(accountId: string, matchId: string): Promise<MatchReward>;
  current(accountId: string): Promise<PlayerProgress | null>;
  select(accountId: string, selection: Selection): Promise<PlayerProgress>;
  catalog(): Promise<PlayerCatalog>;
  ranking(page: number): Promise<RankingPage>;
  rename(accountId: string, nickname: string): Promise<void>;
}>;
