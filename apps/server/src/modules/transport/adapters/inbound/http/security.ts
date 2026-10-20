import type { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getConnInfo } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import {
  SESSION_COOKIE as COOKIE,
  MAX_MESSAGE_BYTES as MAX_BYTES,
  type TransportDependencies,
} from '../../../contracts';
import { errorCode } from '../errors';

export function installRequestSecurity(app: Hono, options: TransportDependencies) {
  const { limiter } = options;

  app.onError((error, context) => context.json({ code: errorCode(error) }, 400));

  const apiCors = cors({
    origin: [...options.allowedOrigins],
    credentials: true,
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type'],
  });
  app.use('/api/*', (context, next) => {
    // CORS applies to HTTP only; the WS handshake retains its explicit origin check.
    if (context.req.path.endsWith('/ws')) return next();

    return apiCors(context, next);
  });

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BYTES,
      onError: (context) => context.json({ code: 'MESSAGE_TOO_LARGE' }, 413),
    }),
  );

  app.use('/api/*', async (context, next) => {
    if (context.req.method !== 'GET' || context.req.path.endsWith('/ws')) {
      if (!options.allowedOrigins.includes(context.req.header('Origin') ?? ''))
        return context.json({ code: 'FORBIDDEN_ORIGIN' }, 403);
    }
    // Proxy headers are deliberately ignored; only the actual peer identifies an IP.
    let ip = 'local';
    try {
      ip = getConnInfo(context).remote.address ?? 'local';
    } catch {
      /* app.request has no network peer. */
    }
    if (!limiter.allow(`ip:${ip}`, 120)) return context.json({ code: 'RATE_LIMITED' }, 429);
    const length = Number(context.req.header('Content-Length') ?? 0);
    if (length > MAX_BYTES) return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);

    await next();
  });
}

export function requireSession(app: Hono, options: TransportDependencies) {
  const { sessions, limiter } = options;

  app.use('/api/*', async (context, next) => {
    const session = sessions.find(getCookie(context, COOKIE));
    if (!session) return context.json({ code: 'UNAUTHENTICATED' }, 401);
    if (!limiter.allow(`session:${session.id}`, 180))
      return context.json({ code: 'RATE_LIMITED' }, 429);

    await next();
  });
}
