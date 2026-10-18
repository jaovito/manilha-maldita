import type { Card } from '../../../utils/cards';

const symbols = { diamonds: '♦', spades: '♠', hearts: '♥', clubs: '♣' };

export function CardFace({ card }: { card: Card }) {
  const symbol = symbols[card.suit];

  return (
    <span
      className={`card-face ${card.suit === 'diamonds' || card.suit === 'hearts' ? 'card-red' : 'card-black'}`}
    >
      <span className="card-corner" aria-hidden="true">
        <span className="card-rank">{card.rank}</span>
        <span>{symbol}</span>
      </span>
      <span className="card-suit" aria-hidden="true">
        {symbol}
      </span>
      <span className="card-corner card-corner-bottom" aria-hidden="true">
        <span className="card-rank">{card.rank}</span>
        <span>{symbol}</span>
      </span>
    </span>
  );
}

export function CardBack() {
  return <span className="card-back" aria-hidden="true" />;
}
