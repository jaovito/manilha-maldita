import { expect, spyOn, test } from 'bun:test';
import { defaultRoomConfig, type RoomConfig, roomViewSchema } from '@truco/game-protocol';
import { appearanceFor, type MatchRecord } from '../../../../progression';
import { fixture } from '../../room-application.test';
import type { ResultWriter } from '../../ports/result-writer';

async function mixedRoom(
  count: number,
  config: RoomConfig = { ...defaultRoomConfig, format: '2v2' },
) {
  const records: MatchRecord[] = [];
  const writer: ResultWriter = {
    policyVersion: 'fixture-v1',
    reserve() {},
    release() {},
    write(record) {
      records.push(record);
    },
  };
  const f = fixture({ soloEnabled: true }, writer);
  const humans = Array.from({ length: count }, (_, seat) => f.peer(`human_${seat}`));
  const identities = humans.map(() => ({
    accountId: crypto.randomUUID(),
    appearance: appearanceFor('avatar-1', 'classic', 'classic'),
  }));
  const host = humans[0];
  if (!host) throw new Error('NO_HOST');

  const { code } = await f.service.create(host.session, 'Human 0', config, false, identities[0]);
  await host.connect(code);
  for (const [seat, peer] of humans.entries()) {
    if (seat === 0) continue;
    await f.service.join(code, peer.session, `Human ${seat}`, identities[seat]);
    await peer.connect(code);
  }

  return { ...f, code, host, humans, identities, records };
}

test('only the host can fill/remove lobby bots; duplicate and stale commands preserve seats and entropy', async () => {
  const r = await mixedRoom(3);
  try {
    const guest = r.humans[1];
    if (!guest) throw new Error('NO_GUEST');
    expect(await guest.send({ type: 'FILL_BOTS' })).toMatchObject({ code: 'NOT_HOST' });
    expect(await guest.send({ type: 'CLEAR_BOTS' })).toMatchObject({ code: 'NOT_HOST' });
    const old = r.host.message({ type: 'READY', ready: true });
    const message = r.host.message({ type: 'FILL_BOTS' });
    const ids = spyOn(r.ports, 'id');
    const entropy = spyOn(r.ports, 'randomInt');
    const reply = await r.host.raw(message);
    expect(reply.type).toBe('ACK');
    expect(ids).toHaveBeenCalledTimes(1);
    expect(entropy).not.toHaveBeenCalled();
    const filled = r.host.view;
    roomViewSchema.parse(filled);
    expect(filled.botFillEnabled).toBe(true);
    expect(filled.solo).toBeUndefined();
    expect(filled.seats[3]).toMatchObject({ bot: true, ready: true, connected: true });
    expect(filled.seats.slice(0, 3).every((member) => !member?.bot && !member?.ready)).toBe(true);
    expect(JSON.stringify(filled)).not.toMatch(/sessionId|accountId|human_0/);
    expect(await r.host.raw(message)).toEqual(reply);
    expect(r.host.view).toEqual(filled);
    expect(ids).toHaveBeenCalledTimes(1);
    expect(await r.host.raw(old)).toMatchObject({ code: 'STALE_REVISION' });
    expect(await r.host.send({ type: 'FILL_BOTS' })).toMatchObject({ code: 'ROOM_FULL' });
    expect(r.host.view).toEqual(filled);
    expect(ids).toHaveBeenCalledTimes(1);
    expect(entropy).not.toHaveBeenCalled();
    expect((await r.host.send({ type: 'CLEAR_BOTS' })).type).toBe('ACK');
    expect(r.host.view.seats[3]).toBeNull();
    expect(await r.host.send({ type: 'CLEAR_BOTS' })).toMatchObject({ code: 'INVALID_COMMAND' });
  } finally {
    r.service.close();
  }
});

test('bot fill respects availability, strict payloads and private solo rooms', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    expect(r.host.view.botFillEnabled).toBeUndefined();
    expect(await r.host.send({ type: 'FILL_BOTS' })).toMatchObject({ code: 'BOTS_DISABLED' });
    const forged = {
      ...r.host.message({ type: 'FILL_BOTS' }),
      action: { type: 'FILL_BOTS', botFillEnabled: true },
    };
    expect(
      await f.service.receive(r.code, r.host.session, r.host.connection, forged),
    ).toMatchObject({ code: 'INVALID_MESSAGE' });
  } finally {
    f.service.close();
  }

  const solo = fixture({ soloEnabled: true });
  try {
    const human = solo.peer('owner');
    const { code } = await solo.service.create('owner', 'Owner', defaultRoomConfig, true);
    expect(
      await solo.service.join(code, 'intruder', 'Other').then(
        () => 'JOINED',
        () => 'CLOSED',
      ),
    ).toBe('CLOSED');
    await human.connect(code);
    expect(human.view.botFillEnabled).toBeUndefined();
    expect(await human.send({ type: 'FILL_BOTS' })).toMatchObject({ code: 'INVALID_PHASE' });
  } finally {
    solo.service.close();
  }
});

test('late humans replace only lobby bots and human host ownership/readiness survive membership changes', async () => {
  const r = await mixedRoom(2);
  try {
    const guest = r.humans[1];
    if (!guest) throw new Error('NO_GUEST');
    await guest.send({ type: 'SET_SEAT', seat: 2 });
    await r.host.send({ type: 'FILL_BOTS' });
    await r.host.send({ type: 'READY', ready: true });
    await guest.send({ type: 'READY', ready: true });
    const replacement = r.peer('replacement');
    await r.service.join(r.code, replacement.session, 'Replacement');
    await replacement.connect(r.code);
    expect(replacement.view.selfSeat).toBe(1);
    expect(r.host.view.seats[3]?.bot).toBe(true);
    expect(
      r.host.view.seats.filter((member) => member && !member.bot).every((member) => !member?.ready),
    ).toBe(true);
    expect(r.host.view.seats[3]?.ready).toBe(true);
    await replacement.send({ type: 'LEAVE' });
    await guest.send({ type: 'SET_SEAT', seat: 1 });
    expect(r.host.view.seats[3]?.ready).toBe(true);
    await guest.send({ type: 'SET_SEAT', seat: 2 });
    await r.host.send({ type: 'FILL_BOTS' });
    await r.host.send({ type: 'LEAVE' });
    expect(guest.view.hostSeat).toBe(2);
    await guest.send({ type: 'LEAVE' });
    const newcomer = r.peer('newcomer');
    await r.service.join(r.code, newcomer.session, 'Newcomer');
    await newcomer.connect(r.code);
    expect(newcomer.view.hostSeat).toBe(newcomer.view.selfSeat);
    expect(newcomer.view.seats[newcomer.view.hostSeat]?.bot).toBeUndefined();
  } finally {
    r.service.close();
  }
});

test('configuration drops only truncated bots and bots stay ready after seat/config changes', async () => {
  const r = await mixedRoom(2);
  try {
    await r.host.send({ type: 'FILL_BOTS' });
    expect(
      (await r.host.send({ type: 'CONFIGURE', config: { ...defaultRoomConfig, format: '1v1' } }))
        .type,
    ).toBe('ACK');
    expect(r.host.view.seats).toHaveLength(2);
    expect(r.host.view.seats.every((member) => !member?.ready)).toBe(true);
    await r.host.send({ type: 'CONFIGURE', config: { ...defaultRoomConfig, format: '2v2' } });
    const guest = r.humans[1];
    if (!guest) throw new Error('NO_GUEST');
    await guest.send({ type: 'SET_SEAT', seat: 3 });
    await r.host.send({ type: 'FILL_BOTS' });
    expect(await r.host.send({ type: 'CONFIGURE', config: defaultRoomConfig })).toMatchObject({
      code: 'ROOM_FULL',
    });
    await r.host.send({
      type: 'CONFIGURE',
      config: { ...defaultRoomConfig, format: '2v2', preparationTimeoutMs: 10000 },
    });
    expect(r.host.view.seats.filter((member) => member?.bot).every((member) => member?.ready)).toBe(
      true,
    );
    await r.host.send({ type: 'CLEAR_BOTS' });
    await r.host.send({ type: 'SET_SEAT', seat: 1 });
    await r.host.send({ type: 'FILL_BOTS' });
    await r.host.send({ type: 'CLEAR_BOTS' });
    await r.host.send({ type: 'SET_SEAT', seat: 0 });
  } finally {
    r.service.close();
  }
});

for (const count of [2, 3]) {
  for (const preset of ['casual', 'competitive'] as const) {
    test(`${preset} 2v2 completes with ${count} humans and normal multiplayer result eligibility`, async () => {
      const r = await mixedRoom(count, { ...defaultRoomConfig, format: '2v2', preset });
      try {
        await r.host.send({ type: 'FILL_BOTS' });
        expect(await r.host.send({ type: 'START_MATCH' })).toMatchObject({ code: 'NOT_READY' });
        for (const human of r.humans) await human.send({ type: 'READY', ready: true });
        expect((await r.host.send({ type: 'START_MATCH' })).type).toBe('ACK');
        expect(await r.host.send({ type: 'CLEAR_BOTS' })).toMatchObject({
          code: 'INVALID_PHASE',
        });
        expect(await r.host.send({ type: 'DEV_RESET_HAND' })).toMatchObject({
          code: 'DEV_TOOLS_DISABLED',
        });
        await expect(r.service.join(r.code, 'late', 'Late')).rejects.toThrow('ROOM_CLOSED');
        const botPlays = new Set<number>();
        let time = 0;
        for (let step = 0; step < 2000 && r.host.view.status !== 'finished'; step++) {
          time += 1000;
          await r.advance(time);
          for (const human of r.humans) {
            const view = human.view;
            const match = view.match;
            if (!match || view.transition || view.paused || view.status !== 'playing') continue;
            const seat = view.selfSeat;
            const team = seat % 2 === 0 ? 'A' : 'B';
            for (const hand of match.hand.hands) {
              if (
                hand.seat === seat ||
                (match.hand.kind === 'eleven' &&
                  match.hand.elevenTeam === team &&
                  hand.seat % 2 === seat % 2)
              )
                continue;
              expect(hand.visibility).toBe('hidden');
            }
            for (const play of [
              ...match.hand.plays,
              ...match.hand.completedTricks.flatMap((trick) => trick.plays),
            ]) {
              if (view.seats[play.seat]?.bot) botPlays.add(play.seat);
            }
            const own = match.hand.hands[seat];
            if (match.phase.type === 'PREPARATION' && !match.powers?.players[seat]?.ready) {
              expect((await human.send({ type: 'PREPARE', intent: { type: 'pass' } })).type).toBe(
                'ACK',
              );
            } else if (
              match.phase.type === 'TURN' &&
              match.phase.seat === seat &&
              own?.visibility === 'visible' &&
              own.cards[0]
            ) {
              expect(
                (await human.send({ type: 'PLAY_CARD', card: own.cards[0], covered: false })).type,
              ).toBe('ACK');
            } else if (
              match.phase.type === 'RAISE_RESPONSE' &&
              match.hand.betting.lastRaisingTeam !== team
            ) {
              expect((await human.send({ type: 'RESPOND_RAISE', response: 'accept' })).type).toBe(
                'ACK',
              );
            } else if (match.phase.type === 'ELEVEN_DECISION' && match.phase.team === team) {
              expect((await human.send({ type: 'DECIDE_ELEVEN', response: 'play' })).type).toBe(
                'ACK',
              );
            }
          }
        }
        expect(r.host.view.outcome?.reason).toBe('completed');
        expect([...botPlays].sort()).toEqual(
          Array.from({ length: 4 - count }, (_, index) => index + count),
        );
        expect(r.records).toHaveLength(1);
        expect(r.records[0]).toMatchObject({
          solo: false,
          format: '2v2',
          preset,
          reason: 'completed',
        });
        expect(r.records[0]?.participants.map((participant) => participant.accountId)).toEqual([
          ...r.identities.map((identity) => identity.accountId),
          ...Array.from({ length: 4 - count }, () => null),
        ]);
        await r.host.send({ type: 'REMATCH' });
        expect(r.host.view.status).toBe('lobby');
        expect(
          r.host.view.seats.filter((member) => member?.bot).every((member) => member?.ready),
        ).toBe(true);
        expect(
          r.host.view.seats
            .filter((member) => member && !member.bot)
            .every((member) => !member?.ready),
        ).toBe(true);
        for (const human of r.humans) await human.send({ type: 'READY', ready: true });
        expect((await r.host.send({ type: 'START_MATCH' })).type).toBe('ACK');
        await r.advance(time + 900);
        const revision = r.host.view.match?.revision;
        for (const human of r.humans) await human.disconnect();
        await r.advance(time + 1900);
        await r.host.connect(r.code);
        expect(r.host.view.match?.revision).toBe(revision);
        await r.host.disconnect();
        await r.advance(time + 62000);
        await expect(r.host.connect(r.code)).rejects.toThrow('ROOM_NOT_FOUND');
      } finally {
        r.service.close();
      }
    });
  }
}
