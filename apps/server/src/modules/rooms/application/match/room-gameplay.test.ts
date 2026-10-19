import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { actor, fixture, playTurn, start } from '../room-service.test';

test('serialized commands replay original ACKs, reject payload reuse and recover after rejected queue tasks', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    const message = r.host.message({ type: 'READY', ready: true }, 'same');
    const [first, duplicate] = await Promise.all([r.host.raw(message), r.host.raw(message)]);
    expect(duplicate).toEqual(first);
    const revision = r.host.view.roomRevision;
    expect(await r.host.raw({ ...message, action: { type: 'READY', ready: false } })).toMatchObject(
      { code: 'COMMAND_ID_REUSED' },
    );
    expect(r.host.view.roomRevision).toBe(revision);
    expect(await r.host.raw({ ...message, commandId: 'stale' })).toMatchObject({
      code: 'STALE_REVISION',
    });
    // @ts-expect-error raw input is validated even for direct application callers
    expect(await r.host.raw({ ...message, protocol: 2 })).toMatchObject({
      code: 'INVALID_MESSAGE',
    });
    await expect(f.service.receive(r.code, 'stranger', 'fake', message)).rejects.toThrow(
      'NOT_MEMBER',
    );
    expect((await r.host.send({ type: 'SYNC' })).type).toBe('ACK');
    const oldId = r.host.connection;
    const replacement = f.peer(r.host.session);
    await replacement.connect(r.code);
    expect(r.host.closed).toBe(1);
    await f.service.disconnect(r.code, r.host.session, oldId);
    await expect(r.host.raw(message)).rejects.toThrow('CONNECTION_REPLACED');
    expect((await replacement.send({ type: 'SYNC' })).type).toBe('ACK');
    await f.service.disconnect('ABSENT', r.host.session, oldId);
  } finally {
    f.service.close();
  }
});

test('gameplay requires fresh context and turn, and old timers cannot cross decisions or rematches', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r);
    const match = r.host.view.match;
    if (match?.phase.type !== 'TURN') throw new Error('NO_TURN');
    const active = actor(r, match.phase.seat);
    const other = actor(r, (match.phase.seat + 1) % 2);
    expect(await other.send({ type: 'REQUEST_RAISE' })).toMatchObject({ code: 'NOT_YOUR_TURN' });
    const stale = active.message({ type: 'REQUEST_RAISE' });
    const staleTimer = f.timers.at(-1);
    expect((await active.raw(stale)).type).toBe('ACK');
    expect(await active.raw({ ...stale, commandId: 'late' })).toMatchObject({
      code: 'STALE_CONTEXT',
    });
    const pendingDecision = active.view.decisionId;
    staleTimer?.callback();
    await active.send({ type: 'SYNC' });
    expect(active.view.decisionId).toBe(pendingDecision);
    expect((await other.send({ type: 'RESPOND_RAISE', response: 'accept' })).type).toBe('ACK');
    const beforeEnd = active.message({ type: 'REQUEST_RAISE' });
    expect((await active.send({ type: 'SURRENDER' })).type).toBe('ACK');
    expect(active.view.outcome?.reason).toBe('surrender');
    expect(await other.send({ type: 'REMATCH' })).toMatchObject({ code: 'NOT_HOST' });
    expect((await r.host.send({ type: 'REMATCH' })).type).toBe('ACK');
    expect(r.host.view.matchId).toBe(null);
    await start(r);
    expect(await active.raw(beforeEnd)).toMatchObject({ code: 'STALE_CONTEXT' });
    expect(active.view.status).toBe('playing');
  } finally {
    f.service.close();
  }
});

test('room and pending-command limits are bounded and failed tasks do not poison queues', async () => {
  const f = fixture();
  try {
    for (let index = 0; index < 3; index++)
      await f.service.create('same', 'Mesmo', defaultRoomConfig);
    await expect(f.service.create('same', 'Mesmo', defaultRoomConfig)).rejects.toThrow(
      'SESSION_CAPACITY',
    );
    const r = await f.room();
    const results = await Promise.allSettled(
      Array.from({ length: 65 }, () => r.host.send({ type: 'SYNC' })),
    );
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    if (rejection?.status === 'rejected') expect(String(rejection.reason)).toContain('ROOM_BUSY');
    expect((await r.host.send({ type: 'SYNC' })).type).toBe('ACK');
    for (let index = 4; index < 256; index++)
      await f.service.create(`extra_${index}`, 'Extra', defaultRoomConfig);
    await expect(f.service.create('last', 'Ultimo', defaultRoomConfig)).rejects.toThrow(
      'ROOM_CAPACITY',
    );
  } finally {
    f.service.close();
  }
});

test('complete 1v1 and 2v2 matches finish once at twelve and team responses serialize first wins', async () => {
  for (const format of ['1v1', '2v2'] as const) {
    const f = fixture();
    try {
      const r = await f.room({ ...defaultRoomConfig, format });
      await start(r);
      const phase = r.host.view.match?.phase;
      if (phase?.type !== 'TURN') throw new Error('NO_TURN');
      const requester = actor(r, phase.seat);
      const responder = actor(r, phase.seat % 2 === 0 ? 1 : 0);
      await requester.send({ type: 'REQUEST_RAISE' });
      await responder.send({ type: 'RESPOND_RAISE', response: 'raise' });
      await requester.send({ type: 'RESPOND_RAISE', response: 'raise' });
      await responder.send({ type: 'RESPOND_RAISE', response: 'raise' });
      const acceptance = requester.message({ type: 'RESPOND_RAISE', response: 'accept' });
      if (format === '2v2') {
        const partner = actor(r, (requester.view.selfSeat + 2) % 4);
        const second = partner.message({ type: 'RESPOND_RAISE', response: 'accept' });
        const [firstReply, secondReply] = await Promise.all([
          requester.raw(acceptance),
          partner.raw(second),
        ]);
        expect(firstReply.type).toBe('ACK');
        expect(secondReply).toMatchObject({ code: 'STALE_CONTEXT' });
      } else expect((await requester.raw(acceptance)).type).toBe('ACK');
      for (let play = 0; play < 24 && r.host.view.status === 'playing'; play++) await playTurn(r);
      expect(r.host.view.status).toBe('finished');
      expect(r.host.view.outcome?.reason).toBe('completed');
      const score = r.host.view.match?.score;
      expect(score && Math.max(score.A, score.B)).toBe(12);
      expect(r.host.view.decisionId).toBe(null);
      expect(r.host.view.deadline).toBe(null);
      const final = r.host.view;
      expect(await requester.raw({ ...acceptance, commandId: 'after_end' })).toMatchObject({
        code: 'INVALID_PHASE',
      });
      expect(r.host.view.match?.score).toEqual(final.match?.score);
    } finally {
      f.service.close();
    }
  }
});

test('a lobby emptied by explicit leaves expires instead of keeping an unowned room', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await actor(r, 1).send({ type: 'LEAVE' });
    await r.host.send({ type: 'LEAVE' });
    await f.advance(60000);
    await expect(f.service.join(r.code, 'late', 'Novo')).rejects.toThrow('ROOM_NOT_FOUND');
  } finally {
    f.service.close();
  }
});

test('replacement survives failing notifications and closes from the previous connection', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    let notifications = 0;
    let closes = 0;
    await f.service.connect(r.code, r.host.session, {
      send(message) {
        if (message.type === 'ERROR') {
          notifications++;
          throw new Error('PREVIOUS_SEND_FAILED');
        }
      },
      close() {
        closes++;
        throw new Error('PREVIOUS_CLOSE_FAILED');
      },
    });
    const replacement = f.peer(r.host.session);
    await replacement.connect(r.code);
    expect(notifications).toBe(1);
    expect(closes).toBe(1);
    expect(replacement.connection).not.toBe('');
    expect(replacement.view.selfSeat).toBe(0);
    expect((await replacement.send({ type: 'SYNC' })).type).toBe('ACK');
    await replacement.disconnect();
    expect(actor(r, 1).view.seats[0]?.connected).toBe(false);
    const another = f.peer(r.host.session);
    await another.connect(r.code);
    expect((await another.send({ type: 'SYNC' })).type).toBe('ACK');
  } finally {
    f.service.close();
  }
});

test('closing all rooms clears authority despite a failing client close callback', async () => {
  const f = fixture();
  const r = await f.room();
  await f.service.connect(r.code, r.host.session, {
    send() {},
    close() {
      throw new Error('CLIENT_CLOSE_FAILED');
    },
  });
  expect(() => f.service.close()).not.toThrow();
  expect(() => f.service.close()).not.toThrow();
  await expect(f.service.join(r.code, 'late', 'Novo')).rejects.toThrow('ROOM_NOT_FOUND');
});
