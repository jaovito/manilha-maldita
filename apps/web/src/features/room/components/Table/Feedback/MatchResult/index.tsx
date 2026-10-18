import type { RoomView } from '@truco/game-protocol';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { disabledHint } from '../../../../../../shared/DisabledTooltip';
import type { Action } from '../../../../../../shared/transport/client';
import { completedVictory, resultPerspective, resultTitle } from '../results';

const confettiColors = ['#ffe29a', '#d49a42', '#3eaa7d', '#b74d51'];

export function MatchResult({
  room,
  send,
  connected = true,
}: {
  room: RoomView;
  send: (action: Action) => void;
  connected?: boolean;
}) {
  const [presentation, setPresentation] = useState({
    matchId: room.matchId,
    status: room.status,
    celebrating: false,
  });
  const heading = useRef<HTMLHeadingElement>(null);

  // Adjust before committing children so the menu never flashes before the celebration.
  if (presentation.matchId !== room.matchId || presentation.status !== room.status) {
    setPresentation({
      matchId: room.matchId,
      status: room.status,
      celebrating:
        room.matchId !== null &&
        presentation.matchId === room.matchId &&
        presentation.status === 'playing' &&
        room.status === 'finished',
    });
  }

  const celebrating = presentation.celebrating && room.status === 'finished';
  const celebrationId = celebrating ? room.matchId : null;
  useEffect(() => {
    if (!celebrationId) return;

    const timer = window.setTimeout(() => {
      setPresentation((current) =>
        current.matchId === celebrationId ? { ...current, celebrating: false } : current,
      );
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [celebrationId]);

  useEffect(() => {
    if (room.status === 'finished') heading.current?.focus();
  }, [room.status]);

  const { match, outcome } = room;
  if (!outcome || room.status !== 'finished') return null;

  const victory = completedVictory(room);
  const host = room.selfSeat === room.hostSeat;
  const hostReason = !connected
    ? 'Aguarde reconectar para continuar.'
    : !host
      ? 'Somente o anfitrião pode preparar a revanche ou voltar ao lobby.'
      : null;

  return createPortal(
    <div className="match-end-layer" data-stage={celebrating ? 'celebration' : 'menu'}>
      {victory && celebrating && (
        <div className="pixel-confetti-layer" aria-hidden="true" key={room.matchId}>
          {Array.from({ length: 48 }, (_, index) => {
            const style = {
              left: `${(index * 37 + 5) % 100}%`,
              '--confetti-color': confettiColors[index % confettiColors.length],
              '--confetti-drift': `${((index % 7) - 3) * 19}px`,
              '--confetti-delay': `${(index % 8) * 70}ms`,
              '--confetti-duration': `${3300 + (index % 7) * 150}ms`,
              '--confetti-spin': `${(index % 2 === 0 ? 1 : -1) * 360}deg`,
              '--confetti-size': `${6 + (index % 3) * 2}px`,
            } as CSSProperties;

            // Fixed decoration is independent of cards and gameplay entropy.
            // biome-ignore lint/suspicious/noArrayIndexKey: Particles are a fixed immutable sequence with no insertion or reordering.
            return <i className="pixel-confetti" key={`pixel-${index}`} style={style} />;
          })}
        </div>
      )}
      <section
        className="match-result-panel"
        data-result={resultPerspective(room, outcome.winner)}
        {...(celebrating
          ? ({ role: 'status' } as const)
          : ({ role: 'dialog', 'aria-modal': true } as const))}
        aria-label="Resultado da partida"
        onKeyDown={(event) => {
          if (celebrating || event.key !== 'Tab') return;

          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
          ];
          const first = buttons[0];
          const last = buttons.at(-1);
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === heading.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <span className="match-result-suits" aria-hidden="true">
          ♦ ♠ ♥ ♣
        </span>
        <h2 className="match-result-title" ref={heading} tabIndex={-1}>
          {resultTitle(room, outcome.winner, victory)}
        </h2>
        {match && (
          <p className="match-final-score">
            PLACAR FINAL · A {match.score.A} × {match.score.B} B
          </p>
        )}
        <p className="room-result">
          {outcome.winner ? `Equipe ${outcome.winner} venceu a partida.` : 'Partida sem vencedor.'}
        </p>
        <p className="match-result-reason">
          {
            {
              completed: 'Partida concluída por pontos',
              surrender: 'Partida encerrada por desistência',
              abandonment: 'Partida encerrada por abandono',
              expired: 'Sala expirada',
              technical: 'Partida encerrada por falha técnica',
            }[outcome.reason]
          }
        </p>
        {celebrating ? (
          <p className="match-end-hint">Um momento para o resultado…</p>
        ) : (
          <>
            <div className="match-end-actions">
              <button
                type="button"
                className="button-primary"
                disabled={!connected || !host}
                {...disabledHint(hostReason)}
                onClick={() => send({ type: 'REMATCH' })}
              >
                Revanche
              </button>
              <button
                type="button"
                disabled={!connected || !host}
                {...disabledHint(hostReason)}
                onClick={() => send({ type: 'REMATCH' })}
              >
                Voltar ao lobby
              </button>
              <button
                type="button"
                className="button-quiet"
                disabled={!connected}
                {...disabledHint(!connected ? 'Aguarde reconectar para sair da sala.' : null)}
                onClick={() => send({ type: 'LEAVE' })}
              >
                Sair da sala
              </button>
            </div>
            <p className="match-end-hint" role="status">
              {!connected
                ? 'Reconectando… Ações aguardam conexão.'
                : host
                  ? 'Revanche e retorno ao lobby aguardam todos confirmarem pronto novamente.'
                  : 'Aguarde o anfitrião para voltar ao lobby ou preparar a revanche.'}
            </p>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
