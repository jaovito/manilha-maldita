import { expect, test } from 'bun:test';
import { serverMessageSchema } from '@truco/game-protocol';
import { actor, fixture, playTurn, settleRoom, start } from '../../room-application.test';

async function beginDeal(f: ReturnType<typeof fixture>) {
  const r = await f.room();
  for (const p of r.peers) await p.send({ type: 'READY', ready: true });
  const message = r.host.message({ type: 'START_MATCH' });
  const ack = await r.host.raw(message);
  expect(ack.type).toBe('ACK');

  return { ...r, startMessage: message, startAck: ack };
}

test('deal pauses have an exact boundary, no decision timer and no mutation for duplicate or rejected commands', async () => {
  const f = fixture();
  try {
    const r = await beginDeal(f);
    const before = structuredClone(r.host.view);
    expect(before.transition).toMatchObject({ kind: 'deal', until: 900 });
    expect(before.decisionId).toBeNull();
    expect(before.deadline).toBeNull();
    expect(before.paused).toBe(false);
    expect(serverMessageSchema.safeParse({ type: 'SNAPSHOT', room: before }).success).toBe(true);

    const rejected = r.host.message({ type: 'PREPARE', intent: { type: 'pass' } });
    await f.advance(899);
    expect(await r.host.raw(rejected)).toMatchObject({ code: 'DECISION_PAUSED' });
    expect(await r.host.raw(r.startMessage)).toEqual(r.startAck);
    expect(r.host.view.match).toEqual(before.match);
    expect(r.host.view.transition).toEqual(before.transition);

    await f.advance(900);
    expect(r.host.view.transition).toBeUndefined();
    expect(r.host.view.deadline).toBe(15900);
    expect(r.host.view.decisionId).not.toBeNull();
    // Replaying a rejected envelope preserves the original result after the pause.
    expect(await r.host.raw(rejected)).toMatchObject({ code: 'DECISION_PAUSED' });
    expect(r.host.view.match).toEqual(before.match);
  } finally {
    f.service.close();
  }
});

test('a completed trick stays visible before opening the winning leader full timer, including a late callback', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r);
    await playTurn(r);
    await playTurn(r);
    const result = r.host.view;
    expect(result.transition).toMatchObject({ kind: 'trick', until: 2700 });
    expect(result.match?.hand.completedTricks).toHaveLength(1);
    expect(result.match?.hand.plays).toEqual([]);
    const trick = result.match?.hand.completedTricks[0];
    if (!trick) throw new Error('NO_TRICK');
    expect(result.match?.phase).toEqual({ type: 'TURN', seat: trick.result.nextLeader });
    expect(result.deadline).toBeNull();
    expect(await r.host.send({ type: 'REQUEST_RAISE' })).toMatchObject({ code: 'DECISION_PAUSED' });

    await f.advance(2699);
    expect(r.host.view.transition).toEqual(result.transition);
    await f.advance(5000);
    expect(r.host.view.transition).toBeUndefined();
    expect(r.host.view.deadline).toBe(6000);
    expect(r.host.view.match).toEqual(result.match);
    for (const hand of r.host.view.match?.hand.hands ?? [])
      expect(hand.visibility).toBe(hand.seat === r.host.view.selfSeat ? 'visible' : 'hidden');
  } finally {
    f.service.close();
  }
});

test('hand result retains score and hidden cards, defers entropy and prevents retired callbacks crossing deal/rematch', async () => {
  const f = fixture();
  let samples = 0;
  const random = f.ports.randomInt;
  f.ports.randomInt = (max) => {
    samples++;
    return random(max);
  };
  try {
    const r = await f.room();
    await start(r);
    const phase = r.host.view.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('NO_TURN');
    await actor(r, phase.seat).send({ type: 'REQUEST_RAISE' });
    const responder = actor(r, (phase.seat + 1) % 2);
    const fold = responder.message({ type: 'RESPOND_RAISE', response: 'fold' });
    const sampled = samples;
    const ack = await responder.raw(fold);
    expect(ack.type).toBe('ACK');
    expect(r.host.view.match?.phase).toMatchObject({ type: 'HAND_END', reward: 1 });
    expect(r.host.view.transition).toMatchObject({ kind: 'hand', until: 3300 });
    expect(r.host.view.match?.hand.number).toBe(1);
    const handResult = structuredClone(r.host.view.match);
    const retired = f.timers.at(-1);
    await f.advance(3299);
    expect(samples).toBe(sampled);
    expect(await responder.raw(fold)).toEqual(ack);
    expect(r.host.view.match).toEqual(handResult);

    await f.advance(3300);
    expect(samples).toBeGreaterThan(sampled);
    expect(r.host.view.match?.hand.number).toBe(2);
    expect(r.host.view.match?.score).toEqual(handResult?.score);
    expect(r.host.view.transition).toMatchObject({ kind: 'deal', until: 4200 });
    const dealt = structuredClone(r.host.view);
    retired?.callback();
    await r.host.send({ type: 'SYNC' });
    expect(r.host.view.transition).toEqual(dealt.transition);
    expect(r.host.view.match).toEqual(dealt.match);

    await settleRoom(r);
    expect((await r.host.send({ type: 'SURRENDER' })).type).toBe('ACK');
    await r.host.send({ type: 'REMATCH' });
    retired?.callback();
    await r.host.send({ type: 'SYNC' });
    expect(r.host.view.status).toBe('lobby');
    expect(r.host.view.transition).toBeUndefined();
  } finally {
    f.service.close();
  }
});

test('reconnecting during distribution preserves its end and spends protection only after the decision opens', async () => {
  const f = fixture();
  try {
    const r = await beginDeal(f);
    const before = r.host.view.transition;
    await r.host.disconnect();
    f.setNow(400);
    const replacement = f.peer(r.host.session);
    await replacement.connect(r.code);
    expect(replacement.view.transition).toEqual(before);
    await replacement.disconnect();
    await f.advance(900);
    const present = actor(r, 1);
    expect(present.view.transition).toBeUndefined();
    expect(present.view.paused).toBe(true);
    await f.advance(60899);
    expect(present.view.paused).toBe(true);
    await f.advance(60900);
    expect(present.view.paused).toBe(false);
    expect(present.view.deadline).toBe(75900);
    expect(present.view.match?.powers?.players.every((p) => !p.ready)).toBe(true);
  } finally {
    f.service.close();
  }
});

test('surrender cancels each transition without later dealing or re-opening a decision; leave keeps its match restriction', async () => {
  for (const kind of ['deal', 'trick', 'hand'] as const) {
    const f = fixture();
    try {
      const r = await beginDeal(f);
      if (kind !== 'deal') {
        await settleRoom(r);
        await playTurn(r);
        if (kind === 'trick') await playTurn(r);
        else {
          const phase = r.host.view.match?.phase;
          if (phase?.type !== 'TURN') throw new Error('NO_TURN');
          await actor(r, phase.seat).send({ type: 'REQUEST_RAISE' });
          await actor(r, (phase.seat + 1) % 2).send({ type: 'RESPOND_RAISE', response: 'fold' });
        }
      }
      expect(r.host.view.transition?.kind).toBe(kind);
      const retired = f.timers.at(-1);
      expect(await r.host.send({ type: 'LEAVE' })).toMatchObject({ code: 'INVALID_PHASE' });
      expect((await r.host.send({ type: 'SURRENDER' })).type).toBe('ACK');
      const finished = structuredClone(r.host.view.match);
      expect(r.host.view.transition).toBeUndefined();
      expect(r.host.view.outcome?.reason).toBe('surrender');
      await f.advance(10000);
      retired?.callback();
      await r.host.send({ type: 'SYNC' });
      expect(r.host.view.match).toEqual(finished);
      expect(r.host.view.decisionId).toBeNull();
    } finally {
      f.service.close();
    }
  }
});
