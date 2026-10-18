import type { MatchView } from '@truco/game-protocol';
import { cardLabel } from '../../../../utils/cards';
import { CardBack, CardFace } from '../../Card';

type Intel = NonNullable<NonNullable<MatchView['powers']>['intel']>;

function Observation({ intel, memory }: { intel: Intel; memory: boolean }) {
  return (
    <span
      className={`mini-card spy-observation${memory ? ' spy-memory' : ''}`}
      role="img"
      aria-label={`Espião · Só você: ${cardLabel(intel.card)}. Vista na preparação.`}
      title="Vista na preparação; pode já ter sido jogada."
    >
      <CardFace card={intel.card} />
      <i aria-hidden="true">VISTO</i>
    </span>
  );
}

export function SeatCards({
  hand,
  name,
  spying,
  spy,
  intel,
  position,
  played,
}: {
  hand: MatchView['hand']['hands'][number];
  name: string;
  spying: boolean;
  spy: (index: number) => void;
  intel: Intel | null;
  position: number;
  played: boolean;
}) {
  return (
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
            // biome-ignore lint/suspicious/noArrayIndexKey: Backs are anonymous; the observed face is not a tracking identifier.
            <span className="mini-card" key={index} data-spy-placeholder={spying}>
              {intel && !played && index === position ? (
                <Observation intel={intel} memory={false} />
              ) : (
                <CardBack />
              )}
            </span>
          ))}
      {intel && played && <Observation intel={intel} memory />}
      {spying && (
        <div className="spy-targets">
          {Array.from({ length: hand.count }, (_, index) => (
            <button
              type="button"
              className="spy-target-card"
              // biome-ignore lint/suspicious/noArrayIndexKey: A click selects an anonymous back, not a physical card identity.
              key={index}
              aria-label={`Espionar carta ${index + 1} de ${name}`}
              onClick={() => spy(index)}
            >
              <CardBack />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
