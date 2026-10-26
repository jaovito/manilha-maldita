export function Avatar({
  index = 0,
  className = 'avatar',
}: {
  index?: number | undefined;
  className?: string;
}) {
  const safe = Number.isInteger(index) && index >= 0 && index <= 3 ? index : 0;

  return (
    <span
      className={`${className} avatar-${safe} player-avatar`}
      aria-hidden="true"
      data-avatar={safe}
    />
  );
}
