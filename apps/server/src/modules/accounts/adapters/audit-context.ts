import { isIP } from 'node:net';
import type { AuthAuditContext } from '../application/ports/audit';

/** Allowlist bounded client hints; malformed telemetry must not block authentication. */
export function normalizeAuditContext(value: unknown): AuthAuditContext {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const hints =
    source.clientContext && typeof source.clientContext === 'object'
      ? (source.clientContext as Record<string, unknown>)
      : {};
  const clientContext: { userAgent?: string; clientVersion?: string } = {};

  if (
    typeof hints.userAgent === 'string' &&
    hints.userAgent.length > 0 &&
    Buffer.byteLength(hints.userAgent, 'utf8') <= 512 &&
    !/\p{Cc}/u.test(hints.userAgent)
  )
    clientContext.userAgent = hints.userAgent;

  if (
    typeof hints.clientVersion === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}(?![\s\S])/.test(hints.clientVersion)
  )
    clientContext.clientVersion = hints.clientVersion;

  return {
    clientIp:
      typeof source.clientIp === 'string' && !source.clientIp.includes('%') && isIP(source.clientIp)
        ? source.clientIp
        : null,
    clientContext,
  };
}
