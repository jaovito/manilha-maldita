import { cardLabel, manilhaRanks } from '../../utils/cards';
import type { RoomView } from '@truco/game-protocol';
import { useEffect, useRef, useState } from 'react';
import type { Action } from '../../../../shared/transport/client';
import { CardBack, CardFace } from './Card';
import { TableActions } from './Actions';
import { TableHistory } from './History';
import { TableHand } from './Hand';
import { availablePower, hasBoostTarget } from './Powers/selection';
import { TablePowers, powerNames } from './Powers';
import { TableSeats } from './Seats';

export function Table({ room, send }: { room: RoomView; send: (action: Action) => void }) {
  const powerRef = useRef<HTMLButtonElement>(null);
  const [powerDecision, setPowerDecision] = useState<string | null>(null);
  const [spyPosition, setSpyPosition] = useState<{
    hand: string;
    seat: number;
    index: number;
  } | null>(null);
  const [coveredHand, setCoveredHand] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const selectionContext = `${room.matchId}:${room.match?.hand.number}:${room.decisionId}:${room.match?.powers?.players[room.selfSeat]?.power}:${room.match?.powers?.players[room.selfSeat]?.ready}`;
  useEffect(() => {
    if (powerDecision !== selectionContext || room.paused || room.status !== 'playing')
      setPowerDecision(null);
  }, [powerDecision, selectionContext, room.paused, room.status]);

  const match = room.match;
  if (!match) return null;

  const { hand, phase } = match;
  const team = room.selfSeat % 2 === 0 ? 'A' : 'B';
  const enemyTeam = team === 'A' ? 'B' : 'A';
  const turn = phase.type === 'TURN' && phase.seat === room.selfSeat;
  const cancelSelection = (restoreFocus = false) => {
    setPowerDecision(null);
    if (restoreFocus) powerRef.current?.focus();
  };
  const handKey = `${room.matchId}:${hand.number}`;
  const selectedPower =
    powerDecision !== null && powerDecision === selectionContext
      ? availablePower(room, match)
      : null;
  const covered = coveredHand === hand.number;
  const tablePlays =
    hand.plays.length > 0 ? hand.plays : (hand.completedTricks.at(-1)?.plays ?? []);
  const status =
    room.status === 'finished'
      ? 'Partida encerrada'
      : room.paused
        ? 'Partida pausada para reconexão'
        : turn
          ? 'Sua vez'
          : phase.type === 'TURN'
            ? `Vez de ${room.seats[phase.seat]?.nickname ?? 'jogador'}`
            : phase.type === 'RAISE_RESPONSE'
              ? `Pedido de aumento para ${hand.betting.pendingStake}`
              : phase.type === 'ELEVEN_DECISION'
                ? 'Sua equipe decide a mão de onze'
                : phase.type === 'PREPARATION'
                  ? 'Preparação selada'
                  : 'Aguardando decisão';

  return (
    <section
      className="game-table"
      aria-label="Mesa da partida"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && selectedPower) cancelSelection(true);
      }}
    >
      <section
        className="scoreboard"
        aria-label={`Equipe A ${match.score.A} × ${match.score.B} Equipe B`}
      >
        <div className="team-score own">
          <span>
            {match.playerCount === 4 ? 'SUA DUPLA' : 'VOCÊ'} · {team}
          </span>
          <strong>{match.score[team]}</strong>
        </div>
        <div className="stake-score">
          <span>VALENDO</span>
          <strong>{hand.betting.acceptedStake}</strong>
          <small>
            MÃO {hand.number}
            {hand.betting.pendingStake !== null ? ` · PEDIDO ${hand.betting.pendingStake}` : ''}
          </small>
        </div>
        <div className="team-score enemy">
          <span>ADVERSÁRIOS · {enemyTeam}</span>
          <strong>{match.score[enemyTeam]}</strong>
        </div>
      </section>
      <div className="table-layout">
        <div className="arena" data-player-count={match.playerCount}>
          <section
            className="table-status"
            aria-label="Status da partida"
            data-targeting={selectedPower !== null}
          >
            {selectedPower && (
              <p className="compact-power-prompt" role="status">
                {selectedPower === 'boost' && !hasBoostTarget(match, room.selfSeat)
                  ? 'Impulso · Sem carta válida.'
                  : `${powerNames[selectedPower]} · Escolha ${selectedPower === 'spy' ? 'um verso' : 'sua carta'}.`}
              </p>
            )}
            <p role="status">{status}</p>
            <span>
              {hand.kind === 'normal'
                ? 'Mão comum'
                : hand.kind === 'eleven'
                  ? 'Mão de onze'
                  : 'Mão decisiva'}
            </span>
            {room.deadline !== null && (
              <small>
                Tempo estimado: {Math.max(0, Math.ceil((room.deadline - now) / 1000))} s
              </small>
            )}
          </section>
          <TableSeats
            room={room}
            match={match}
            spying={selectedPower === 'spy'}
            spyPosition={spyPosition?.hand === handKey ? spyPosition : null}
            spy={(seat, index) => {
              setSpyPosition({ hand: handKey, seat, index });
              setPowerDecision(null);
              powerRef.current?.focus();
              send({ type: 'PREPARE', intent: { type: 'spy', target: seat } });
            }}
          />
          <section className="center-plays" aria-label="Cartas na mesa">
            {tablePlays.length === 0 && (
              <span className="table-emblem" aria-hidden="true">
                ♠ ♥<br />♦ ♣
              </span>
            )}
            {tablePlays.map((play) => {
              const relative = (play.seat - room.selfSeat + match.playerCount) % match.playerCount;
              const label =
                'power' in play && play.power === 'mask' && !('card' in play)
                  ? 'Carta mascarada'
                  : play.covered
                    ? 'Carta coberta'
                    : 'card' in play
                      ? cardLabel(play.card)
                      : 'Carta oculta';

              return (
                <div className={`played-card play-relative-${relative}`} key={play.seat}>
                  <span role="img" aria-label={label}>
                    {play.covered || !('card' in play) ? (
                      <CardBack />
                    ) : (
                      <CardFace card={play.card} />
                    )}
                  </span>
                  <small>
                    {room.seats[play.seat]?.nickname ?? 'Jogador'}
                    {'power' in play && play.power === 'mask'
                      ? ' · Máscara'
                      : 'power' in play && play.power === 'boost'
                        ? ' · Impulso'
                        : play.covered
                          ? ' · Carta coberta'
                          : ''}
                  </small>
                </div>
              );
            })}
          </section>
          <aside className="vira-panel" aria-label="Vira e manilhas">
            <h3>VIRA</h3>
            <span role="img" aria-label={cardLabel(hand.vira)}>
              <CardFace card={hand.vira} />
            </span>
            <strong>MANILHA</strong>
            <span>{manilhaRanks[hand.vira.rank]}</span>
            <small>♦ &lt; ♠ &lt; ♥ &lt; ♣</small>
          </aside>
          <TableHand
            room={room}
            match={match}
            selected={selectedPower}
            covered={covered}
            send={send}
            cancel={cancelSelection}
          />
        </div>
        <aside className="table-sidebar">
          <TablePowers
            key={`${room.matchId}:${hand.number}`}
            room={room}
            match={match}
            cardRef={powerRef}
            selected={Boolean(selectedPower)}
            select={(selected) => {
              setPowerDecision(selected ? selectionContext : null);
              if (selected) setCoveredHand(null);
            }}
          />
          <div className="table-information">
            <TableHistory room={room} match={match} />
          </div>
          <TableActions
            room={room}
            match={match}
            covered={covered}
            setCovered={(checked) => {
              setCoveredHand(checked ? hand.number : null);
              if (checked) setPowerDecision(null);
            }}
            send={send}
          />
        </aside>
      </div>
      {room.outcome && (
        <p className="match-result" role="status">
          {room.outcome.winner === team
            ? 'VITÓRIA!'
            : room.outcome.winner
              ? 'FIM DE PARTIDA'
              : 'PARTIDA ENCERRADA'}{' '}
          · {room.outcome.winner ? `Equipe ${room.outcome.winner} venceu` : 'Sem vencedor'} ·{' '}
          {
            {
              completed: 'pontos',
              surrender: 'desistência',
              abandonment: 'abandono',
              expired: 'sala expirada',
              technical: 'falha técnica',
            }[room.outcome.reason]
          }
        </p>
      )}
    </section>
  );
}
