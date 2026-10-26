import { isIP } from 'node:net';
import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';

export function parseTrustedProxies(value: string | undefined): readonly string[] {
  if (value === undefined || value === '') return [];

  const peers = value.split(',').map((entry) => entry.trim());

  if (peers.length > 32 || peers.some((peer) => !isIP(peer)))
    throw new Error('INVALID_TRUSTED_PROXIES');

  return [...new Set(peers)];
}

/** Walk from the actual trusted peer toward the client; never trust a client-supplied prefix. */
export function proxyPeer(
  peer: string,
  forwarded: string | undefined,
  trusted: readonly string[],
): string {
  if (!trusted.includes(peer) || !forwarded || forwarded.length > 2048) return peer;

  const hops = forwarded.split(',').map((entry) => entry.trim());

  if (hops.length > 16 || hops.some((hop) => !isIP(hop))) return peer;

  return hops.reverse().find((hop) => !trusted.includes(hop)) ?? peer;
}

export function requestPeer(context: Context, trusted: readonly string[] = []): string {
  let peer = 'local';

  try {
    peer = getConnInfo(context).remote.address ?? 'local';
  } catch {
    /* In-process requests have no socket peer and cannot establish proxy trust. */
  }

  return proxyPeer(peer, context.req.header('X-Forwarded-For'), trusted);
}
