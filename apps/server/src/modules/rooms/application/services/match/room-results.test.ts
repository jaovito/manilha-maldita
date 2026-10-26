import { expect, spyOn, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { appearanceFor, type MatchRecord } from '../../../../progression';
import { fixture, start } from '../../room-application.test';
import type { ResultWriter } from '../../ports/result-writer';

test('match start freezes eligible accounts and appearance; results are captured once across rematch and shutdown', async () => {
  const records: MatchRecord[] = [];
  const reservations: string[] = [];
  const writer: ResultWriter = {
    policyVersion: 'fixture-v1',
    reserve(id) {
      reservations.push(id);
    },
    release() {},
    write(record) {
      records.push(record);
    },
  };
  const f = fixture({}, writer);
  const identity = {
    accountId: crypto.randomUUID(),
    appearance: appearanceFor('avatar-2', 'ember', 'burgundy'),
  };
  const updated = { ...identity, appearance: appearanceFor('avatar-4', 'arcane', 'midnight') };

  try {
    const room = await f.room(defaultRoomConfig, [identity]);
    expect(room.peers[1]?.view.seats[0]?.appearance?.deck.id).toBe('ember');
    await f.service.updateIdentity(room.host.session, {
      ...identity,
      accountId: crypto.randomUUID(),
    });
    expect(room.host.view.seats[0]?.appearance?.deck.id).toBe('ember');
    await start(room);
    expect(reservations).toHaveLength(1);
    await f.service.updateIdentity(room.host.session, updated, 'Updated');
    await room.host.send({ type: 'SYNC' });
    expect(room.host.view.seats[0]?.appearance?.deck.id).toBe('ember');
    expect(room.host.view.tableTheme?.id).toBe('burgundy');
    expect(room.peers[1]?.view.tableTheme).toBeUndefined();
    const surrender = room.host.message({ type: 'SURRENDER' });
    await room.host.raw(surrender);
    await room.host.raw(surrender);
    expect(records).toHaveLength(1);
    expect(room.host.view.rewardEligibility).toBe('eligible');
    expect(room.peers[1]?.view.rewardEligibility).toBe('guest');
    expect(records[0]).toMatchObject({
      reason: 'surrender',
      rewardPolicyVersion: 'fixture-v1',
      participants: [
        { seat: 0, accountId: identity.accountId },
        { seat: 1, accountId: null },
      ],
    });
    const json = JSON.stringify(records[0]);
    expect(json).not.toMatch(/cards|stock|password|token|sessionId|appearance/);
    await room.host.send({ type: 'REMATCH' });
    expect(room.host.view.seats[0]?.appearance?.deck.id).toBe('arcane');
    await f.service.updateIdentity(room.host.session, identity, 'Renamed');
    expect(room.host.view.seats[0]?.nickname).toBe('Renamed');
    await start(room);
    f.service.close();
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({ reason: 'technical', winner: null });
  } finally {
    f.service.close();
  }
});

test('outbox saturation rejects start before gameplay entropy or resources are consumed', async () => {
  let blocked = true;
  let released = 0;
  const f = fixture(
    {},
    {
      policyVersion: 'v1',
      reserve() {
        if (blocked) throw new Error('PERSISTENCE_UNAVAILABLE');
      },
      release() {
        released++;
      },
      write() {},
    },
  );
  const random = spyOn(f.ports, 'randomInt');

  try {
    const room = await f.room();
    for (const peer of room.peers) await peer.send({ type: 'READY', ready: true });
    const calls = random.mock.calls.length;
    expect(await room.host.send({ type: 'START_MATCH' })).toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    });
    expect(random.mock.calls.length).toBe(calls);
    expect(room.host.view.match).toBeNull();
    expect(room.host.view.status).toBe('lobby');
    blocked = false;
    random.mockImplementationOnce(() => {
      throw new Error('entropy failed');
    });
    expect(await room.host.send({ type: 'START_MATCH' })).toMatchObject({ type: 'ERROR' });
    expect(released).toBe(1);
    expect(room.host.view.match).toBeNull();
    expect((await room.host.send({ type: 'START_MATCH' })).type).toBe('ACK');
  } finally {
    random.mockRestore();
    f.service.close();
  }
});

test('an unrelated saturated room cannot block an account profile update', async () => {
  const f = fixture();
  const identity = { accountId: crypto.randomUUID(), appearance: appearanceFor(null, null, null) };
  const { code } = await f.service.create('unrelated', 'Other Player', defaultRoomConfig);
  const room = await f.room(defaultRoomConfig, [identity]);
  const queued = Array.from({ length: 64 }, () =>
    f.service.connect(code, 'unrelated', { send() {}, close() {} }),
  );

  try {
    await f.service.updateIdentity(
      room.host.session,
      { ...identity, appearance: appearanceFor('avatar-2', 'ember', 'burgundy') },
      'Updated Player',
    );
    expect(room.host.view.seats[0]).toMatchObject({
      nickname: 'Updated Player',
      appearance: { deck: { id: 'ember' } },
    });
  } finally {
    await Promise.allSettled(queued);
    f.service.close();
  }
});

test('finished solo snapshots expose only the viewer reward eligibility after development edits', async () => {
  const f = fixture(
    { soloEnabled: true, devTools: true },
    {
      policyVersion: 'test-rewards',
      reserve() {},
      release() {},
      write() {},
    },
  );
  const identity = { accountId: crypto.randomUUID(), appearance: appearanceFor(null, null, null) };
  const human = f.peer('reward-player');
  try {
    const { code } = await f.service.create(
      human.session,
      'Player',
      defaultRoomConfig,
      true,
      identity,
    );
    await human.connect(code);
    expect(human.view.rewardEligibility).toBeUndefined();
    await human.send({ type: 'DEV_RESET_HAND' });
    await human.send({ type: 'SURRENDER' });
    expect(human.view.rewardEligibility).toBe('development');
    expect(JSON.stringify(human.view)).not.toContain(identity.accountId);
    await human.send({ type: 'REMATCH' });
    await human.send({ type: 'SURRENDER' });
    expect(human.view.rewardEligibility).toBe('eligible');
  } finally {
    f.service.close();
  }
});
