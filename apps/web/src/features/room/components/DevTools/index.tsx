import { t, localized } from '../../../../shared/i18n';
import { useState } from 'react';
import { cardSchema, powerSchema, type Action, type RoomView } from '@truco/game-protocol';
import './styles.css';

const ranks = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
const suits = cardSchema.shape.suit.options;
const suitLabels = localized({
  diamonds: 'Ouros ♦',
  spades: 'Espadas ♠',
  hearts: 'Copas ♥',
  clubs: 'Paus ♣',
});
const powerLabels = localized({
  spy: 'Espião',
  exchange: 'Segunda Chance',
  boost: 'Impulso',
  mask: 'Máscara',
});

export default function DevTools({
  room,
  send,
  connected,
}: {
  room: RoomView;
  send: (action: Action) => void;
  connected: boolean;
}) {
  const hand = room.match?.hand.hands[room.selfSeat];
  const [cards, setCards] = useState(() =>
    [0, 1, 2].map((index) => {
      const card = hand?.visibility === 'visible' ? hand.cards[index] : undefined;
      return card ? `${card.rank}:${card.suit}` : `${ranks[index]}:clubs`;
    }),
  );
  const [power, setPower] = useState<string>(
    () => room.match?.powers?.players[room.selfSeat]?.power ?? 'spy',
  );
  const [energy, setEnergy] = useState(3);
  const duplicate = new Set(cards).size !== 3;
  const special = room.match?.hand.kind !== 'normal';
  const disabled = !connected || room.status !== 'playing';

  return (
    <details className="dev-tools">
      <summary>{t('Ferramentas de desenvolvimento')}</summary>
      <p>
        {t(
          'Somente nesta mesa solo de desenvolvimento. Aplicar reinicia a mão, mantém o placar e limpa jogadas e poderes usados. O jogo continua enquanto este painel está aberto.',
        )}
      </p>
      <fieldset disabled={disabled}>
        <legend>{t('Sua mão de teste')}</legend>
        {cards.map((value, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Three fixed slots, never reordered.
          <label key={index}>
            {t('Carta')} {index + 1}
            <select
              aria-label={t('Carta {0}', [index + 1])}
              value={value}
              onChange={(event) =>
                setCards(cards.map((card, slot) => (slot === index ? event.target.value : card)))
              }
            >
              {ranks.flatMap((rank) =>
                suits.map((suit) => (
                  <option key={`${rank}:${suit}`} value={`${rank}:${suit}`}>
                    {rank} · {suitLabels[suit]}
                  </option>
                )),
              )}
            </select>
          </label>
        ))}
        <label>
          {t('Poder de teste')}
          <select
            aria-label={t('Poder de teste')}
            value={power}
            disabled={special}
            onChange={(event) => setPower(event.target.value)}
          >
            {powerSchema.options.map((id) => (
              <option key={id} value={id}>
                {powerLabels[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Energia de teste')}
          <select
            aria-label={t('Energia de teste')}
            value={energy}
            onChange={(event) => setEnergy(Number(event.target.value))}
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {special && <p>{t('Mãos de onze e 11×11 mantêm os poderes desativados.')}</p>}
        {duplicate && <p role="alert">{t('Escolha três cartas diferentes.')}</p>}
        <button
          type="button"
          disabled={duplicate}
          onClick={() =>
            send({
              type: 'DEV_RESET_HAND',
              energy,
              ...(special ? {} : { power: powerSchema.parse(power) }),
              cards: cards.map((value) => {
                const [rank, suit] = value.split(':');
                return cardSchema.parse({ rank, suit });
              }),
            })
          }
        >
          {t('Aplicar cenário e reiniciar mão')}
        </button>
        <button type="button" onClick={() => send({ type: 'DEV_RESET_HAND' })}>
          {t('Reiniciar mão aleatória')}
        </button>
      </fieldset>
    </details>
  );
}
