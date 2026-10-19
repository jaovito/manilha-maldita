import { t } from '../../../../../shared/i18n';
import type { Card } from '../../../utils/cards';

const symbols = { diamonds: '♦', spades: '♠', hearts: '♥', clubs: '♣' };

export function CardFace({ card }: { card: Card }) {
  const symbol = symbols[card.suit];

  return (
    <span
      className={`card-face ${card.suit === 'diamonds' || card.suit === 'hearts' ? 'card-red' : 'card-black'}`}
    >
      <span className="card-artwork">
        <span className="card-corner" aria-hidden="true">
          <span className="card-rank" data-rank={card.rank}>
            {card.rank}
          </span>
          <span>{symbol}</span>
        </span>
        <span className="card-suit" aria-hidden="true">
          {symbol}
        </span>
        <span className="card-corner card-corner-bottom" aria-hidden="true">
          <span className="card-rank" data-rank={card.rank}>
            {card.rank}
          </span>
          <span>{symbol}</span>
        </span>
      </span>
    </span>
  );
}

export function CardBack({ kind }: { kind?: 'masked' | 'covered' | undefined }) {
  return (
    <span className={`card-back${kind ? ` card-back-${kind}` : ''}`} aria-hidden="true">
      {kind === 'masked' && (
        <span className="hidden-card-mark">
          <svg viewBox="0 0 64 40" focusable="false" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4 8H12V12H24L32 18L40 12H52V8H60V24H56V30H48V34H38L32 28L26 34H16V30H8V24H4ZM12 18V24H18V26H24V20H20V18ZM40 20V26H46V24H52V18H44V20Z"
            />
          </svg>
          <span>{t('MÁSCARA')}</span>
          <span>{t('Vale força')}</span>
        </span>
      )}
    </span>
  );
}
