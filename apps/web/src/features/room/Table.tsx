import type { RoomView } from '@truco/game-protocol';
import { useEffect, useState } from 'react';
import type { Action } from '../../shared/transport/client';
import { CardBack, CardFace, cardLabel } from './CardFace';
import { TableActions } from './TableActions';
import { TableHistory } from './TableHistory';
import { TableSeats } from './TableSeats';

const manilhas = {
  '4': '5',
  '5': '6',
  '6': '7',
  '7': 'Q',
  Q: 'J',
  J: 'K',
  K: 'A',
  A: '2',
  '2': '3',
  '3': '4',
};

export function Table({ room, send }: { room: RoomView; send: (action: Action) => void }) {
  const [coveredHand, setCoveredHand] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const match = room.match;
  if (!match) return null;

  const { hand, phase } = match;
  const team = room.selfSeat % 2 === 0 ? 'A' : 'B';
  const enemyTeam = team === 'A' ? 'B' : 'A';
  const turn = phase.type === 'TURN' && phase.seat === room.selfSeat;
  const disabled = room.paused || room.status !== 'playing';
  const own = hand.hands[room.selfSeat];
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
                : 'Aguardando decisão';

  return (
    <section className="game-table" aria-label="Mesa da partida">
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
          <div className="table-status">
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
          </div>
          <TableSeats room={room} match={match} />
          <section className="center-plays" aria-label="Cartas na mesa">
            {tablePlays.length === 0 && (
              <span className="table-emblem" aria-hidden="true">
                ♠ ♥<br />♦ ♣
              </span>
            )}
            {tablePlays.map((play) => {
              const relative = (play.seat - room.selfSeat + match.playerCount) % match.playerCount;
              const label = play.covered
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
                    {play.covered ? ' · Carta coberta' : ''}
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
            <span>{manilhas[hand.vira.rank]}</span>
            <small>♦ &lt; ♠ &lt; ♥ &lt; ♣</small>
          </aside>
          <div className="own-hand">
            <div className="own-player">
              <span className={`seat-avatar avatar-${room.selfSeat}`} aria-hidden="true" />
              <strong>
                {room.seats[room.selfSeat]?.nickname ?? 'Você'} <small>VOCÊ</small>
              </strong>
            </div>
            <section className="hand-cards" aria-label="Sua mão">
              {own?.visibility === 'visible' &&
                own.cards.map((card) => (
                  <button
                    className="card"
                    type="button"
                    key={`${card.rank}:${card.suit}`}
                    aria-label={cardLabel(card)}
                    disabled={!turn || disabled}
                    onClick={() =>
                      send({
                        type: 'PLAY_CARD',
                        card,
                        covered:
                          covered && hand.completedTricks.length > 0 && hand.kind !== 'decisive',
                      })
                    }
                  >
                    <CardFace card={card} />
                  </button>
                ))}
            </section>
          </div>
        </div>
        <aside className="table-sidebar">
          <TableHistory room={room} match={match} />
          <TableActions
            room={room}
            match={match}
            covered={covered}
            setCovered={(checked) => setCoveredHand(checked ? hand.number : null)}
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
