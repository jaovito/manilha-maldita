import { expect, test } from 'bun:test';
import { defaultRoomConfig, roomViewSchema } from '@truco/game-protocol';
import { fixture } from '../../room-application.test';

const options = { soloEnabled: true, devTools: true };

for (const format of ['1v1', '2v2'] as const) {
  for (const preset of ['casual', 'competitive'] as const) {
    test(`${format} ${preset} solo starts, completes, rematches and expires without humans`, async () => {
      const f = fixture(options);
      const human = f.peer('human');
      const { code } = await f.service.create(
        'human',
        'Treinador',
        { ...defaultRoomConfig, format, preset },
        true,
      );
      await expect(f.service.join(code, 'other', 'Intruso')).rejects.toThrow('ROOM_CLOSED');
      await human.connect(code);
      expect(human.view.solo).toBe(true);
      expect(human.view.devTools).toBe(true);
      expect(human.view.status).toBe('playing');
      expect(human.view.config).toMatchObject({ format, preset });
      expect(human.view.seats).toHaveLength(format === '1v1' ? 2 : 4);
      expect(human.view.seats.every((member) => member?.connected)).toBe(true);
      expect(new Set(human.view.seats.map((member) => member?.nickname)).size).toBe(
        human.view.seats.length,
      );
      const botPlays = new Set<number>();
      let time = 0;
      for (let step = 0; step < 1200 && human.view.status !== 'finished'; step++) {
        time += 1000;
        await f.advance(time);
        const view = human.view;
        roomViewSchema.parse(view);
        const match = view.match;
        if (!match || view.transition || view.paused) continue;
        const own = match.hand.hands[0];
        expect(match.hand.hands[1]?.visibility).toBe('hidden');
        if (format === '2v2') {
          expect(match.hand.hands[3]?.visibility).toBe('hidden');
          if (match.score.A !== 11) expect(match.hand.hands[2]?.visibility).toBe('hidden');
        }
        for (const trick of [...match.hand.completedTricks, { plays: match.hand.plays }]) {
          for (const play of trick.plays) if (play.seat !== 0) botPlays.add(play.seat);
        }
        if (match.phase.type === 'PREPARATION' && !match.powers?.players[0]?.ready) {
          expect((await human.send({ type: 'PREPARE', intent: { type: 'pass' } })).type).toBe(
            'ACK',
          );
        } else if (
          match.phase.type === 'TURN' &&
          match.phase.seat === 0 &&
          own?.visibility === 'visible' &&
          own.cards[0]
        ) {
          expect(
            (await human.send({ type: 'PLAY_CARD', card: own.cards[0], covered: false })).type,
          ).toBe('ACK');
        } else if (
          match.phase.type === 'RAISE_RESPONSE' &&
          match.hand.betting.lastRaisingTeam === 'B'
        ) {
          await human.send({ type: 'RESPOND_RAISE', response: 'accept' });
        } else if (match.phase.type === 'ELEVEN_DECISION' && match.phase.team === 'A') {
          await human.send({ type: 'DECIDE_ELEVEN', response: 'play' });
        }
      }
      expect(human.view.status).toBe('finished');
      expect(human.view.outcome?.reason).toBe('completed');
      expect([...botPlays].sort()).toEqual(format === '1v1' ? [1] : [1, 2, 3]);
      expect(
        human.snapshots.some(
          (snapshot) =>
            snapshot.match?.phase.type === 'RAISE_RESPONSE' &&
            snapshot.match.hand.betting.lastRaisingTeam === 'B',
        ),
      ).toBe(true);
      const oldMatch = human.view.matchId;
      expect((await human.send({ type: 'REMATCH' })).type).toBe('ACK');
      expect(human.view.matchId).not.toBe(oldMatch);
      expect(human.view.status).toBe('playing');
      expect(human.view.config.format).toBe(format);
      expect(human.view.match?.score).toEqual({ A: 0, B: 0 });
      await human.disconnect();
      await f.advance(time + 1000);
      await human.connect(code);
      expect(human.view.match?.hand.hands[1]?.visibility).toBe('hidden');
      if (format === '2v2') expect(human.view.match?.hand.hands[2]?.visibility).toBe('hidden');
      await human.disconnect();
      await f.advance(time + 61000);
      await expect(human.connect(code)).rejects.toThrow('ROOM_NOT_FOUND');
      f.service.close();
    });
  }
}

test('development reset is gated, validated, idempotent and invalidates older commands', async () => {
  const f = fixture(options);
  const human = f.peer('human');
  const { code } = await f.service.create('human', 'Dev', defaultRoomConfig, true);
  await human.connect(code);
  await f.advance(900);
  const old = human.message({ type: 'PREPARE', intent: { type: 'pass' } });
  const cards = [
    { rank: '3', suit: 'clubs' },
    { rank: 'A', suit: 'hearts' },
    { rank: '4', suit: 'spades' },
  ] as const;
  const bad = await human.send({ type: 'DEV_RESET_HAND', cards: [cards[0], cards[0], cards[2]] });
  expect(bad).toMatchObject({ type: 'ERROR', code: 'DUPLICATE_CARDS' });
  const command = human.message({
    type: 'DEV_RESET_HAND',
    cards: [...cards],
    power: 'exchange',
    energy: 3,
  });
  const accepted = await human.raw(command);
  expect(accepted.type).toBe('ACK');
  const view = human.view;
  expect(view.match?.hand.hands[0]).toMatchObject({ cards: [...cards] });
  expect(view.match?.powers?.players[0]).toMatchObject({
    power: 'exchange',
    energy: 3,
    used: false,
  });
  expect(view.match?.score).toEqual({ A: 0, B: 0 });
  expect(await human.raw(command)).toEqual(accepted);
  expect(human.view).toEqual(view);
  expect(await human.raw(old)).toMatchObject({ type: 'ERROR', code: 'STALE_CONTEXT' });
  await f.advance(2000);
  expect(
    (await human.send({ type: 'PREPARE', intent: { type: 'exchange', card: cards[0] } })).type,
  ).toBe('ACK');
  f.service.close();

  const disabled = fixture();
  await expect(disabled.service.create('h', 'Dev', defaultRoomConfig, true)).rejects.toThrow(
    'SOLO_DISABLED',
  );
  const room = await disabled.room();
  expect(await room.host.send({ type: 'DEV_RESET_HAND' })).toMatchObject({
    type: 'ERROR',
    code: 'DEV_TOOLS_DISABLED',
  });
  disabled.service.close();

  const soloOnly = fixture({ soloEnabled: true });
  const owner = soloOnly.peer('h');
  const created = await soloOnly.service.create('h', 'Normal', defaultRoomConfig, true);
  await owner.connect(created.code);
  expect(owner.view.devTools).toBe(false);
  expect(await owner.send({ type: 'DEV_RESET_HAND' })).toMatchObject({
    type: 'ERROR',
    code: 'DEV_TOOLS_DISABLED',
  });
  soloOnly.service.close();
});

test('bot answers a raise, pauses with its human offline and ignores a retired decision timer after reset', async () => {
  const f = fixture(options);
  const owner = f.peer('h');
  const { code } = await f.service.create('h', 'Dev', defaultRoomConfig, true);
  await owner.connect(code);
  await f.advance(900);
  const retired = f.timers.findLast((timer) => !timer.cancelled);
  expect((await owner.send({ type: 'DEV_RESET_HAND', power: 'mask' })).type).toBe('ACK');
  const revision = owner.view.match?.revision;
  retired?.callback();
  for (let count = 0; count < 20; count++) await Promise.resolve();
  expect(owner.view.match?.revision).toBe(revision);
  await f.advance(1800);
  await owner.send({ type: 'PREPARE', intent: { type: 'pass' } });
  await f.advance(2800);
  await f.advance(3800);
  expect(owner.view.match?.phase).toEqual({ type: 'TURN', seat: 0 });
  expect((await owner.send({ type: 'REQUEST_RAISE' })).type).toBe('ACK');
  await owner.disconnect();
  await f.advance(4800);
  await owner.connect(code);
  expect(owner.view.match?.phase.type).toBe('RAISE_RESPONSE');
  await f.advance(5800);
  expect(owner.view.match?.phase.type).not.toBe('RAISE_RESPONSE');
  f.service.close();
});

test('2v2 bots pause their preparation batch without a human and resume on reconnection', async () => {
  const f = fixture(options);

  try {
    const human = f.peer('human');
    const { code } = await f.service.create(
      'human',
      'Treinador',
      { ...defaultRoomConfig, format: '2v2' },
      true,
    );
    await human.connect(code);
    await f.advance(900);
    await f.advance(1899);
    const revision = human.view.match?.revision;
    await human.disconnect();
    await f.advance(4900);
    await human.connect(code);
    expect(human.view.match?.revision).toBe(revision);
    expect(human.view.match?.powers?.players.slice(1).every(({ ready }) => !ready)).toBe(true);
    expect(
      human.view.match?.hand.hands.slice(1).every((hand) => hand.visibility === 'hidden'),
    ).toBe(true);
    await human.send({ type: 'PREPARE', intent: { type: 'pass' } });
    await f.advance(5900);
    expect(human.view.match?.phase.type).not.toBe('PREPARATION');
  } finally {
    f.service.close();
  }
});
