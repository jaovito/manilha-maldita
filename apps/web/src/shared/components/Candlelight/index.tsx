export function Candlelight({ variant }: { variant: 'menu' | 'lobby' | 'table' }) {
  return (
    <span className={`candlelight candlelight-${variant}`} aria-hidden="true">
      <span className="candlelight-plane">
        <span className="candlelight-glow" />
        <span className="candlelight-flame" />
      </span>
    </span>
  );
}
