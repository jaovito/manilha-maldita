import type { Hono } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { requestPeer } from '../../../../shared/request-peer';
import type { AccountMaintenance } from '../../application/account-maintenance';

export function registerAccountMaintenanceRoutes(
  app: Hono,
  maintenance: AccountMaintenance,
  secure: boolean,
  trustedProxies: readonly string[] = [],
) {
  const failures = new Map([
    ['INVALID_ACCOUNT_INPUT', 400],
    ['INVALID_PASSWORD', 400],
    ['INVALID_CREDENTIALS', 401],
    ['UNAUTHENTICATED', 401],
    ['AUTH_RATE_LIMITED', 429],
    ['PASSWORD_CAPACITY_EXCEEDED', 503],
  ] as const);

  for (const mode of ['recovery-code', 'recover', 'password', 'delete'] as const) {
    app.post(`/api/accounts/${mode}`, async (context) => {
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
        const result = await maintenance(mode, input, getCookie(context, 'truco_account'), peer);

        if (mode !== 'recovery-code') {
          for (const path of ['/api', '/api/accounts'])
            deleteCookie(context, 'truco_account', {
              path,
              httpOnly: true,
              sameSite: 'Strict',
              secure,
            });
        }

        return context.json(result);
      } catch (error) {
        const failure = [...failures].find(
          ([code]) => error instanceof Error && code === error.message,
        );

        return context.json({ code: failure?.[0] ?? 'AUTH_UNAVAILABLE' }, failure?.[1] ?? 503);
      }
    });
  }
}
