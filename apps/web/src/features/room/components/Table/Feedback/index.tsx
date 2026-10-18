import type { RoomView } from '@truco/game-protocol';
import { nextTurnLabel, resolutionFeedback } from './explanation';

export function TableFeedback({ room }: { room: RoomView }) {
  const feedback = resolutionFeedback(room);
  if (feedback)
    return (
      <div
        className="resolution-feedback"
        key={room.transition?.id}
        role="status"
        aria-live="polite"
      >
        <strong>{feedback.title}</strong>
        <span>{feedback.detail}</span>
      </div>
    );

  if (
    room.paused ||
    room.status !== 'playing' ||
    room.match?.phase.type !== 'TURN' ||
    room.match.hand.plays.length > 0 ||
    room.match.hand.completedTricks.length === 0
  )
    return null;

  return (
    <p className="turn-explanation" key={room.decisionId} role="status">
      {nextTurnLabel(room)}
    </p>
  );
}
