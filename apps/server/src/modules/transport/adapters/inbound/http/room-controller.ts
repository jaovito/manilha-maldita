import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  normalizeConfig,
  roomCodeSchema,
} from '@truco/game-protocol';
import type { Hono } from 'hono';
import { MAX_MESSAGE_BYTES as MAX_BYTES, type TransportDependencies } from '../../../contracts';
import { resolvePlayerSession } from './player-session';

export function registerRoomRoutes(app: Hono, options: TransportDependencies) {
  app.post('/api/rooms', async (context) => {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);

    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return context.json({ code: 'INVALID_MESSAGE' }, 400);
    }

    const parsed = createRoomRequestSchema.safeParse(input);
    if (!parsed.success) return context.json({ code: 'INVALID_MESSAGE' }, 400);

    const session = await resolvePlayerSession(context, options);
    if (!session) return context.json({ code: 'UNAUTHENTICATED' }, 401);
    return context.json(
      await options.rooms.create(
        session.id,
        session.nickname,
        normalizeConfig(parsed.data.config),
        parsed.data.solo,
        session.identity,
      ),
      201,
    );
  });

  app.post('/api/rooms/:code/join', async (context) => {
    const code = roomCodeSchema.safeParse(context.req.param('code'));
    let input: unknown;
    const text = await context.req.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return context.json({ code: 'MESSAGE_TOO_LARGE' }, 413);
    try {
      input = JSON.parse(text);
    } catch {
      return context.json({ code: 'INVALID_MESSAGE' }, 400);
    }
    if (!code.success || !joinRoomRequestSchema.safeParse(input).success)
      return context.json({ code: 'INVALID_MESSAGE' }, 400);

    const session = await resolvePlayerSession(context, options);
    if (!session) return context.json({ code: 'UNAUTHENTICATED' }, 401);
    await options.rooms.join(code.data, session.id, session.nickname, session.identity);
    return context.json({ code: code.data });
  });
}
