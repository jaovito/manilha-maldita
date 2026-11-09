import { expect, test } from 'bun:test';
import { defaultRoomConfig, type RoomView, type MatchView } from '@truco/game-protocol';
import { controlledClock } from './controlled-clock';
import { assertPrivacy, Player, setup } from './multiplayer-fixture';

for (const preset of ['casual', 'competitive'] as const) {
  test(`${preset}: three real clients complete 2v2 with a bot, reconnect and rematch`, async () => {
    const clock = controlledClock();
    const game = await setup(
      3,
      { ...defaultRoomConfig, preset },
      { soloEnabled: true, ports: clock.ports },
      clock.advance,
    );
    try {
      expect(await game.act(1, { type: 'FILL_BOTS' })).toMatchObject({ code: 'NOT_HOST' });
      expect(await game.act(0, { type: 'FILL_BOTS' })).toMatchObject({ type: 'ACK' });
      for (const human of game.players)
        expect(human.view?.seats[3]).toMatchObject({ bot: true, ready: true, connected: true });
      await game.begin(false);
      const previous = game.players[2];
      const resumeCookie = game.cookies[2];
      if (!previous || !resumeCookie) throw new Error('NO_RECONNECTING_PLAYER');
      const previousView = previous.view;
      if (!previousView) throw new Error('NO_PREVIOUS_VIEW');
      const previousMatch = previousView.matchId;
      const previousHand = previous.view?.match?.hand.hands[2];
      previous.socket.close();
      const resumed = new Player(resumeCookie, game.code, game.runtime.server.url);
      const restored = await resumed.wait();
      game.players[2] = resumed;
      await game.all(restored.sequence);
      expect(restored.selfSeat).toBe(2);
      expect(restored.matchId).toBe(previousMatch);
      expect(restored.match?.hand.hands[2]).toEqual(previousHand);
      assertPrivacy(game.players);
      let botPlayed = false;
      const owner = game.players[0];
      if (!owner) throw new Error('NO_OWNER');
      for (let step = 0; step < 300 && owner.view?.status !== 'finished'; step++) {
        await game.settle();
        const view: RoomView | undefined = owner.view;
        const match: MatchView | null | undefined = view?.match;
        if (!view || !match) throw new Error('NO_MATCH');
        if (view.status === 'finished') break;
        for (const human of game.players) {
          const projected = human.view?.match;
          const ownSeat = human.view?.selfSeat;
          if (!projected || ownSeat === undefined) throw new Error('NO_VIEW');
          for (const hand of projected.hand.hands) {
            if (
              hand.seat === ownSeat ||
              (projected.hand.kind === 'eleven' &&
                projected.hand.elevenTeam === (ownSeat % 2 === 0 ? 'A' : 'B') &&
                hand.seat % 2 === ownSeat % 2)
            )
              continue;
            expect(hand.visibility).toBe('hidden');
          }
        }
        botPlayed ||= [
          ...match.hand.plays,
          ...match.hand.completedTricks.flatMap((trick) => trick.plays),
        ].some((play) => play.seat === 3);
        if (match.phase.type === 'PREPARATION') {
          for (const [seat, human] of game.players.entries()) {
            if (!human.view?.match?.powers?.players[seat]?.ready)
              expect(
                await game.act(seat, { type: 'PREPARE', intent: { type: 'pass' } }),
              ).toMatchObject({ type: 'ACK' });
          }
        } else if (match.phase.type === 'TURN' && match.phase.seat !== 3) {
          const seat = match.phase.seat;
          const team = seat % 2 === 0 ? 'A' : 'B';
          const own = game.players[seat]?.view?.match?.hand.hands[seat];
          if (
            match.hand.kind === 'normal' &&
            match.hand.betting.acceptedStake < 12 &&
            match.hand.betting.lastRaisingTeam !== team
          ) {
            expect(await game.act(seat, { type: 'REQUEST_RAISE' })).toMatchObject({ type: 'ACK' });
          } else {
            if (own?.visibility !== 'visible' || !own.cards[0]) throw new Error('NO_CARD');
            expect(
              await game.act(seat, { type: 'PLAY_CARD', card: own.cards[0], covered: false }),
            ).toMatchObject({ type: 'ACK' });
          }
          continue;
        } else if (match.phase.type === 'RAISE_RESPONSE') {
          const seat = match.hand.betting.lastRaisingTeam === 'A' ? 1 : 0;
          expect(
            await game.act(seat, {
              type: 'RESPOND_RAISE',
              response: match.hand.betting.pendingStake === 12 ? 'accept' : 'raise',
            }),
          ).toMatchObject({ type: 'ACK' });
          continue;
        } else if (match.phase.type === 'ELEVEN_DECISION') {
          expect(
            await game.act(match.phase.team === 'A' ? 0 : 1, {
              type: 'DECIDE_ELEVEN',
              response: 'play',
            }),
          ).toMatchObject({ type: 'ACK' });
          continue;
        }

        // Await the actual bot broadcast instead of spending the owner's WS budget on SYNC polls.
        const sequence = owner.view?.sequence ?? -1;
        const changed = owner.wait((current) => current.sequence > sequence);
        await clock.advance(clock.ports.now() + 1000);
        const updated = await changed;
        await game.all(updated.sequence);
      }
      expect(owner.view?.outcome?.reason).toBe('completed');
      expect(botPlayed).toBe(true);
      expect(await game.act(0, { type: 'REMATCH' })).toMatchObject({ type: 'ACK' });
      expect(owner.view?.status).toBe('lobby');
      expect(owner.view?.seats[3]).toMatchObject({ bot: true, ready: true });
      expect(owner.view?.seats.slice(0, 3).every((member) => !member?.ready)).toBe(true);
      expect(await game.act(0, { type: 'START_MATCH' })).toMatchObject({ code: 'NOT_READY' });
      await game.begin(false);
      expect(owner.view?.match?.playerCount).toBe(4);
      expect(await game.act(0, { type: 'CLEAR_BOTS' })).toMatchObject({ code: 'INVALID_PHASE' });
    } finally {
      await game.stop();
    }
  }, 15000);
}
