type IconName = 'players' | 'swords' | 'cards' | 'key' | 'lock' | 'clock' | 'back' | 'play' | 'eye';

const paths: Record<IconName, string> = {
  players:
    'M9 2h6v2h2v6h-2v2H9v-2H7V4h2zM3 6h3v6H3zM18 6h3v6h-3zM7 14h10v2h2v6H5v-6h2zM1 14h3v8H1zM20 14h3v8h-3z',
  swords:
    'M2 1h4l12 12-3 3L3 4zM18 1h4v3L10 16l-3-3zM13 17l4-4 2 2 2-2 2 2-8 8-2-2 2-2zM1 15l2-2 2 2 2-2 4 4-2 2 2 2-2 2z',
  cards: 'M3 3h12v2H5v15H3zM8 1h12v2h2v18h-2v2H8v-2H6V3h2zM10 5v14h8V5z',
  key: 'M14 1h6v2h2v8h-2v2h-6l-3 3v3H8v3H2v-6l10-9V3h2zM16 5v4h3V5z',
  lock: 'M7 1h10v2h2v7h3v13H2V10h3V3h2zM9 5v5h6V5zM10 14v5h4v-5z',
  clock:
    'M7 1h10v2h4v4h2v10h-2v4h-4v2H7v-2H3v-4H1V7h2V3h4zM5 7v10h2v2h10v-2h2V7h-2V5H7v2zM10 6h3v6h4v3h-7z',
  back: 'M10 3v5h12v8H10v5L0 12z',
  play: 'M3 1h4v2h4v2h4v2h4v2h3v6h-3v2h-4v2h-4v2H7v2H3z',
  eye: 'M7 4h10v2h4v3h3v6h-3v3h-4v2H7v-2H3v-3H0V9h3V6h4zM8 8v8h8V8zM10 10h4v4h-4z',
};

export function LobbyIcon({ name }: { name: IconName }) {
  return (
    <svg className="lobby-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
