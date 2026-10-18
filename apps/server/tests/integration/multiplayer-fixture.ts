import { expect } from 'bun:test';
import {
  defaultRoomConfig,
  serverMessageSchema,
  type Action,
  type ClientMessage,
  type CommandReply,
  type RoomView,
  type RoomConfig,
} from '@truco/game-protocol';
import { startServer } from '../../src/bootstrap/runtime';

const origin = 'http://multiplayer.test';
let clientSerial = 0;
export class Player {
  view: RoomView | undefined;
  private counter = 0;
  private readonly clientId = ++clientSerial;
  private replies = new Map<string, (reply: CommandReply) => void>();
  private waiters: { predicate: (view: RoomView) => boolean; resolve: (view: RoomView) => void }[] =
    [];
  readonly socket: WebSocket;
  constructor(
    readonly cookie: string,
    code: string,
    address: URL,
  ) {
    const url = new URL(`/api/rooms/${code}/ws`, address);
    url.protocol = 'ws:';
    this.socket = new WebSocket(url, { headers: { Cookie: cookie, Origin: origin } });
    this.socket.addEventListener('message', (event) => {
      const message = serverMessageSchema.parse(JSON.parse(String(event.data)));
      if (message.type === 'SNAPSHOT') {
        this.view = message.room;
        for (const waiter of [...this.waiters])
          if (waiter.predicate(message.room)) {
            this.waiters.splice(this.waiters.indexOf(waiter), 1);
            waiter.resolve(message.room);
          }
      } else if (message.commandId) {
        const resolve = this.replies.get(message.commandId);
        this.replies.delete(message.commandId);
        resolve?.(message);
      }
    });
  }
  wait(predicate: (view: RoomView) => boolean = () => true): Promise<RoomView> {
    if (this.view && predicate(this.view)) return Promise.resolve(this.view);
    return new Promise((resolve) => this.waiters.push({ predicate, resolve }));
  }
  envelope(action: Action): ClientMessage {
    const room = this.view;
    if (!room) throw new Error('Missing snapshot');
    const lobby = ['READY', 'SET_SEAT', 'CONFIGURE', 'START_MATCH', 'REMATCH', 'LEAVE'].includes(
      action.type,
    );

    return {
      protocol: 1,
      commandId: `p${this.clientId}_${++this.counter}`,
      matchId: room.matchId,
      decisionId: lobby ? null : room.decisionId,
      expectedRevision: lobby ? room.roomRevision : (room.match?.revision ?? null),
      action,
    };
  }
  send(message: ClientMessage): Promise<CommandReply> {
    return new Promise((resolve) => {
      this.replies.set(message.commandId, resolve);
      this.socket.send(JSON.stringify(message));
    });
  }
  act(action: Action) {
    return this.send(this.envelope(action));
  }
}
export async function setup(count: 2 | 4, config: RoomConfig = defaultRoomConfig) {
  const runtime = startServer({ port: 0, allowedOrigins: [origin] });
  const players: Player[] = [];
  const cookies: string[] = [];
  async function post(path: string, body: unknown, cookie?: string) {
    return fetch(new URL(path, runtime.server.url), {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  }
  try {
    expect(await (await fetch(new URL('/health', runtime.server.url))).json()).toEqual({
      status: 'ok',
    });
    for (let seat = 0; seat < count; seat++) {
      const response = await post('/api/guest', { nickname: `Jogador ${seat}` });
      const cookie = response.headers.get('set-cookie')?.split(';')[0];
      if (!cookie) throw new Error('Missing guest cookie');
      cookies.push(cookie);
    }
    const created = await post(
      '/api/rooms',
      { config: { ...config, format: count === 2 ? '1v1' : '2v2' } },
      cookies[0],
    );
    const body: unknown = await created.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('code' in body) ||
      typeof body.code !== 'string'
    )
      throw new Error('Missing room code');
    const code = body.code;
    for (const cookie of cookies.slice(1))
      expect((await post(`/api/rooms/${code}/join`, {}, cookie)).status).toBe(200);
    for (const cookie of cookies) {
      const player = new Player(cookie, code, runtime.server.url);
      players.push(player);
      await player.wait();
    }
    async function all(sequence: number) {
      await Promise.all(players.map((player) => player.wait((view) => view.sequence >= sequence)));
    }
    async function act(seat: number, action: Action) {
      const player = players[seat];
      if (!player) throw new Error('Invalid test seat');
      const reply = await player.act(action);
      if (reply.type === 'ACK') await all(reply.sequence);
      return reply;
    }
    async function settle() {
      while (players[0]?.view?.transition) {
        const transition = players[0].view.transition;
        const view = await players[0].wait((current) => current.transition?.id !== transition.id);
        await all(view.sequence);
      }
    }
    async function prepare() {
      await settle();
      if (players[0]?.view?.match?.phase.type !== 'PREPARATION') return;
      for (let seat = 0; seat < count; seat++)
        expect((await act(seat, { type: 'PREPARE', intent: { type: 'pass' } })).type).toBe('ACK');
    }
    async function begin(withPreparation = true) {
      for (let seat = 0; seat < count; seat++)
        expect((await act(seat, { type: 'READY', ready: true })).type).toBe('ACK');
      expect((await act(0, { type: 'START_MATCH' })).type).toBe('ACK');
      await settle();
      if (withPreparation) await prepare();
    }
    return {
      runtime,
      players,
      cookies,
      code,
      all,
      act,
      begin,
      prepare,
      settle,
      post,
      async stop() {
        for (const player of players) player.socket.close();
        await runtime.stop();
      },
    };
  } catch (error) {
    await runtime.stop();
    throw error;
  }
}
export function ownCard(player: Player) {
  const hand = player.view?.match?.hand.hands[player.view.selfSeat];
  if (hand?.visibility !== 'visible' || !hand.cards[0]) throw new Error('No own card');
  return hand.cards[0];
}
export function assertPrivacy(players: readonly Player[]) {
  for (const player of players) {
    const view = player.view;
    if (!view?.match) throw new Error('No match');
    for (const hand of view.match.hand.hands)
      expect(hand.visibility).toBe(hand.seat === view.selfSeat ? 'visible' : 'hidden');
    const json = JSON.stringify(view);
    for (const forbidden of ['stock', 'sessionId', 'token', 'seed'])
      expect(json).not.toContain(`"${forbidden}"`);
  }
}
export async function completeMatch(game: Awaited<ReturnType<typeof setup>>) {
  for (let step = 0; step < 90; step++) {
    await game.settle();
    const view = game.players[0]?.view;
    const match = view?.match;
    if (!view || !match) throw new Error('Missing game');
    if (view.status === 'finished') {
      expect(view.outcome?.reason).toBe('completed');
      expect(Math.max(match.score.A, match.score.B)).toBe(12);
      return;
    }
    if (match.phase.type === 'PREPARATION') {
      await game.prepare();
    } else if (match.phase.type === 'ELEVEN_DECISION') {
      const responder = match.phase.team === 'A' ? 0 : 1;
      expect((await game.act(responder, { type: 'DECIDE_ELEVEN', response: 'play' })).type).toBe(
        'ACK',
      );
    } else if (match.phase.type === 'RAISE_RESPONSE') {
      const responder = match.hand.betting.lastRaisingTeam === 'A' ? 1 : 0;
      expect(
        (
          await game.act(responder, {
            type: 'RESPOND_RAISE',
            response: match.hand.betting.pendingStake === 12 ? 'accept' : 'raise',
          })
        ).type,
      ).toBe('ACK');
    } else if (match.phase.type === 'TURN') {
      const seat = match.phase.seat;
      const player = game.players[seat];
      if (!player) throw new Error('Missing player');
      const team = seat % 2 === 0 ? 'A' : 'B';
      const action: Action =
        match.hand.kind === 'normal' &&
        match.hand.betting.acceptedStake < 12 &&
        match.hand.betting.lastRaisingTeam !== team
          ? { type: 'REQUEST_RAISE' }
          : { type: 'PLAY_CARD', card: ownCard(player), covered: false };
      expect((await game.act(seat, action)).type).toBe('ACK');
    } else throw new Error('Unexpected exposed transient phase');
  }
  throw new Error('Match did not complete within bounded commands');
}
