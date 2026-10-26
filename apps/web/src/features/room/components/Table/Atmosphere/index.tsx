import type { RoomView } from '@truco/game-protocol';
import type { CSSProperties } from 'react';
import { TableScenery } from '../Scenery';
import { CardBack } from '../Card';

export function TableAtmosphere({ room }: { room: RoomView }) {
  const { match, transition } = room;
  const dealing = match !== null && room.status === 'playing' && transition?.kind === 'deal';

  return (
    <>
      <TableScenery theme={room.tableTheme?.assetKey} />
      {dealing && (
        <div
          key={`${room.matchId}:${match.hand.number}:${transition.id}`}
          className="table-atmosphere"
          data-player-count={match.playerCount}
          data-paused={room.paused}
          aria-hidden="true"
        >
          <span className="deal-deck">
            <CardBack />
          </span>
          {Array.from({ length: match.playerCount * 3 }, (_, index) => {
            const relative = index % match.playerCount;
            const round = Math.floor(index / match.playerCount);
            const style = {
              '--deal-delay': `${index * 30}ms`,
              '--deal-rotation': `${(round - 1) * 7}deg`,
            } as CSSProperties;

            // These are anonymous decorative backs, independent of the private deal.
            return (
              <span
                className={`deal-card deal-relative-${relative}`}
                key={`${relative}:${round}`}
                style={style}
              >
                <CardBack
                  theme={
                    room.seats[(relative + room.selfSeat) % match.playerCount]?.appearance?.deck
                      .assetKey
                  }
                />
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
