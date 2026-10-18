import type { MatchView, RoomView } from '@truco/game-protocol';
import type { Action } from '../../../../../shared/transport/client';

type Props = {
  room: RoomView;
  match: MatchView;
  covered: boolean;
  setCovered: (checked: boolean) => void;
  send: (action: Action) => void;
};

export function TableActions({ room, match, covered, setCovered, send }: Props) {
  const { hand, phase } = match;
  const team = room.selfSeat % 2 === 0 ? 'A' : 'B';
  const turn = phase.type === 'TURN' && phase.seat === room.selfSeat;
  const response = phase.type === 'RAISE_RESPONSE' && hand.betting.lastRaisingTeam !== team;
  const eleven = phase.type === 'ELEVEN_DECISION' && phase.team === team;
  const disabled = room.paused || room.status !== 'playing';

  return (
    <div className="table-actions">
      {phase.type === 'PREPARATION' ? (
        <div className="preparation-actions-bar">
          <p>
            Preparação · {match.powers?.players.filter((player) => player.ready).length ?? 0}/
            {match.playerCount} prontos
          </p>
          {match.powers?.players[room.selfSeat]?.ready ? (
            <p role="status" aria-label="Intenção confirmada. Aguardando os demais.">
              Confirmado · aguardando os demais
            </p>
          ) : (
            <button
              type="button"
              className="action-accept"
              aria-label="Passar preparação"
              disabled={disabled}
              onClick={() => send({ type: 'PREPARE', intent: { type: 'pass' } })}
            >
              Passar preparação
            </button>
          )}
        </div>
      ) : response ? (
        <div className="decision-actions">
          <button
            className="action-accept"
            type="button"
            disabled={disabled}
            onClick={() => send({ type: 'RESPOND_RAISE', response: 'accept' })}
          >
            Aceitar
          </button>
          <button
            className="action-truco"
            type="button"
            disabled={disabled || hand.betting.pendingStake === 12}
            onClick={() => send({ type: 'RESPOND_RAISE', response: 'raise' })}
          >
            Contra-aumentar
          </button>
          <button
            className="action-fold"
            type="button"
            disabled={disabled}
            onClick={() => send({ type: 'RESPOND_RAISE', response: 'fold' })}
          >
            Correr
          </button>
        </div>
      ) : eleven ? (
        <div className="decision-actions">
          <button
            className="action-accept"
            type="button"
            disabled={disabled}
            onClick={() => send({ type: 'DECIDE_ELEVEN', response: 'play' })}
          >
            Jogar por 3
          </button>
          <button
            className="action-fold"
            type="button"
            disabled={disabled}
            onClick={() => send({ type: 'DECIDE_ELEVEN', response: 'fold' })}
          >
            Correr por 1
          </button>
        </div>
      ) : (
        <button
          className="action-truco"
          type="button"
          aria-label="Pedir Truco / aumentar"
          disabled={
            !turn ||
            disabled ||
            hand.kind !== 'normal' ||
            hand.betting.acceptedStake === 12 ||
            hand.betting.lastRaisingTeam === team
          }
          onClick={() => send({ type: 'REQUEST_RAISE' })}
        >
          <span aria-hidden="true">⚑</span> TRUCO!
        </button>
      )}
      {phase.type !== 'PREPARATION' && (
        <label className="covered-choice">
          <input
            type="checkbox"
            checked={covered}
            disabled={
              !turn || disabled || hand.completedTricks.length === 0 || hand.kind === 'decisive'
            }
            onChange={(event) => setCovered(event.target.checked)}
          />
          Jogar coberta (a partir da segunda vaza)
        </label>
      )}
      {room.status === 'playing' && (
        <button
          className="surrender-action"
          type="button"
          disabled={disabled}
          onClick={() => send({ type: 'SURRENDER' })}
        >
          Desistir da partida
        </button>
      )}
    </div>
  );
}
