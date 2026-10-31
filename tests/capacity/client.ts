import {
  type Action,
  type CommandReply,
  defaultRoomConfig,
  type RoomView,
  serverMessageSchema,
} from '../../packages/game-protocol/src';

export const origin = 'http://capacity.test';
export const password = 'Capacity fixture lanterns 847!';

export async function until(predicate: () => boolean | Promise<boolean>, timeout = 15_000) {
  const deadline = performance.now() + timeout;

  while (!(await predicate())) {
    if (performance.now() > deadline) throw new Error('CAPACITY_WAIT_TIMED_OUT');

    await Bun.sleep(10);
  }
}

export async function post(address: string, path: string, body: unknown, cookie = '') {
  return fetch(new URL(path, address), {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

class Actor {
  view: RoomView | undefined;
  readonly socket: WebSocket;
  private serial = 0;
  failed = false;
  private replies = new Map<string, (reply: CommandReply) => void>();

  constructor(address: string, code: string, cookie: string) {
    const url = new URL(`/api/rooms/${code}/ws`, address);
    url.protocol = 'ws:';
    this.socket = new WebSocket(url, { headers: { Cookie: cookie, Origin: origin } });
    this.socket.addEventListener('error', () => {
      this.failed = true;
    });
    this.socket.addEventListener('message', (event) => {
      try {
        const message = serverMessageSchema.parse(JSON.parse(String(event.data)));
        if (message.type === 'SNAPSHOT') this.view = message.room;
        else if (message.commandId) this.replies.get(message.commandId)?.(message);
      } catch {
        // Never print an invalid frame: it may contain synthetic private cards.
        this.failed = true;
      }
    });
  }

  async act(action: Action) {
    if (this.failed) throw new Error('CAPACITY_FRAME_INVALID');

    const room = this.view;
    if (!room) throw new Error('CAPACITY_SNAPSHOT_MISSING');

    const lobby = ['READY', 'START_MATCH', 'REMATCH', 'LEAVE'].includes(action.type);
    const commandId = `capacity_${++this.serial}`;
    return new Promise<CommandReply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.replies.delete(commandId);
        reject(new Error('CAPACITY_REPLY_TIMED_OUT'));
      }, 15_000);
      this.replies.set(commandId, (reply) => {
        clearTimeout(timer);
        this.replies.delete(commandId);
        resolve(reply);
      });

      try {
        this.socket.send(
          JSON.stringify({
            protocol: 1,
            commandId,
            matchId: room.matchId,
            decisionId: lobby ? null : room.decisionId,
            expectedRevision: lobby ? room.roomRevision : (room.match?.revision ?? null),
            action,
          }),
        );
      } catch {
        clearTimeout(timer);
        this.replies.delete(commandId);
        reject(new Error('CAPACITY_SOCKET_UNAVAILABLE'));
      }
    });
  }
}

export async function room(address: string, count: 2 | 4, latencies: number[], cookies?: string[]) {
  const actors: Actor[] = [];

  try {
    const identities =
      cookies ??
      (await Promise.all(
        Array.from({ length: count }, async () => {
          const response = await post(address, '/api/guest', { nickname: 'Capacity Guest' });
          if (!response.ok) throw new Error('CAPACITY_GUEST_REJECTED');

          const cookie = response.headers.get('Set-Cookie')?.split(';')[0];
          if (!cookie) throw new Error('CAPACITY_COOKIE_MISSING');

          return cookie;
        }),
      ));
    const created = await post(
      address,
      '/api/rooms',
      {
        config: {
          ...defaultRoomConfig,
          preset: 'competitive',
          format: count === 2 ? '1v1' : '2v2',
        },
      },
      identities[0],
    );
    const body: unknown = await created.json();
    if (
      !created.ok ||
      !body ||
      typeof body !== 'object' ||
      !('code' in body) ||
      typeof body.code !== 'string'
    )
      throw new Error('CAPACITY_ROOM_REJECTED');

    for (const cookie of identities.slice(1)) {
      if (!(await post(address, `/api/rooms/${body.code}/join`, {}, cookie)).ok)
        throw new Error('CAPACITY_JOIN_REJECTED');
    }
    for (const cookie of identities) actors.push(new Actor(address, body.code, cookie));
    await until(() => actors.every((actor) => actor.view?.seats.filter(Boolean).length === count));

    async function act(seat: number, action: Action, rejected = false) {
      const actor = actors[seat];
      if (!actor) throw new Error('CAPACITY_ACTOR_MISSING');

      const started = performance.now();
      const reply = await actor.act(action);
      latencies.push(performance.now() - started);
      if (reply.type !== 'ACK') {
        if (rejected) return reply;
        throw new Error('CAPACITY_COMMAND_REJECTED');
      }
      if (rejected) throw new Error('CAPACITY_EXPECTED_REJECTION');

      await until(() =>
        actors.every((participant) => (participant.view?.sequence ?? -1) >= reply.sequence),
      );
      return reply;
    }

    return {
      actors,
      act,
      view: () => actors[0]?.view,
      async ready() {
        for (let seat = 0; seat < count; seat++) await act(seat, { type: 'READY', ready: true });
      },
      async complete() {
        await this.ready();
        await act(0, { type: 'START_MATCH' });
        for (let step = 0; step < 120; step++) {
          await until(() => !actors[0]?.view?.transition);
          const current = actors[0]?.view;
          const match = current?.match;
          if (!current || !match) throw new Error('CAPACITY_GAME_MISSING');
          await until(() =>
            actors.every((actor) => (actor.view?.sequence ?? -1) >= current.sequence),
          );
          if (current.status === 'finished') {
            if (current.outcome?.reason !== 'completed')
              throw new Error('CAPACITY_INCOMPLETE_GAME');
            return current;
          }

          const phase = match.phase;
          if (phase.type === 'PREPARATION') {
            for (let seat = 0; seat < count; seat++)
              await act(seat, { type: 'PREPARE', intent: { type: 'pass' } });
          } else if (phase.type === 'ELEVEN_DECISION') {
            await act(phase.team === 'A' ? 0 : 1, { type: 'DECIDE_ELEVEN', response: 'play' });
          } else if (phase.type === 'RAISE_RESPONSE') {
            await act(match.hand.betting.lastRaisingTeam === 'A' ? 1 : 0, {
              type: 'RESPOND_RAISE',
              response: match.hand.betting.pendingStake === 12 ? 'accept' : 'raise',
            });
          } else if (phase.type === 'TURN') {
            const own = actors[phase.seat]?.view?.match?.hand.hands[phase.seat];
            const card = own?.visibility === 'visible' ? own.cards[0] : undefined;
            if (!card) throw new Error('CAPACITY_OWN_CARD_MISSING');

            await act(
              phase.seat,
              match.hand.kind === 'normal' &&
                match.hand.betting.acceptedStake < 12 &&
                match.hand.betting.lastRaisingTeam !== (phase.seat % 2 === 0 ? 'A' : 'B')
                ? { type: 'REQUEST_RAISE' }
                : { type: 'PLAY_CARD', card, covered: false },
            );
          } else throw new Error('CAPACITY_PHASE_UNEXPECTED');
        }

        throw new Error('CAPACITY_COMMAND_BOUND_EXCEEDED');
      },
      close() {
        for (const actor of actors) actor.socket.close();
      },
    };
  } catch (error) {
    for (const actor of actors) actor.socket.close();
    throw error;
  }
}
