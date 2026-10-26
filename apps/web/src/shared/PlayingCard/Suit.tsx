type SuitName = 'diamonds' | 'hearts' | 'spades' | 'clubs';
const paths: Record<SuitName, string> = {
  diamonds: 'M24 2 43 24 24 46 5 24Z',
  hearts: 'M24 43 5 25 3 14 10 5 19 5 24 11 29 5 38 5 45 14 43 25Z',
  spades: 'M24 3 43 22 44 31 38 36 29 34 33 44 15 44 19 34 10 36 4 31 5 22Z',
  clubs:
    'M18 23 13 16 16 6 24 3 32 6 35 16 30 23 38 19 45 26 44 34 36 38 28 34 33 44 15 44 20 34 12 38 4 34 3 26 10 19Z',
};

export function Suit({ suit, ornate }: { suit: SuitName; ornate: boolean }) {
  return (
    <svg viewBox="0 0 48 48" focusable="false" aria-hidden="true" className="themed-suit">
      <path d={paths[suit]} fill="currentColor" />
      {ornate && (
        <path
          d="M24 14 29 24 24 34 19 24Z"
          fill="none"
          stroke="var(--card-paper, #ffedc2)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
