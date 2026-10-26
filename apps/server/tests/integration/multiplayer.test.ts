import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { assertPrivacy, completeMatch, ownCard, Player, setup } from './multiplayer-fixture';

test('1v1 real multiplayer protects authority, idempotence, reconnect and rematch contexts', async () => {
  const game = await setup(2);
  try {
    const originalSeats = game.players.map((player) => player.view?.seats);

    expect(await game.act(1, { type: 'SET_SEAT', seat: 0 })).toMatchObject({
      type: 'ERROR',
      code: 'SEAT_TAKEN',
    });
    expect(game.players.map((player) => player.view?.seats)).toEqual(originalSeats);

    expect(await game.act(1, { type: 'CONFIGURE', config: defaultRoomConfig })).toMatchObject({
      type: 'ERROR',
      code: 'NOT_HOST',
    });
    expect(await game.act(0, { type: 'START_MATCH' })).toMatchObject({
      type: 'ERROR',
      code: 'NOT_READY',
    });
    await game.begin();
    assertPrivacy(game.players);
    const match = game.players[0]?.view?.match;
    if (match?.phase.type !== 'TURN') throw new Error('No turn');
    const seat = match.phase.seat;
    const player = game.players[seat];
    const other = game.players[(seat + 1) % 2];
    if (!player || !other) throw new Error('No player');
    expect(
      await game.act((seat + 1) % 2, { type: 'PLAY_CARD', card: ownCard(other), covered: false }),
    ).toMatchObject({ type: 'ERROR', code: 'NOT_YOUR_TURN' });
    const original = player.envelope({ type: 'PLAY_CARD', card: ownCard(player), covered: false });
    const ack = await player.send(original);
    expect(ack.type).toBe('ACK');
    if (ack.type !== 'ACK') throw new Error('Rejected legal move');
    await game.all(ack.sequence);
    expect(await player.send(original)).toEqual(ack);
    expect(await player.send({ ...original, action: { type: 'REQUEST_RAISE' } })).toMatchObject({
      type: 'ERROR',
      code: 'COMMAND_ID_REUSED',
    });
    const expectedView = player.view;
    const oldClosed = new Promise<number>((resolve) =>
      player.socket.addEventListener('close', (event) => resolve(event.code)),
    );
    const replacement = new Player(player.cookie, game.code, game.runtime.server.url);
    await replacement.wait();
    game.players[seat] = replacement;
    expect(await oldClosed).toBe(1000);
    expect(replacement.view?.match).toEqual(expectedView?.match);
    expect(await replacement.send(original)).toEqual(ack);
    assertPrivacy(game.players);
    await completeMatch(game);
    const oldContext = replacement.envelope({ type: 'SURRENDER' });
    const matchId = replacement.view?.matchId;
    expect((await game.act(0, { type: 'REMATCH' })).type).toBe('ACK');
    await game.begin();
    expect(replacement.view?.matchId).not.toBe(matchId);
    expect(await replacement.send(oldContext)).toMatchObject({
      type: 'ERROR',
      code: 'STALE_CONTEXT',
    });
  } finally {
    await game.stop();
  }
}, 60000);

test('2v2 real clients serialize competing partner responses and finish a complete match', async () => {
  const game = await setup(4);
  try {
    await game.begin();
    assertPrivacy(game.players);
    const match = game.players[0]?.view?.match;
    if (match?.phase.type !== 'TURN') throw new Error('No turn');
    const seat = match.phase.seat;
    expect((await game.act(seat, { type: 'REQUEST_RAISE' })).type).toBe('ACK');
    const respondents = game.players.filter(
      (player) => player.view && player.view.selfSeat % 2 !== seat % 2,
    );
    const first = respondents[0],
      second = respondents[1];
    if (!first || !second) throw new Error('Missing team');
    const replies = await Promise.all([
      first.act({ type: 'RESPOND_RAISE', response: 'accept' }),
      second.act({ type: 'RESPOND_RAISE', response: 'fold' }),
    ]);
    expect(replies.filter((reply) => reply.type === 'ACK')).toHaveLength(1);
    expect(replies.filter((reply) => reply.type === 'ERROR')).toHaveLength(1);
    const accepted = replies.find((reply) => reply.type === 'ACK');
    if (accepted?.type === 'ACK') await game.all(accepted.sequence);
    // A fold preserves HAND_END during the result pause; acceptance resumes the saved turn.
    await game.settle();
    const view = game.players[0]?.view;
    if (view?.match?.hand.number === 1) expect(view.match.hand.betting.acceptedStake).toBe(3);
    await completeMatch(game);
  } finally {
    await game.stop();
  }
}, 60000);

test('leaving a real lobby acknowledges removal before closing the socket', async () => {
  const game = await setup(2);
  try {
    const guest = game.players[1],
      host = game.players[0];
    if (!guest || !host) throw new Error('Missing players');
    const closed = new Promise<{ code: number; reason: string }>((resolve) =>
      guest.socket.addEventListener('close', (event) =>
        resolve({ code: event.code, reason: event.reason }),
      ),
    );
    const reply = await guest.act({ type: 'LEAVE' });
    expect(reply.type).toBe('ACK');
    if (reply.type === 'ACK') await host.wait((view) => view.sequence >= reply.sequence);
    expect(host.view?.seats[1]).toBeNull();
    expect(await closed).toEqual({ code: 1000, reason: 'LEFT_ROOM' });
    const hostClosed = new Promise<number>((resolve) =>
      host.socket.addEventListener('close', (event) => resolve(event.code)),
    );
    expect((await host.act({ type: 'LEAVE' })).type).toBe('ACK');
    expect(await hostClosed).toBe(1000);
  } finally {
    await game.stop();
  }
});

test('real clients observe deal, trick and hand pauses with reconnect and server-owned deadlines', async () => {
  const game = await setup(2);
  try {
    for (let seat = 0; seat < 2; seat++) await game.act(seat, { type: 'READY', ready: true });
    await game.act(0, { type: 'START_MATCH' });
    const host = game.players[0];
    if (!host) throw new Error('Missing host');
    const deal = host.view?.transition;
    expect(deal?.kind).toBe('deal');
    expect(host.view?.deadline).toBeNull();
    expect(await game.act(0, { type: 'PREPARE', intent: { type: 'pass' } })).toMatchObject({
      code: 'DECISION_PAUSED',
    });

    const replacement = new Player(host.cookie, game.code, game.runtime.server.url);
    await replacement.wait();
    game.players[0] = replacement;
    expect(replacement.view?.transition).toEqual(deal);
    await game.settle();
    expect(replacement.view?.decisionId).not.toBeNull();
    await game.prepare();

    for (let play = 0; play < 2; play++) {
      const phase = game.players[0]?.view?.match?.phase;
      if (phase?.type !== 'TURN') throw new Error('Missing turn');
      const player = game.players[phase.seat];
      if (!player) throw new Error('Missing player');
      expect(
        (await game.act(phase.seat, { type: 'PLAY_CARD', card: ownCard(player), covered: false }))
          .type,
      ).toBe('ACK');
    }
    expect(replacement.view?.transition?.kind).toBe('trick');
    expect(replacement.view?.match?.hand.completedTricks).toHaveLength(1);
    expect(replacement.view?.decisionId).toBeNull();
    await game.settle();

    const phase = replacement.view?.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('Missing turn');
    await game.act(phase.seat, { type: 'REQUEST_RAISE' });
    await game.act((phase.seat + 1) % 2, { type: 'RESPOND_RAISE', response: 'fold' });
    expect(replacement.view?.transition?.kind).toBe('hand');
    expect(replacement.view?.match?.phase.type).toBe('HAND_END');
    expect(replacement.view?.match?.hand.number).toBe(1);
    assertPrivacy(game.players);
    const score = replacement.view?.match?.score;
    await game.settle();
    expect(replacement.view?.match?.hand.number).toBe(2);
    expect(replacement.view?.match?.score).toEqual(score);
    expect(replacement.view?.decisionId).not.toBeNull();
  } finally {
    await game.stop();
  }
}, 15000);
