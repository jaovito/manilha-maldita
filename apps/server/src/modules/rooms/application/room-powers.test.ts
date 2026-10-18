import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { actor, fixture, start } from './room-service.test';

test('preparation accepts simultaneous old revisions, keeps deadline/context, conceals commitments and replays ACK after reconnect', async () => {
  const f = fixture();
  try {
    const r = await f.room({ ...defaultRoomConfig, format: '2v2' });
    await start(r, false);
    const context = r.host.view.decisionId;
    const deadline = r.host.view.deadline;
    const envelopes = r.peers.map((p) => p.message({ type: 'PREPARE', intent: { type: 'pass' } }));
    const first = envelopes[0];
    if (!first) throw new Error('NO_MESSAGE');
    const ack = await r.host.raw(first);
    expect(ack.type).toBe('ACK');
    expect(r.host.view.decisionId).toBe(context);
    expect(r.host.view.deadline).toBe(deadline);
    expect(r.host.view.match?.powers?.players[0]?.ready).toBe(true);
    expect(r.host.view.match?.powers?.activations).toEqual([]);
    expect(r.host.view.match?.powers?.players.map((p) => p.energy)).toEqual([2, 2, 2, 2]);
    expect(await r.host.send({ type: 'PREPARE', intent: { type: 'pass' } })).toMatchObject({
      code: 'ALREADY_PREPARED',
    });
    const replacement = f.peer(r.host.session);
    await replacement.connect(r.code);
    expect(await replacement.raw(first)).toEqual(ack);
    for (const [index, p] of r.peers.entries()) {
      if (index === 0) continue;
      const message = envelopes[index];
      if (!message) throw new Error('NO_MESSAGE');
      expect((await p.raw(message)).type).toBe('ACK');
    }
    expect(replacement.view.match?.phase.type).toBe('TURN');
    expect(replacement.view.decisionId).not.toBe(context);
    expect(await replacement.raw({ ...first, commandId: 'after' })).toMatchObject({
      code: 'STALE_CONTEXT',
    });
  } finally {
    f.service.close();
  }
});

test('preparation deadline passes only missing players, and cancelled callback cannot affect the turn', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r, false);
    expect(r.host.view.deadline).toBe(15000);
    const oldTimer = f.timers.at(-1);
    await r.host.send({ type: 'PREPARE', intent: { type: 'pass' } });
    const guest = actor(r, 1);
    const late = guest.message({ type: 'PREPARE', intent: { type: 'pass' } });
    f.setNow(15000);
    expect(await guest.raw(late)).toMatchObject({ code: 'STALE_CONTEXT' });
    expect(r.host.view.match?.phase.type).toBe('TURN');
    expect(r.host.view.match?.powers?.players.every((p) => p.ready)).toBe(true);
    const decision = r.host.view.decisionId;
    oldTimer?.callback();
    await r.host.send({ type: 'SYNC' });
    expect(r.host.view.decisionId).toBe(decision);
  } finally {
    f.service.close();
  }
});

test('disconnecting a prepared player does not pause; missing intent consumes cumulative protection and resumes remaining preparation time', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r, false);
    await r.host.send({ type: 'PREPARE', intent: { type: 'pass' } });
    await r.host.disconnect();
    const guest = actor(r, 1);
    expect(guest.view.paused).toBe(false);
    f.setNow(1000);
    await guest.disconnect();
    const host = f.peer(r.host.session);
    await host.connect(r.code);
    expect(host.view.paused).toBe(true);
    f.setNow(6000);
    await guest.connect(r.code);
    expect(host.view.deadline).toBe(20000);
    expect(host.view.decisionId).toBe(guest.view.decisionId);
    expect((await guest.send({ type: 'PREPARE', intent: { type: 'pass' } })).type).toBe('ACK');
  } finally {
    f.service.close();
  }
});

test('rejections and duplicate preparations consume no entropy, cards or energy', async () => {
  const f = fixture();
  let samples = 0;
  const draw = f.ports.randomInt;
  f.ports.randomInt = (bound) => {
    samples++;
    return draw(bound);
  };
  try {
    const r = await f.room();
    await start(r, false);
    const before = structuredClone(r.host.view.match);
    const sampled = samples;
    expect(await r.host.send({ type: 'REQUEST_RAISE' })).toMatchObject({ code: 'INVALID_PHASE' });
    expect(r.host.view.match).toEqual(before);
    const message = r.host.message({ type: 'PREPARE', intent: { type: 'pass' } });
    const ack = await r.host.raw(message);
    const committed = structuredClone(r.host.view.match);
    expect(await r.host.raw(message)).toEqual(ack);
    expect(r.host.view.match).toEqual(committed);
    expect(samples).toBe(sampled);
    expect(r.host.view.match?.powers?.players.map((player) => player.energy)).toEqual([2, 2]);
  } finally {
    f.service.close();
  }
});
