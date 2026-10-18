import type { Action, MatchView, RoomView } from '@truco/game-protocol';
import { cardLabel, manilhaRanks } from '../../../utils/cards';
import { CardFace } from '../Card';
import { hasBoostTarget, powerInstructions } from '../Powers/selection';

type SelectedPower = keyof typeof powerInstructions | null;

export function TableHand({
  room,
  match,
  selected,
  covered,
  send,
  cancel,
}: {
  room: RoomView;
  match: MatchView;
  selected: SelectedPower;
  covered: boolean;
  send: (action: Action) => void;
  cancel: (restoreFocus?: boolean) => void;
}) {
  const { hand, phase } = match;
  const own = hand.hands[room.selfSeat];
  const turn = phase.type === 'TURN' && phase.seat === room.selfSeat;
  const boostHasTarget = hasBoostTarget(match, room.selfSeat);
  const disabled = room.paused || room.status !== 'playing';

  return (
    <div className="own-hand" data-targeting={selected !== null}>
      <div className="own-player" data-active={turn && !disabled}>
        {turn && !disabled && <span className="turn-badge">Sua vez</span>}
        <span className={`seat-avatar avatar-${room.selfSeat}`} aria-hidden="true" />
        <strong>
          {room.seats[room.selfSeat]?.nickname ?? 'Você'} <small>VOCÊ</small>
        </strong>
      </div>
      {selected && (
        <div className="hand-power-prompt" role="status">
          <span>
            {selected === 'boost' && !boostHasTarget
              ? 'Impulso · Nenhuma carta válida: não aceita manilha nem 3.'
              : powerInstructions[selected]}
          </span>
          <button type="button" aria-label="Cancelar seleção do poder" onClick={() => cancel(true)}>
            ×
          </button>
        </div>
      )}
      <section className="hand-cards" aria-label="Sua mão">
        {own?.visibility === 'visible' &&
          own.cards.map((card) => (
            <button
              className="card"
              type="button"
              key={`${card.rank}:${card.suit}`}
              aria-label={cardLabel(card)}
              data-power-target={
                selected === 'exchange' || selected === 'boost' || selected === 'mask'
              }
              disabled={
                disabled ||
                (selected === 'exchange' ? false : !turn) ||
                (selected === 'boost' &&
                  (card.rank === manilhaRanks[hand.vira.rank] || card.rank === '3'))
              }
              onClick={() => {
                if (selected === 'exchange')
                  send({ type: 'PREPARE', intent: { type: 'exchange', card } });
                else
                  send({
                    type: 'PLAY_CARD',
                    card,
                    covered:
                      !selected &&
                      covered &&
                      hand.completedTricks.length > 0 &&
                      hand.kind !== 'decisive',
                    ...(selected === 'boost' || selected === 'mask' ? { power: selected } : {}),
                  });
                cancel();
              }}
            >
              <CardFace card={card} />
            </button>
          ))}
      </section>
    </div>
  );
}
