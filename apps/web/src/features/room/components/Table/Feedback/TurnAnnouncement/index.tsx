import { t } from '../../../../../../shared/i18n';
import type { RoomView } from '@truco/game-protocol';
import { useEffect, useRef, useState } from 'react';

export function TurnAnnouncement({ room }: { room: RoomView }) {
  const match = room.match;
  const actionable =
    room.status === 'playing' &&
    !room.paused &&
    !room.transition &&
    room.matchId !== null &&
    room.decisionId !== null &&
    match?.phase.type === 'TURN' &&
    match.phase.seat === room.selfSeat;
  // A raise/resume changes decisionId without creating a new card turn.
  const context = actionable
    ? `${room.matchId}:${room.selfSeat}:${match.hand.number}:${match.hand.completedTricks.length}:${match.hand.plays.length}`
    : null;
  const announced = useRef<{ context: string; dismissed: boolean } | null>(null);
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    if (context === null) {
      if (announced.current) announced.current.dismissed = true;
      setVisible(null);
      return;
    }
    if (announced.current?.context === context && announced.current.dismissed) return;

    announced.current = { context, dismissed: false };
    setVisible(context);
    const timer = window.setTimeout(() => {
      if (announced.current?.context === context) announced.current.dismissed = true;
      setVisible((current) => (current === context ? null : current));
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [context]);

  if (context === null || visible !== context) return null;

  return (
    <div className="turn-announcement" role="status" aria-live="polite" aria-atomic="true">
      <div className="turn-announcement-ribbon" key={context}>
        <span className="turn-announcement-title">{t('SUA VEZ!')}</span>
        <span className="turn-announcement-caption">{t('A mesa é sua. Jogue uma carta.')}</span>
      </div>
    </div>
  );
}
