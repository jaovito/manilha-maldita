import { guestRequestSchema } from '@truco/game-protocol';
import type { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import {
  SESSION_COOKIE as COOKIE,
  MAX_MESSAGE_BYTES as MAX_BYTES,
  type TransportDependencies,
} from '../../../contracts';
import { resolvePlayerSession } from './player-session';

export function registerGuestEntry(app: Hono, options: TransportDependencies) {
  const { sessions } = options;

  app.post('/api/guest', async (context) => {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);

    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return context.json({ code: 'INVALID_MESSAGE' }, 400);
    }

    const parsed = guestRequestSchema.safeParse(input);
    if (!parsed.success) return context.json({ code: 'INVALID_MESSAGE' }, 400);

    if (getCookie(context, 'truco_account') !== undefined && options.playerAuthenticator) {
      try {
        const account = await resolvePlayerSession(context, options);

        return account
          ? context.json({ nickname: account.nickname })
          : context.json({ code: 'UNAUTHENTICATED' }, 401);
      } catch {
        return context.json({ code: 'SERVICE_UNAVAILABLE' }, 503);
      }
    }

    const tokenCookie = getCookie(context, COOKIE);
    const existing = tokenCookie ? sessions.rename(tokenCookie, parsed.data.nickname) : undefined;
    if (existing) return context.json({ nickname: existing.nickname });

    const { token, session } = sessions.issue(parsed.data.nickname);
    setCookie(context, COOKIE, token, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: options.secureCookies ?? false,
      path: '/api',
      maxAge: 86400,
    });

    return context.json({ nickname: session.nickname }, 201);
  });
}

export function registerGuestProfile(app: Hono, options: TransportDependencies) {
  app.get('/api/guest', async (context) => {
    const session = await resolvePlayerSession(context, options);
    return context.json({ nickname: session?.nickname });
  });
}
