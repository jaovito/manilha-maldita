import { loadLocale } from '../../../../../../shared/i18n';
import type { RoomView } from '@truco/game-protocol';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  confirmedAcceptance,
  confirmedRaise,
  type RaiseStake,
} from '../../../../../../shared/feedback/raises';
import { raiseMessages } from '../../../../../../shared/i18n/raises';

export function RaiseAnnouncement({ room }: { room: RoomView }) {
  const text = raiseMessages[loadLocale()];
  const previous = useRef(room);
  const [notice, setNotice] = useState<{
    key: string;
    stake: RaiseStake;
    accepted: boolean;
    hand: number | undefined;
  } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = room;
    const accepted = confirmedAcceptance(before, room);
    const stake = accepted ?? confirmedRaise(before, room);
    if (stake) {
      setNotice({
        key: `${room.matchId}:${room.match?.hand.number}:${room.decisionId}:${stake}`,
        stake,
        accepted: accepted !== null,
        hand: room.match?.hand.number,
      });
    } else if (
      room.paused ||
      room.status !== 'playing' ||
      (room.match?.phase.type !== 'RAISE_RESPONSE' && room.match?.phase.type !== 'TURN') ||
      before.match?.hand.number !== room.match?.hand.number ||
      before.matchId !== room.matchId ||
      room.sequence > before.sequence + 1
    ) {
      setNotice(null);
    }
  }, [room]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice((current) => (current?.key === notice.key ? null : current));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (
    !notice ||
    room.paused ||
    room.status !== 'playing' ||
    room.match?.hand.number !== notice.hand ||
    (notice.accepted
      ? room.match?.phase.type !== 'TURN' || room.match.hand.betting.acceptedStake !== notice.stake
      : room.match?.phase.type !== 'RAISE_RESPONSE' ||
        room.match.hand.betting.pendingStake !== notice.stake)
  )
    return null;

  const shout = notice.accepted ? text.accepted : text.shouts[notice.stake];

  return (
    <div
      className="raise-announcement"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-stake={notice.stake}
      data-accepted={notice.accepted}
      key={notice.key}
    >
      <div className="raise-impact" aria-hidden="true" />
      <strong className="raise-shout" role="img" aria-label={shout}>
        {Array.from(shout).map((letter, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Immutable letters inside a keyed announcement.
          <span key={index} aria-hidden="true" style={{ '--letter': index } as CSSProperties}>
            {letter}
          </span>
        ))}
      </strong>
      <span className="raise-caption">
        {notice.stake} {notice.accepted ? text.acceptedPoints : text.points}
      </span>
    </div>
  );
}
