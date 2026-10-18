import type { MatchView, RoomView } from '@truco/game-protocol';
import { CardBack, CardFace, cardLabel } from './CardFace';

export function TableSeats({ room, match }: { room: RoomView; match: MatchView }) {
  return (
    <div className="opponents">
      {match.hand.hands
        .filter((hand) => hand.seat !== room.selfSeat)
        .map((hand) => {
          const relative = (hand.seat - room.selfSeat + match.playerCount) % match.playerCount;
          const member = room.seats[hand.seat];
          const active = match.phase.type === 'TURN' && match.phase.seat === hand.seat;
          const teammate = hand.seat % 2 === room.selfSeat % 2;

          return (
            <section
              key={hand.seat}
              className={`player-seat seat-relative-${relative}${active ? ' seat-active' : ''}`}
              aria-label={`${member?.nickname ?? 'Jogador'}${teammate ? ', sua dupla' : ', adversário'}`}
            >
              <section className="seat-cards" aria-label={`${hand.count} cartas na mão`}>
                {hand.visibility === 'visible'
                  ? hand.cards.map((card) => (
                      <span
                        className="mini-card"
                        key={`${card.rank}:${card.suit}`}
                        role="img"
                        aria-label={cardLabel(card)}
                      >
                        <CardFace card={card} />
                      </span>
                    ))
                  : Array.from({ length: hand.count }, (_, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Anonymous backs carry only a public count and never physical card identity.
                      <span className="mini-card" key={index}>
                        <CardBack />
                      </span>
                    ))}
              </section>
              <span className={`seat-avatar avatar-${hand.seat}`} aria-hidden="true" />
              <div className="seat-info">
                <strong className="seat-name">{member?.nickname ?? 'Jogador'}</strong>
                <span className="seat-team">
                  {teammate ? 'Sua dupla' : 'Adversário'} ·{' '}
                  {member?.connected ? 'Conectado' : 'Reconectando'}
                </span>
              </div>
            </section>
          );
        })}
    </div>
  );
}
