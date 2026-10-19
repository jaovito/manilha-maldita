import { CardBack } from '../Card';
import { t, loadLocale } from '../../../../../shared/i18n';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { disabledHint } from '../../../../../shared/DisabledTooltip';
import type { Action } from '../../../../../shared/transport/client';
import { nextRaise } from '../../../../../shared/feedback/raises';
import { raiseMessages } from '../../../../../shared/i18n/raises';
import { gameplayDisabledReason } from '../../../utils/disabled-reason';

type Props = {
  room: RoomView;
  match: MatchView;
  covered: boolean;
  setCovered: (checked: boolean) => void;
  send: (action: Action) => void;
};

export function TableActions({ room, match, covered, setCovered, send }: Props) {
  const { hand, phase } = match;
  const counter = nextRaise(hand.betting.pendingStake ?? hand.betting.acceptedStake);
  const raiseText = raiseMessages[loadLocale()];
  const team = room.selfSeat % 2 === 0 ? 'A' : 'B';
  const turn = phase.type === 'TURN' && phase.seat === room.selfSeat;
  const response = phase.type === 'RAISE_RESPONSE' && hand.betting.lastRaisingTeam !== team;
  const eleven = phase.type === 'ELEVEN_DECISION' && phase.team === team;
  const disabled = room.paused || Boolean(room.transition) || room.status !== 'playing';
  const baseReason = gameplayDisabledReason(room);
  const raiseReason =
    baseReason ||
    (hand.kind !== 'normal'
      ? t('Não é permitido aumentar em mão de onze ou decisiva.')
      : hand.betting.acceptedStake === 12
        ? t('A aposta já atingiu o limite de 12 pontos.')
        : hand.betting.lastRaisingTeam === team
          ? t('Sua equipe não pode aumentar a própria proposta.')
          : !turn
            ? t('Você só pode pedir Truco antes de jogar, na sua vez.')
            : null);
  const coveredReason =
    baseReason ||
    (hand.kind === 'decisive'
      ? t('A mão decisiva não permite cartas cobertas.')
      : hand.completedTricks.length === 0
        ? t('Cartas cobertas são permitidas a partir da segunda vaza.')
        : !turn
          ? t('Aguarde sua vez para escolher jogar coberta.')
          : null);

  return (
    <div className="table-actions">
      {phase.type === 'PREPARATION' ? (
        <div className="preparation-actions-bar">
          <p>
            {t('Preparação · {0}/{1} prontos', [
              match.powers?.players.filter((player) => player.ready).length ?? 0,
              match.playerCount,
            ])}
          </p>
          {match.powers?.players[room.selfSeat]?.ready ? (
            <p role="status" aria-label={t('Intenção confirmada. Aguardando os demais.')}>
              {t('Confirmado · aguardando os demais')}
            </p>
          ) : (
            <button
              type="button"
              className="action-accept"
              aria-label={t('Passar preparação')}
              disabled={disabled}
              {...disabledHint(baseReason)}
              onClick={() => send({ type: 'PREPARE', intent: { type: 'pass' } })}
            >
              <span className="preparation-label">{t('Passar preparação')}</span>
            </button>
          )}
        </div>
      ) : response ? (
        <div className="decision-actions">
          <button
            className="action-accept"
            type="button"
            disabled={disabled}
            {...disabledHint(baseReason)}
            onClick={() => send({ type: 'RESPOND_RAISE', response: 'accept' })}
          >
            {t('Aceitar')}
          </button>
          <button
            className="action-truco"
            data-counter-raise
            type="button"
            disabled={disabled || hand.betting.pendingStake === 12}
            {...disabledHint(
              baseReason ||
                (hand.betting.pendingStake === 12
                  ? t('A proposta já é de 12 pontos. Você pode aceitar ou correr.')
                  : null),
            )}
            onClick={() => send({ type: 'RESPOND_RAISE', response: 'raise' })}
          >
            <span className="truco-label">
              {counter ? raiseText.shouts[counter] : raiseText.limit}
            </span>
          </button>
          <button
            className="action-fold"
            type="button"
            disabled={disabled}
            {...disabledHint(baseReason)}
            onClick={() => send({ type: 'RESPOND_RAISE', response: 'fold' })}
          >
            {t('Correr')}
          </button>
        </div>
      ) : eleven ? (
        <div className="decision-actions">
          <button
            className="action-accept"
            type="button"
            disabled={disabled}
            {...disabledHint(baseReason)}
            onClick={() => send({ type: 'DECIDE_ELEVEN', response: 'play' })}
          >
            {t('Jogar por 3')}
          </button>
          <button
            className="action-fold"
            type="button"
            disabled={disabled}
            {...disabledHint(baseReason)}
            onClick={() => send({ type: 'DECIDE_ELEVEN', response: 'fold' })}
          >
            {t('Correr por 1')}
          </button>
        </div>
      ) : (
        <button
          className="action-truco"
          type="button"
          aria-label={t('Pedir Truco / aumentar')}
          disabled={Boolean(raiseReason)}
          {...disabledHint(raiseReason)}
          onClick={() => send({ type: 'REQUEST_RAISE' })}
        >
          <span className="truco-label">
            <span aria-hidden="true">⚑</span>{' '}
            {hand.betting.acceptedStake === 1
              ? raiseText.call
              : raiseText.shouts[nextRaise(hand.betting.acceptedStake) ?? 12]}
          </span>
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
            {...disabledHint(coveredReason)}
            onChange={(event) => setCovered(event.target.checked)}
          />
          <span className="covered-card-toggle" aria-hidden="true">
            <CardBack />
          </span>
          <span>{t('Jogar coberta (a partir da segunda vaza)')}</span>
        </label>
      )}
      {room.status === 'playing' && (
        <button
          className="surrender-action"
          type="button"
          disabled={room.paused}
          {...disabledHint(
            room.paused ? t('Aguarde a pausa de reconexão terminar para desistir.') : null,
          )}
          onClick={() => send({ type: 'SURRENDER' })}
        >
          {t('Desistir da partida')}
        </button>
      )}
    </div>
  );
}
