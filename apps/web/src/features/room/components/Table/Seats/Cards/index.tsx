import { t } from '../../../../../../shared/i18n';
import type { MatchView } from '@truco/game-protocol';
import { cardLabel } from '../../../../utils/cards';
import { CardBack, CardFace } from '../../Card';

type Intel = NonNullable<NonNullable<MatchView['powers']>['intel']>;

function Observation({ intel, memory }: { intel: Intel; memory: boolean }) {
  return (
    <span
      className={`mini-card spy-observation${memory ? ' spy-memory' : ''}`}
      role="img"
      aria-label={t('Espião · Só você: {0}. Vista na preparação.', [cardLabel(intel.card)])}
      title={t('Vista na preparação; pode já ter sido jogada.')}
    >
      <CardFace card={intel.card} />
      <i aria-hidden="true">{t('VISTO')} </i>
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
    <section className="seat-cards" aria-label={t('{0} cartas na mão', [hand.count])}>
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
              aria-label={t('Espionar carta {0} de {1}', [index + 1, name])}
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
