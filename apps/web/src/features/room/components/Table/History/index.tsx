import { cardLabel } from '../../../utils/cards';
import type { MatchView, RoomView } from '@truco/game-protocol';

export function TableHistory({ room, match }: { room: RoomView; match: MatchView }) {
  const { hand } = match;

  return (
    <section className="table-history" aria-label="Histórico público">
      <h3>✦ ÚLTIMAS AÇÕES</h3>
      <ol className="history-list">
        {hand.completedTricks.map((trick, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Completed tricks are append-only and numbered within the hand.
          <li className="history-entry" key={`${hand.number}:${index}`}>
            <strong>
              Vaza {index + 1} ·{' '}
              {trick.result.winner === 'tie' ? 'Empate' : `Equipe ${trick.result.winner}`}
            </strong>
            <ul>
              {trick.plays.map((play) => (
                <li key={play.seat}>
                  {room.seats[play.seat]?.nickname ?? 'Jogador'}:{' '}
                  {play.covered
                    ? 'Carta coberta'
                    : 'card' in play
                      ? cardLabel(play.card)
                      : 'Carta oculta'}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {hand.plays.map((play) => (
          <li className="history-entry" key={`current:${play.seat}`}>
            {room.seats[play.seat]?.nickname ?? 'Jogador'} jogou{' '}
            {play.covered
              ? 'carta coberta'
              : 'card' in play
                ? cardLabel(play.card)
                : 'carta oculta'}
            .
          </li>
        ))}
      </ol>
      {hand.completedTricks.length === 0 && hand.plays.length === 0 && (
        <p className="history-empty">As jogadas desta mão aparecerão aqui.</p>
      )}
    </section>
  );
}
