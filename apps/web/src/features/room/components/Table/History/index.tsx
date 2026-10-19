import { t } from '../../../../../shared/i18n';
import { cardLabel } from '../../../utils/cards';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { explainTrick } from '../Feedback/explanation';
import { powerNames } from '../Powers';

export function TableHistory({ room, match }: { room: RoomView; match: MatchView }) {
  const { hand } = match;

  return (
    <section className="table-history" aria-label={t('Histórico público')}>
      <h3>{t('✦ ÚLTIMAS AÇÕES')}</h3>
      <ol className="history-list">
        {match.powers?.activations.map((activation) => (
          <li
            className="history-entry power-reveal"
            key={`${hand.number}:power:${activation.seat}`}
          >
            <strong>
              {t('{0} ativou {1}', [
                room.seats[activation.seat]?.nickname ?? t('Jogador'),
                powerNames[activation.power],
              ])}
            </strong>
            <p>
              {t('Alvo:')} {room.seats[activation.target]?.nickname ?? t('Jogador')}.
            </p>
          </li>
        ))}
        {hand.completedTricks.map((trick, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Completed tricks are append-only and numbered within the hand.
          <li className="history-entry" key={`${hand.number}:${index}`}>
            <strong>
              {t('Vaza')} {index + 1} ·{' '}
              {trick.result.winner === 'tie' ? t('Empate') : t('Equipe {0}', [trick.result.winner])}
            </strong>
            <p className="trick-explanation">{explainTrick(room, match, trick)}</p>
            <ul>
              {trick.plays.map((play) => (
                <li key={play.seat}>
                  {room.seats[play.seat]?.nickname ?? t('Jogador')}:{' '}
                  {play.covered
                    ? t('Carta coberta')
                    : 'card' in play
                      ? cardLabel(play.card)
                      : t('Carta oculta')}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {hand.plays.map((play) => (
          <li className="history-entry" key={`current:${play.seat}`}>
            {t('{0} jogou {1}.', [
              room.seats[play.seat]?.nickname ?? t('Jogador'),
              play.covered
                ? t('carta coberta')
                : 'card' in play
                  ? cardLabel(play.card)
                  : t('carta oculta'),
            ])}
          </li>
        ))}
      </ol>
      {hand.completedTricks.length === 0 && hand.plays.length === 0 && (
        <p className="history-empty">{t('As jogadas desta mão aparecerão aqui.')}</p>
      )}
    </section>
  );
}
