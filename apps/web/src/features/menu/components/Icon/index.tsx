type IconName = 'cards' | 'house' | 'players' | 'book' | 'hat' | 'gear';

export function MenuIcon({ name }: { name: IconName }) {
  return <span className={`menu-icon icon-${name}`} aria-hidden="true" />;
}
