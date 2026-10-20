import { useId, useLayoutEffect, useRef, useState } from 'react';
import { t } from '../../../../../shared/i18n';
import { cardLabel } from '../../../utils/cards';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { explainTrick } from '../Feedback/explanation';
import { powerNames } from '../Powers';

export function TableHistory({ room, match }: { room: RoomView; match: MatchView }) {
  const { hand } = match;
  const intel = match.powers?.intel;
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const followLatest = useRef(true);
  const context = `${hand.number}:${expanded}`;
  const previousContext = useRef(context);

  // Content can regroup when a trick resolves; never pull a reader away from older entries.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    if (previousContext.current !== context) {
      followLatest.current = true;
      previousContext.current = context;
    }

    if (followLatest.current) list.scrollTop = list.scrollHeight;
  });

  return (
    <section
      className="table-history"
      data-expanded={expanded}
      aria-label={t('Histórico da partida')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setExpanded(false);
      }}
    >
      <header className="history-heading">
        <h3>{t('✦ ÚLTIMAS AÇÕES')}</h3>
        <button
          type="button"
          className="history-toggle"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={expanded ? t('Recolher histórico') : t('Expandir histórico')}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="history-toggle-desktop" aria-hidden="true">
            {expanded ? '−' : '+'}
          </span>
          <span className="history-toggle-arrow" aria-hidden="true" />
        </button>
      </header>
      <ol
        className="history-list"
        id={listId}
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          followLatest.current = list.scrollHeight - list.clientHeight - list.scrollTop <= 2;
        }}
      >
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
            {activation.power === 'spy' &&
              activation.seat === room.selfSeat &&
              intel?.target === activation.target && (
                <p className="history-spy-intel">
                  {t('Só você · Carta espiada: {0}.', [cardLabel(intel.card)])}
                </p>
              )}
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
        {hand.completedTricks.length === 0 && hand.plays.length === 0 && (
          <li className="history-empty">{t('As jogadas desta mão aparecerão aqui.')}</li>
        )}
      </ol>
    </section>
  );
}
