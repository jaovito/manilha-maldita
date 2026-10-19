import { expect, test } from 'bun:test';
import {
  type Action,
  type ClientMessage,
  defaultRoomConfig,
  type RoomConfig,
  type RoomView,
  type ServerMessage,
} from '@truco/game-protocol';
import { RoomService } from './room-service';
import type { Ports, Sink } from './state/types';

export function fixture(options: { soloEnabled?: boolean; devTools?: boolean } = {}) {
  let now = 0;
  let serial = 0;
  let seed = 12345;
  const timers: { at: number; callback: () => void; cancelled: boolean }[] = [];
  const ports: Ports = {
    now: () => now,
    id: () => `id_${++serial}`,
    randomInt(max) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 2 ** 32) * max);
    },
    schedule(at, callback) {
      const timer = { at, callback, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  };
  const service = new RoomService(ports, options);
  function peer(session: string) {
    const snapshots: RoomView[] = [];
    let closed = 0;
    let connection = '';
    let code = '';
    const sink: Sink = {
      send(message: ServerMessage) {
        if (message.type === 'SNAPSHOT') snapshots.push(message.room);
      },
      close() {
        closed++;
      },
    };
    return {
      session,
      snapshots,
      sink,
      get closed() {
        return closed;
      },
      get connection() {
        return connection;
      },
      get view(): RoomView {
        const view = snapshots.at(-1);
        if (!view) throw new Error('NO_SNAPSHOT');
        return view;
      },
      async connect(roomCode: string) {
        code = roomCode;
        connection = await service.connect(code, session, sink);
      },
      disconnect() {
        return service.disconnect(code, session, connection);
      },
      message(action: Action, commandId = `cmd_${++serial}`): ClientMessage {
        const view = this.view;
        const lobby = [
          'READY',
          'SET_SEAT',
          'CONFIGURE',
          'START_MATCH',
          'REMATCH',
          'LEAVE',
        ].includes(action.type);
        return {
          protocol: 1,
          commandId,
          matchId: view.matchId,
          decisionId: lobby ? null : view.decisionId,
          expectedRevision: lobby ? view.roomRevision : (view.match?.revision ?? null),
          action,
        };
      },
      send(action: Action) {
        return this.raw(this.message(action));
      },
      raw(message: ClientMessage) {
        return service.receive(code, session, connection, message);
      },
    };
  }
  async function room(
    config: RoomConfig = { ...defaultRoomConfig, cardTimeoutMs: 1000, responseTimeoutMs: 1000 },
  ) {
    const peers = Array.from({ length: config.format === '1v1' ? 2 : 4 }, (_, index) =>
      peer(`player_${index}`),
    );
    const host = peers[0];
    if (!host) throw new Error('NO_HOST');
    const { code } = await service.create(host.session, 'Jogador 0', config);
    await host.connect(code);
    for (const [index, p] of peers.entries()) {
      if (index === 0) continue;
      await service.join(code, p.session, `Jogador ${index}`);
      await p.connect(code);
    }
    return { code, peers, host, advance };
  }
  async function advance(value: number) {
    now = value;
    for (let iteration = 0; iteration < 200; iteration++) {
      const timer = timers.find((entry) => !entry.cancelled && entry.at <= now);
      if (!timer) return;
      timer.cancelled = true;
      timer.callback();
      for (let count = 0; count < 15; count++) await Promise.resolve();
    }
    throw new Error('TIMER_LOOP');
  }
  return {
    service,
    ports,
    room,
    peer,
    timers,
    setNow(value: number) {
      now = value;
    },
    advance,
  };
}

type TestRoom = Awaited<ReturnType<ReturnType<typeof fixture>['room']>>;
export async function start(room: TestRoom, prepare = true) {
  for (const p of room.peers)
    expect((await p.send({ type: 'READY', ready: true })).type).toBe('ACK');
  expect((await room.host.send({ type: 'START_MATCH' })).type).toBe('ACK');
  await settleRoom(room);
  if (prepare) await prepareRoom(room);
}
export async function settleRoom(room: TestRoom) {
  for (let count = 0; count < 2 && room.host.view.transition; count++)
    await room.advance(room.host.view.transition.until);
}

export async function prepareRoom(room: TestRoom) {
  await settleRoom(room);
  if (room.host.view.match?.phase.type !== 'PREPARATION') return;
  for (const p of room.peers)
    if (!p.view.match?.powers?.players[p.view.selfSeat]?.ready)
      expect((await p.send({ type: 'PREPARE', intent: { type: 'pass' } })).type).toBe('ACK');
}
export function actor(room: TestRoom, seat: number) {
  const p = room.peers.find((candidate) => candidate.view.selfSeat === seat);
  if (!p) throw new Error('NO_ACTOR');
  return p;
}
export async function playTurn(room: TestRoom) {
  await prepareRoom(room);
  const match = room.host.view.match;
  if (match?.phase.type !== 'TURN') throw new Error('NO_TURN');
  const p = actor(room, match.phase.seat);
  const hand = p.view.match?.hand.hands.find((entry) => entry.seat === p.view.selfSeat);
  const card = hand?.visibility === 'visible' ? hand.cards[0] : undefined;
  if (!card) throw new Error('NO_CARD');
  expect((await p.send({ type: 'PLAY_CARD', card, covered: false })).type).toBe('ACK');
}
export async function giveOneToA(room: TestRoom) {
  await prepareRoom(room);
  if (room.host.view.match?.phase.type !== 'TURN') throw new Error('NO_TURN');
  if (room.host.view.match.phase.seat % 2 === 1) await playTurn(room);
  const phase = room.host.view.match?.phase;
  if (phase?.type !== 'TURN') throw new Error('NO_TURN');
  expect((await actor(room, phase.seat).send({ type: 'REQUEST_RAISE' })).type).toBe('ACK');
  expect((await actor(room, 1).send({ type: 'RESPOND_RAISE', response: 'fold' })).type).toBe('ACK');
  await settleRoom(room);
}

test('lobby enforces host, readiness, free seats, configuration and membership', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    const guest = actor(r, 1);
    expect(await guest.send({ type: 'CONFIGURE', config: defaultRoomConfig })).toMatchObject({
      code: 'NOT_HOST',
    });
    expect(await guest.send({ type: 'START_MATCH' })).toMatchObject({ code: 'NOT_HOST' });
    expect(await r.host.send({ type: 'START_MATCH' })).toMatchObject({ code: 'NOT_READY' });
    expect(await r.host.send({ type: 'SET_SEAT', seat: 3 })).toMatchObject({
      code: 'INVALID_SEAT',
    });
    await guest.send({ type: 'READY', ready: true });
    expect(await r.host.send({ type: 'SET_SEAT', seat: 1 })).toMatchObject({ code: 'SEAT_TAKEN' });
    await guest.send({ type: 'READY', ready: false });
    const before = structuredClone(r.host.view);

    expect(await r.host.send({ type: 'SET_SEAT', seat: 1 })).toMatchObject({ code: 'SEAT_TAKEN' });
    expect(r.host.view).toEqual(before);
    expect((await r.host.send({ type: 'SET_SEAT', seat: 0 })).type).toBe('ACK');
    await r.host.send({
      type: 'CONFIGURE',
      config: { ...defaultRoomConfig, preset: 'competitive' },
    });
    expect(r.host.view.config.cardTimeoutMs).toBe(20000);
    expect(r.host.view.seats.every((member) => !member?.ready)).toBe(true);
    await expect(f.service.join(r.code, 'third', 'Terceiro')).rejects.toThrow('ROOM_FULL');
    await f.service.join(r.code, guest.session, 'Ignorado');
    await expect(f.service.connect(r.code, 'stranger', f.peer('stranger').sink)).rejects.toThrow(
      'NOT_MEMBER',
    );
    await start(r);
    await expect(f.service.join(r.code, 'late', 'Atrasado')).rejects.toThrow('ROOM_CLOSED');
    expect(await r.host.send({ type: 'LEAVE' })).toMatchObject({ code: 'INVALID_PHASE' });
  } finally {
    f.service.close();
  }
});

test('moving to a free seat preserves the other players and transfers host ownership', async () => {
  const f = fixture();

  try {
    const r = await f.room({ ...defaultRoomConfig, format: '2v2' });
    const guest = actor(r, 3);
    await guest.send({ type: 'LEAVE' });
    const occupied = r.host.view.seats.slice(1, 3);

    expect((await r.host.send({ type: 'SET_SEAT', seat: 3 })).type).toBe('ACK');
    expect(r.host.view.hostSeat).toBe(3);
    expect(r.host.view.selfSeat).toBe(3);
    expect(r.host.view.seats[0]).toBeNull();
    expect(r.host.view.seats.slice(1, 3)).toEqual(occupied);
  } finally {
    f.service.close();
  }
});

test('changing format preserves occupants, rejects occupied truncation and transfers host when leaving', async () => {
  const f = fixture();
  try {
    const r = await f.room({ ...defaultRoomConfig, format: '2v2' });
    expect(await r.host.send({ type: 'CONFIGURE', config: defaultRoomConfig })).toMatchObject({
      code: 'ROOM_FULL',
    });
    await actor(r, 3).send({ type: 'LEAVE' });
    await actor(r, 2).send({ type: 'LEAVE' });
    expect((await r.host.send({ type: 'CONFIGURE', config: defaultRoomConfig })).type).toBe('ACK');
    expect(r.host.view.seats).toHaveLength(2);
    await r.host.send({ type: 'LEAVE' });
    expect(actor(r, 1).view.hostSeat).toBe(1);
    await expect(r.host.send({ type: 'SYNC' })).rejects.toThrow('NOT_MEMBER');
  } finally {
    f.service.close();
  }
});
