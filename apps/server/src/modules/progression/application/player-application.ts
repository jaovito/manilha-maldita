import type { PlayerRepository, Selection } from './ports/players';

export function createPlayerApplication(repository: PlayerRepository) {
  return {
    async matchReward(accountId: string, matchId: string) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(matchId) || /[^A-Za-z0-9_-]/.test(matchId))
        throw new Error('INVALID_MATCH_ID');

      return repository.matchReward(accountId, matchId);
    },
    current: (accountId: string) => repository.current(accountId),
    catalog: () => repository.catalog(),
    async ranking(page: unknown = '1') {
      if (typeof page !== 'string' || !page || /[^0-9]/.test(page)) throw new Error('INVALID_PAGE');

      const value = Number(page);

      if (!Number.isInteger(value) || value < 1 || value > 1000) throw new Error('INVALID_PAGE');

      return repository.ranking(value);
    },
    async select(accountId: string, input: unknown) {
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('INVALID_SELECTION');

      const value = input as Record<string, unknown>;
      const fields = ['avatarId', 'deckThemeId', 'tableThemeId'] as const;

      if (
        Object.keys(value).length !== fields.length ||
        fields.some(
          (field) =>
            value[field] !== null &&
            (typeof value[field] !== 'string' ||
              !/^[a-z][a-z0-9-]{0,63}$/.test(value[field]) ||
              /[^a-z0-9-]/.test(value[field])),
        )
      )
        throw new Error('INVALID_SELECTION');

      return repository.select(accountId, value as Selection);
    },
    async rename(accountId: string, nickname: unknown) {
      if (typeof nickname !== 'string') throw new Error('INVALID_NICKNAME');

      const value = nickname.trim();

      if (!value || value.length > 24 || /[^\p{L}\p{N} _.-]/u.test(value))
        throw new Error('INVALID_NICKNAME');

      await repository.rename(accountId, value);
    },
  };
}

export type PlayerApplication = ReturnType<typeof createPlayerApplication>;
