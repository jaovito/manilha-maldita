import { t } from '../../../../shared/i18n';
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
import { TableFeedback } from './Feedback';
import { TableAtmosphere } from './Atmosphere';
import { RaiseAnnouncement } from './Feedback/RaiseAnnouncement';
import { TurnAnnouncement } from './Feedback/TurnAnnouncement';
import { RoundAnnouncement } from './Feedback/RoundAnnouncement';

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
    if (
      powerDecision !== selectionContext ||
      room.paused ||
      room.transition ||
      room.status !== 'playing'
    )
      setPowerDecision(null);
  }, [powerDecision, selectionContext, room.paused, room.transition, room.status]);

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
  const resolvedTrick =
    room.transition?.kind !== 'deal' &&
    (room.transition || (room.status === 'finished' && room.outcome?.reason === 'completed')) &&
    hand.plays.length === 0 &&
    hand.betting.pendingStake === null
      ? hand.completedTricks.at(-1)
      : undefined;
  const trickIndex = Math.max(0, hand.completedTricks.length - (hand.plays.length === 0 ? 1 : 0));
  const openingTrick =
    !room.transition &&
    !room.paused &&
    room.status === 'playing' &&
    phase.type === 'TURN' &&
    hand.plays.length === 0 &&
    hand.completedTricks.length > 0;
  const status =
    room.status === 'finished'
      ? t('Partida encerrada')
      : room.paused
        ? t('Partida pausada para reconexão')
        : turn
          ? t('Sua vez')
          : phase.type === 'TURN'
            ? t('Vez de {0}', [room.seats[phase.seat]?.nickname ?? t('jogador')])
            : phase.type === 'RAISE_RESPONSE'
              ? t('Pedido de aumento para {0}', [hand.betting.pendingStake ?? '—'])
              : phase.type === 'ELEVEN_DECISION'
                ? t('Sua equipe decide a mão de onze')
                : phase.type === 'PREPARATION'
                  ? t('Preparação selada')
                  : t('Aguardando decisão');

  return (
    <section
      className="game-table"
      data-transition={room.transition?.kind}
      aria-label={t('Mesa da partida')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && selectedPower) cancelSelection(true);
      }}
    >
      <section
        className="scoreboard"
        aria-label={t('Equipe A {0} × {1} Equipe B', [match.score.A, match.score.B])}
      >
        <div className="team-score own">
          <span>
            {match.playerCount === 4 ? t('SUA DUPLA') : t('VOCÊ')} · {team}
          </span>
          <strong>{match.score[team]}</strong>
        </div>
        <div className="stake-score">
          <span>{t('VALENDO')}</span>
          <strong>{hand.betting.acceptedStake}</strong>
          <small>
            {t('MÃO')} {hand.number}
            {hand.betting.pendingStake !== null
              ? t(' · PEDIDO {0}', [hand.betting.pendingStake ?? '—'])
              : ''}
          </small>
        </div>
        <div className="team-score enemy">
          <span>
            {t('ADVERSÁRIOS ·')} {enemyTeam}
          </span>
          <strong>{match.score[enemyTeam]}</strong>
        </div>
      </section>
      <div className="table-layout">
        <div className="arena" data-player-count={match.playerCount}>
          <TableAtmosphere room={room} />
          <TurnAnnouncement room={room} />
          <RaiseAnnouncement room={room} />
          <section
            className="table-status"
            aria-label={t('Status da partida')}
            data-targeting={selectedPower !== null}
            data-resolving={Boolean(room.transition)}
          >
            {selectedPower && (
              <p className="compact-power-prompt" role="status">
                {selectedPower === 'boost' && !hasBoostTarget(match, room.selfSeat)
                  ? t('Impulso · Sem carta válida.')
                  : t('{0} · Escolha {1}.', [
                      powerNames[selectedPower],
                      selectedPower === 'spy' ? t('um verso') : t('sua carta'),
                    ])}
              </p>
            )}
            {!room.transition && !openingTrick && (
              <p role="status" key={room.decisionId}>
                {status}
              </p>
            )}
            <RoundAnnouncement room={room} />
            <TableFeedback room={room} />
            {!room.transition && !openingTrick && (
              <span>
                {hand.kind === 'normal'
                  ? t('Mão comum')
                  : hand.kind === 'eleven'
                    ? t('Mão de onze')
                    : t('Mão decisiva')}
              </span>
            )}
            {room.deadline !== null && (
              <small>
                {t('Tempo:')} {Math.max(0, Math.ceil((room.deadline - now) / 1000))} s
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
          <section className="center-plays" aria-label={t('Cartas na mesa')}>
            {tablePlays.length === 0 && (
              <span className="table-emblem" aria-hidden="true">
                ♠ ♥<br />♦ ♣
              </span>
            )}
            {tablePlays.map((play) => {
              const relative = (play.seat - room.selfSeat + match.playerCount) % match.playerCount;
              const masked = 'power' in play && play.power === 'mask';
              const hiddenReason = masked
                ? t('Máscara: mantém a força e revela a carta na resolução da vaza.')
                : play.covered
                  ? t('Coberta: perde para qualquer carta aberta ou mascarada.')
                  : undefined;
              const label =
                'power' in play && play.power === 'mask' && !('card' in play)
                  ? t('Carta mascarada')
                  : play.covered
                    ? t('Carta coberta')
                    : 'card' in play
                      ? cardLabel(play.card)
                      : t('Carta oculta');

              return (
                <div
                  className={`played-card play-relative-${relative}`}
                  key={`${handKey}:${trickIndex}:${play.seat}`}
                  data-power={'power' in play ? play.power : undefined}
                  data-winner={
                    resolvedTrick?.result.winner !== 'tie' &&
                    resolvedTrick?.result.nextLeader === play.seat
                  }
                  data-resolved={Boolean(resolvedTrick)}
                >
                  <span
                    role="img"
                    aria-label={label}
                    aria-description={hiddenReason}
                    title={hiddenReason}
                  >
                    {play.covered || !('card' in play) ? (
                      <CardBack kind={play.covered ? 'covered' : masked ? 'masked' : undefined} />
                    ) : (
                      <CardFace card={play.card} />
                    )}
                  </span>
                  <small>
                    {room.seats[play.seat]?.nickname ?? t('Jogador')}
                    {'power' in play && play.power === 'mask'
                      ? t(' · Máscara')
                      : 'power' in play && play.power === 'boost'
                        ? t(' · Impulso')
                        : play.covered
                          ? t(' · Carta coberta')
                          : ''}
                  </small>
                </div>
              );
            })}
          </section>
          <aside className="vira-panel" aria-label={t('Vira e manilhas')}>
            <h3>{t('VIRA')}</h3>
            <span role="img" aria-label={cardLabel(hand.vira)}>
              <CardFace card={hand.vira} />
            </span>
            <strong>{t('MANILHA')}</strong>
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
            ? t('VITÓRIA!')
            : room.outcome.winner
              ? t('FIM DE PARTIDA')
              : t('PARTIDA ENCERRADA')}{' '}
          ·{' '}
          {room.outcome.winner ? t('Equipe {0} venceu', [room.outcome.winner]) : t('Sem vencedor')}{' '}
          ·{' '}
          {
            {
              completed: t('pontos'),
              surrender: t('desistência'),
              abandonment: t('abandono'),
              expired: t('sala expirada'),
              technical: t('falha técnica'),
            }[room.outcome.reason]
          }
        </p>
      )}
    </section>
  );
}
