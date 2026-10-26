import type { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { requestPeer } from '../../../../shared/request-peer';
import type { AccountApplication } from '../../application/account-application';

export const ACCOUNT_COOKIE = 'truco_account';
const ACCOUNT_PATH = '/api/accounts';
const publicFailures = new Map([
  ['AUTH_RATE_LIMITED', 429],
  ['INVALID_ACCOUNT_INPUT', 400],
  ['INVALID_PASSWORD', 400],
  ['INVALID_CREDENTIALS', 401],
  ['REGISTRATION_FAILED', 400],
  ['PASSWORD_CAPACITY_EXCEEDED', 503],
] as const);

export function registerAccountRoutes(
  app: Hono,
  accounts: AccountApplication,
  origins: readonly string[],
  secure: boolean,
  trustedProxies: readonly string[] = [],
) {
  app.use(
    `${ACCOUNT_PATH}/*`,
    cors({
      origin: [...origins],
      credentials: true,
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Content-Type'],
    }),
  );
  app.use(
    `${ACCOUNT_PATH}/*`,
    bodyLimit({
      maxSize: 8192,
      onError: (context) => context.json({ code: 'MESSAGE_TOO_LARGE' }, 413),
    }),
  );
  app.use(`${ACCOUNT_PATH}/*`, async (context, next) => {
    context.header('Cache-Control', 'no-store');

    if (context.req.method !== 'GET' && !origins.includes(context.req.header('Origin') ?? ''))
      return context.json({ code: 'FORBIDDEN_ORIGIN' }, 403);

    await next();
  });

  for (const mode of ['register', 'login'] as const) {
    app.post(`${ACCOUNT_PATH}/${mode}`, async (context) => {
      if (context.req.header('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
        return context.json({ code: 'INVALID_ACCOUNT_INPUT' }, 400);

      let input: unknown;

      try {
        input = await context.req.json();
      } catch {
        return context.json({ code: 'INVALID_ACCOUNT_INPUT' }, 400);
      }

      const peer = requestPeer(context, trustedProxies);

      try {
        const result = await accounts.authenticate(
          mode,
          input,
          peer,
          getCookie(context, ACCOUNT_COOKIE),
        );
        setCookie(context, ACCOUNT_COOKIE, result.token, {
          httpOnly: true,
          sameSite: 'Strict',
          secure,
          path: '/api',
          maxAge: Math.floor(accounts.sessionTtlMs / 1000),
        });

        deleteCookie(context, ACCOUNT_COOKIE, {
          path: ACCOUNT_PATH,
          httpOnly: true,
          sameSite: 'Strict',
          secure,
        });

        return context.json({ nickname: result.profile.nickname }, mode === 'register' ? 201 : 200);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const failure = [...publicFailures].find(([code]) => code === message);

        return context.json({ code: failure?.[0] ?? 'AUTH_UNAVAILABLE' }, failure?.[1] ?? 503);
      }
    });
  }

  app.get(`${ACCOUNT_PATH}/session`, async (context) => {
    try {
      const profile = await accounts.session(getCookie(context, ACCOUNT_COOKIE));

      return profile
        ? context.json({ nickname: profile.nickname })
        : context.json({ code: 'UNAUTHENTICATED' }, 401);
    } catch {
      return context.json({ code: 'AUTH_UNAVAILABLE' }, 503);
    }
  });

  app.post(`${ACCOUNT_PATH}/logout`, async (context) => {
    try {
      await accounts.logout(getCookie(context, ACCOUNT_COOKIE));
      deleteCookie(context, ACCOUNT_COOKIE, {
        path: '/api',
        httpOnly: true,
        sameSite: 'Strict',
        secure,
      });

      deleteCookie(context, ACCOUNT_COOKIE, {
        path: ACCOUNT_PATH,
        httpOnly: true,
        sameSite: 'Strict',
        secure,
      });

      return context.body(null, 204);
    } catch {
      return context.json({ code: 'AUTH_UNAVAILABLE' }, 503);
    }
  });
}
