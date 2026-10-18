import { expect, test } from 'bun:test';
import { defaultRoomConfig, type Action } from '@truco/game-protocol';
import { setup, Player, ownCard, completeMatch } from './multiplayer-fixture';

for (const preset of ['casual', 'competitive'] as const)
  test(`${preset}: real clients seal preparations, resolve powers privately and complete a match`, async () => {
    const game = await setup(4, { ...defaultRoomConfig, preset });
    try {
      await game.begin(false);
      const players = game.players;
      assertVisiblePowers(players);
      const original = players[0];
      if (!original) throw new Error('NO_PLAYER');
      const replaced = new Promise((resolve) => original.socket.addEventListener('close', resolve));
      const resumed = new Player(original.cookie, game.code, game.runtime.server.url);
      await resumed.wait();
      await replaced;
      players[0] = resumed;
      assertVisiblePowers(players);
      const envelopes = players.map((player) => {
        const view = player.view;
        const power = view?.match?.powers?.players[view.selfSeat]?.power;
        const action: Action =
          power === 'spy'
            ? {
                type: 'PREPARE',
                intent: { type: 'spy', target: (view?.selfSeat ?? 0) % 2 === 0 ? 1 : 0 },
              }
            : power === 'exchange'
              ? { type: 'PREPARE', intent: { type: 'exchange', card: ownCard(player) } }
              : { type: 'PREPARE', intent: { type: 'pass' } };
        return player.envelope(action);
      });
      const first = players[0],
        message = envelopes[0];
      if (!first || !message) throw new Error('NO_PLAYER');
      const old = first.view;
      const ack = await first.send(message);
      expect(ack.type).toBe('ACK');
      if (ack.type !== 'ACK') throw new Error('REJECTED');
      await game.all(ack.sequence);
      expect(first.view?.decisionId).toBe(old?.decisionId);
      for (const player of players) {
        expect(player.view?.match?.powers?.activations).toEqual([]);
        expect(player.view?.match?.powers?.players.map((p) => p.energy)).toEqual([2, 2, 2, 2]);
        expect(player.view?.match?.powers?.intel).toBeNull();
        expect(JSON.stringify(player.view)).not.toContain('commitments');
      }
      assertVisiblePowers(players);
      // Every envelope was made at the initial revision, before other commitments arrived.
      for (let seat = 1; seat < players.length; seat++) {
        const player = players[seat],
          envelope = envelopes[seat];
        if (!player || !envelope) throw new Error('NO_PLAYER');
        const reply = await player.send(envelope);
        expect(reply.type).toBe('ACK');
        if (reply.type === 'ACK') await game.all(reply.sequence);
      }
      for (const player of players) {
        const view = player.view;
        const power = view?.match?.powers?.players[view.selfSeat];
        expect(view?.match?.phase.type).toBe('TURN');
        if (power?.power === 'spy') {
          expect(view?.match?.powers?.intel).not.toBeNull();
          expect(power.energy).toBe(1);
        } else expect(view?.match?.powers?.intel).toBeNull();
        if (power?.power === 'exchange') expect(power.energy).toBe(0);
        expect(
          view?.match?.hand.hands.filter((hand) => hand.visibility === 'visible'),
        ).toHaveLength(1);
      }
      assertVisiblePowers(players);
      const closed = new Promise((resolve) => first.socket.addEventListener('close', resolve));
      const replacement = new Player(first.cookie, game.code, game.runtime.server.url);
      await replacement.wait();
      await closed;
      players[0] = replacement;
      assertVisiblePowers(players);
      expect(replacement.view?.match).toEqual(first.view?.match);
      expect(await replacement.send(message)).toEqual(ack);
      await completeMatch(game);
    } finally {
      await game.stop();
    }
  }, 60000);

function assertVisiblePowers(players: readonly Player[]) {
  const assignments = players.map((player) => {
    const view = player.view;
    const own = view?.match?.powers?.players[view.selfSeat]?.power;
    if (!own) throw new Error('MISSING_OWN_POWER');
    return own;
  });

  for (const player of players) {
    const view = player.view;
    if (!view?.match?.powers) throw new Error('MISSING_POWERS');
    for (const slot of view.match.powers.players) {
      const activation = view.match.powers.activations.find((event) => event.seat === slot.seat);
      expect(slot.power).toBe(
        slot.seat === view.selfSeat
          ? (assignments[slot.seat] ?? null)
          : (activation?.power ?? null),
      );
    }
  }
}
