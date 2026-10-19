import { t } from '../../../../../shared/i18n';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { SeatCards } from './Cards';

export function TableSeats({
  room,
  match,
  spying,
  spy,
  spyPosition,
}: {
  room: RoomView;
  match: MatchView;
  spying: boolean;
  spy: (seat: number, index: number) => void;
  spyPosition: { seat: number; index: number } | null;
}) {
  return (
    <div className="opponents">
      {match.hand.hands
        .filter((hand) => hand.seat !== room.selfSeat)
        .map((hand) => {
          const relative = (hand.seat - room.selfSeat + match.playerCount) % match.playerCount;
          const member = room.seats[hand.seat];
          const active =
            !room.transition &&
            !room.paused &&
            room.status === 'playing' &&
            match.phase.type === 'TURN' &&
            match.phase.seat === hand.seat;
          const teammate = hand.seat % 2 === room.selfSeat % 2;

          const intel = match.powers?.intel?.target === hand.seat ? match.powers.intel : null;
          const plays = [
            ...match.hand.plays,
            ...match.hand.completedTricks.flatMap((trick) => trick.plays),
          ];
          const played = plays.some((play) => play.seat === hand.seat);
          // Only compare faces already authorized by the server, never opaque plays.
          const observedPlayed =
            intel !== null &&
            plays.some(
              (play) =>
                play.seat === hand.seat &&
                'card' in play &&
                play.card.rank === intel.card.rank &&
                play.card.suit === intel.card.suit,
            );

          return (
            <section
              key={hand.seat}
              className={`player-seat seat-relative-${relative}${active ? ' seat-active' : ''}`}
              data-spy-target={spying && !teammate}
              aria-label={`${member?.nickname ?? t('Jogador')}${teammate ? t(', sua dupla') : t(', adversário')}`}
            >
              <SeatCards
                hand={hand}
                name={member?.nickname ?? t('Jogador')}
                spying={spying && !teammate}
                spy={(index) => spy(hand.seat, index)}
                intel={observedPlayed || hand.count === 0 ? null : intel}
                position={spyPosition?.seat === hand.seat ? spyPosition.index : 0}
                played={played}
              />
              <span className={`seat-avatar avatar-${hand.seat}`} aria-hidden="true" />
              <div className="seat-info">
                <strong className="seat-name">{member?.nickname ?? t('Jogador')}</strong>
                <span className="seat-team">
                  {teammate ? t('Sua dupla') : t('Adversário')} ·{' '}
                  {member?.connected ? t('Conectado') : t('Reconectando')}
                </span>
              </div>
            </section>
          );
        })}
    </div>
  );
}
