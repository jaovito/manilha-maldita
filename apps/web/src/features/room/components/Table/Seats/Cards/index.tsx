import { useState } from 'react';
import { SpyCardPreview } from './Preview';
import { t } from '../../../../../../shared/i18n';
import type { MatchView } from '@truco/game-protocol';
import { cardLabel } from '../../../../utils/cards';
import { CardBack, CardFace } from '../../Card';

type Intel = NonNullable<NonNullable<MatchView['powers']>['intel']>;

function Observation({ intel }: { intel: Intel }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        className="mini-card spy-observation"
        aria-label={t('Ampliar carta revelada: {0}', [cardLabel(intel.card)])}
        aria-haspopup="dialog"
        onClick={() => setExpanded(true)}
        title={t('Ampliar carta revelada: {0}', [cardLabel(intel.card)])}
      >
        <span
          className="spy-observation-face"
          role="img"
          aria-label={t('Espião · Só você: {0}. Vista na preparação.', [cardLabel(intel.card)])}
        >
          <CardFace card={intel.card} />
        </span>
        <i aria-hidden="true">{t('VISTO')} </i>
      </button>
      {expanded && <SpyCardPreview card={intel.card} onClose={() => setExpanded(false)} />}
    </>
  );
}

export function SeatCards({
  hand,
  name,
  spying,
  spy,
  intel,
  position,
  hasOpaquePlay,
}: {
  hand: MatchView['hand']['hands'][number];
  name: string;
  spying: boolean;
  spy: (index: number) => void;
  intel: Intel | null;
  position: number;
  hasOpaquePlay: boolean;
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
              {intel && !hasOpaquePlay && index === Math.min(position, hand.count - 1) ? (
                <Observation
                  key={`${intel.target}:${intel.card.rank}:${intel.card.suit}`}
                  intel={intel}
                />
              ) : (
                <CardBack />
              )}
            </span>
          ))}
      {intel && hasOpaquePlay && (
        <span
          className="spy-memory"
          role="note"
          aria-label={t('Memória do Espião: {0}. Pode já ter sido jogada.', [
            cardLabel(intel.card),
          ])}
          title={t('Memória do Espião: {0}. Pode já ter sido jogada.', [cardLabel(intel.card)])}
        >
          {t('Visto: {0}', [cardLabel(intel.card)])}
        </span>
      )}
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
