import type { RoomView } from '@truco/game-protocol';
import { resultPerspective, resultTitle, roundResult } from '../results';

export function RoundAnnouncement({ room }: { room: RoomView }) {
  const result = roundResult(room);
  if (!result) return null;

  return (
    <div
      className="round-announcement"
      data-result={resultPerspective(room, result.winner)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="round-announcement-ribbon" key={result.key}>
        <span className="round-announcement-caption">{result.caption}</span>
        <strong className="round-announcement-title">{resultTitle(room, result.winner)}</strong>
      </div>
    </div>
  );
}
