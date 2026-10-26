import {
  matchRewardSchema,
  playerCatalogSchema,
  playerProgressSchema,
  rankingSchema,
} from '@truco/game-protocol';
import type { Context, Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AccountApplication } from '../../../accounts';
import type { PlayerApplication } from '../../application/player-application';
import type { PlayerProgress } from '../../application/ports/players';

const publicErrors = new Set([
  'INVALID_PAGE',
  'INVALID_MATCH_ID',
  'INVALID_SELECTION',
  'COSMETIC_LOCKED',
  'COSMETIC_UNAVAILABLE',
  'INVALID_NICKNAME',
]);

export function registerPlayerRoutes(
  app: Hono,
  accounts: AccountApplication,
  players: PlayerApplication,
  changed: (accountId: string, profile: PlayerProgress) => Promise<void>,
) {
  const failure = (context: Context, error: unknown) => {
    const code =
      error instanceof Error && publicErrors.has(error.message)
        ? error.message
        : 'SERVICE_UNAVAILABLE';

    return context.json({ code }, publicErrors.has(code) ? 400 : 503);
  };

  app.get('/api/catalog', async (context) => {
    if (Object.keys(context.req.query()).length)
      return context.json({ code: 'INVALID_MESSAGE' }, 400);

    try {
      return context.json(playerCatalogSchema.parse(await players.catalog()));
    } catch (error) {
      return failure(context, error);
    }
  });

  app.get('/api/ranking', async (context) => {
    if (Object.keys(context.req.query()).some((key) => key !== 'page'))
      return context.json({ code: 'INVALID_PAGE' }, 400);

    try {
      return context.json(rankingSchema.parse(await players.ranking(context.req.query('page'))));
    } catch (error) {
      return failure(context, error);
    }
  });

  app.get('/api/accounts/matches/:matchId/rewards', async (context) => {
    if (Object.keys(context.req.query()).length)
      return context.json({ code: 'INVALID_MESSAGE' }, 400);

    try {
      const account = await accounts.session(getCookie(context, 'truco_account'));
      if (!account) return context.json({ code: 'UNAUTHENTICATED' }, 401);

      return context.json(
        matchRewardSchema.parse(
          await players.matchReward(account.accountId, context.req.param('matchId')),
        ),
      );
    } catch (error) {
      return failure(context, error);
    }
  });

  app.get('/api/accounts/progression', async (context) => {
    if (Object.keys(context.req.query()).length)
      return context.json({ code: 'INVALID_MESSAGE' }, 400);

    try {
      const account = await accounts.session(getCookie(context, 'truco_account'));
      const profile = account ? await players.current(account.accountId) : null;

      return profile
        ? context.json(playerProgressSchema.parse(profile))
        : context.json({ code: 'UNAUTHENTICATED' }, 401);
    } catch (error) {
      return failure(context, error);
    }
  });

  for (const mode of ['cosmetics', 'profile'] as const) {
    app.post(`/api/accounts/${mode}`, async (context) => {
      if (context.req.header('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
        return context.json({ code: 'INVALID_MESSAGE' }, 400);

      let input: unknown;

      try {
        input = await context.req.json();
      } catch {
        return context.json({ code: 'INVALID_MESSAGE' }, 400);
      }

      try {
        const account = await accounts.session(getCookie(context, 'truco_account'));

        if (!account) return context.json({ code: 'UNAUTHENTICATED' }, 401);

        let profile: PlayerProgress | null;

        if (mode === 'cosmetics') profile = await players.select(account.accountId, input);
        else {
          if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input) ||
            Object.keys(input).length !== 1 ||
            !('nickname' in input)
          )
            return context.json({ code: 'INVALID_NICKNAME' }, 400);

          await players.rename(account.accountId, input.nickname);
          profile = await players.current(account.accountId);
        }

        if (!profile) return context.json({ code: 'UNAUTHENTICATED' }, 401);

        await changed(account.accountId, profile);

        return context.json(playerProgressSchema.parse(profile));
      } catch (error) {
        return failure(context, error);
      }
    });
  }
}
