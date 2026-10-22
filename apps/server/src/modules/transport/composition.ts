import { Hono } from 'hono';
import { websocket } from 'hono/bun';
import { registerGuestEntry, registerGuestProfile } from './adapters/inbound/http/guest-controller';
import { registerRoomRoutes } from './adapters/inbound/http/room-controller';
import { installRequestSecurity, requireSession } from './adapters/inbound/http/security';
import { registerRoomSocket } from './adapters/inbound/websocket/room-handler';
import type { TransportDependencies } from './contracts';

export function createTransport(options: TransportDependencies) {
  const app = new Hono();
  const sockets = new Set<{ close(): void }>();

  app.get('/health', (context) => context.json({ status: 'ok' }));
  installRequestSecurity(app, options);
  app.get('/api/features', (context) => context.json({ solo: options.soloEnabled === true }));
  options.registerAccounts?.(app);
  app.all('/api/accounts/*', (context) => context.json({ code: 'NOT_FOUND' }, 404));
  registerGuestEntry(app, options);
  requireSession(app, options);
  registerGuestProfile(app, options);
  registerRoomRoutes(app, options);
  registerRoomSocket(app, options, sockets);

  return {
    app,
    websocket,
    close() {
      for (const socket of sockets) socket.close();
      sockets.clear();
      options.sessions.clear();
      options.limiter.clear();
    },
  };
}
