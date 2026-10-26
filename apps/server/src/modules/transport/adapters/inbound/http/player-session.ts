import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, type TransportDependencies } from '../../../contracts';
import type { PlayerSession } from '../../../player-identity';

const requests = new WeakMap<Context, PlayerSession | undefined>();

/** Resolve once per HTTP/handshake. Room commands only consult the bounded in-memory lease. */
export async function resolvePlayerSession(
  context: Context,
  options: TransportDependencies,
): Promise<PlayerSession | undefined> {
  if (requests.has(context)) return requests.get(context);

  const guestToken = getCookie(context, SESSION_COOKIE);
  const session = options.playerAuthenticator
    ? await options.playerAuthenticator.resolve(guestToken, getCookie(context, 'truco_account'))
    : options.sessions.find(guestToken);
  requests.set(context, session);

  return session;
}

export function resolvedPlayerSession(context: Context): PlayerSession | undefined {
  return requests.get(context);
}
