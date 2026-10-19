import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { Table } from '..';
import { playing } from '../index.test';
import { envelope } from '../../../../../shared/transport/client';

export function powered(
  power: 'spy' | 'exchange' | 'boost' | 'mask',
  prep = true,
): RoomView & { match: MatchView } {
  const room = playing();
  if (!room.match) throw new Error('NO_MATCH');
  return {
    ...room,
    seats: [
      { seat: 0, nickname: 'Ana', connected: true, ready: false },
      { seat: 1, nickname: 'Bia', connected: true, ready: false },
    ],
    match: {
      ...room.match,
      phase: prep ? { type: 'PREPARATION' } : { type: 'TURN', seat: 0 },
      hand: { ...room.match.hand, plays: [] },
      powers: {
        players: [
          { seat: 0, power, energy: 2, used: false, ready: false },
          { seat: 1, power: null, energy: 2, used: false, ready: false },
        ],
        activations: [],
        intel: null,
      },
    },
  };
}

test('spy and exchange seal a single explicit choice or pass; waiting and unaffordable states stay disabled', () => {
  const send = mock(() => {});
  const state = powered('spy');
  const view = render(<Table room={state} send={send} />);
  expect(
    screen.queryByRole('checkbox', { name: 'Jogar coberta (a partir da segunda vaza)' }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: 'Espionar carta 2 de Bia' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Poder Espião' }));
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Detalhes do poder' })).toBeNull();
  expect(screen.getByText('Espião · Escolha um verso adversário.')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Espionar carta 2 de Bia' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'PREPARE', intent: { type: 'spy', target: 1 } });
  expect(screen.queryByRole('button', { name: 'Espionar carta 2 de Bia' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Passar preparação' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'PREPARE', intent: { type: 'pass' } });
  expect(envelope(state, { type: 'PREPARE', intent: { type: 'pass' } })).toMatchObject({
    decisionId: state.decisionId,
    expectedRevision: state.match.revision,
  });
  const exchanged = powered('exchange');
  view.rerender(<Table room={exchanged} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poder Segunda Chance' }));
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  expect(send).toHaveBeenLastCalledWith({
    type: 'PREPARE',
    intent: { type: 'exchange', card: { rank: '3', suit: 'hearts' } },
  });
  if (!exchanged.match.powers) throw new Error('NO_POWERS');
  view.rerender(
    <Table
      room={{
        ...exchanged,
        match: {
          ...exchanged.match,
          powers: {
            ...exchanged.match.powers,
            players: exchanged.match.powers.players.map((p) => ({ ...p, ready: true })),
          },
        },
      }}
      send={send}
    />,
  );
  expect(screen.getByLabelText('Intenção confirmada. Aguardando os demais.')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Confirmar poder' })).toBeNull();
  view.rerender(<Table room={{ ...exchanged, paused: true }} send={send} />);
  expect(
    (screen.getByRole('button', { name: 'Passar preparação' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

test('turn power selection accompanies card atomically, resets on decision, blocks boost cap and shows private intel and mask marker', () => {
  const send = mock(() => {});
  const state = powered('mask', false);
  const view = render(<Table room={state} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poder Máscara' }));
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  expect(send).toHaveBeenLastCalledWith({
    type: 'PLAY_CARD',
    card: { rank: '3', suit: 'hearts' },
    covered: false,
    power: 'mask',
  });
  view.rerender(<Table room={{ ...state, decisionId: 'other' }} send={send} />);
  expect(screen.getByRole('button', { name: 'Poder Máscara' }).getAttribute('aria-pressed')).toBe(
    'false',
  );
  const boost = { ...powered('boost', false), decisionId: 'boost_turn' };
  view.rerender(<Table room={boost} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poder Impulso' }));
  expect(screen.getByText('Impulso · Sem carta válida.')).toBeDefined();
  expect((screen.getByRole('button', { name: '3 de Copas ♥' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  if (!state.match.powers) throw new Error('NO_POWERS');
  view.rerender(
    <Table
      room={{
        ...state,
        match: {
          ...state.match,
          powers: {
            ...state.match.powers,
            players: state.match.powers.players.map((player) =>
              player.seat === 0 ? { ...player, power: 'spy', used: true, ready: true } : player,
            ),
            intel: { target: 1, card: { rank: 'A', suit: 'clubs' } },
            activations: [{ seat: 1, power: 'mask', target: 1 }],
          },
          hand: { ...state.match.hand, plays: [{ seat: 1, covered: false, power: 'mask' }] },
        },
      }}
      send={send}
    />,
  );
  expect(screen.getByRole('img', { name: 'Carta mascarada' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Poder Espião' })).toBeNull();
  expect(screen.getByRole('note', { name: /Memória do Espião/ })).toBeDefined();
});

test('active power selection cancels by Escape or button without spending, while inactive details restore focus', () => {
  const send = mock(() => {});
  const state = powered('spy');
  const view = render(<Table room={state} send={send} />);
  const card = screen.getByRole('button', { name: 'Poder Espião' });
  fireEvent.click(card);
  expect(card.getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Espionar carta 1 de Bia' }), {
    key: 'Escape',
  });
  expect(card.getAttribute('aria-pressed')).toBe('false');
  expect(document.activeElement).toBe(card);
  fireEvent.click(card);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar seleção do poder' }));
  expect(card.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(card);
  view.rerender(<Table room={{ ...state, paused: true }} send={send} />);
  expect(card.getAttribute('aria-pressed')).toBe('false');
  view.rerender(<Table room={state} send={send} />);
  expect(card.getAttribute('aria-pressed')).toBe('false');

  view.rerender(<Table room={{ ...state, paused: true }} send={send} />);
  fireEvent.click(card);
  expect(screen.getByRole('region', { name: 'Detalhes do poder' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes do poder' }));
  expect(document.activeElement).toBe(card);
  fireEvent.click(card);
  fireEvent.keyDown(card, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Detalhes do poder' })).toBeNull();
  fireEvent.click(card);
  view.rerender(<Table room={{ ...state, decisionId: 'next' }} send={send} />);
  expect(screen.queryByRole('region', { name: 'Detalhes do poder' })).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

test('unaffordable, used, paused, special and off-turn powers never select a gameplay activation', () => {
  const send = mock(() => {});
  const state = powered('mask', false);
  if (!state.match.powers) throw new Error('NO_POWERS');
  const view = render(<Table room={state} send={send} />);
  const variants: RoomView[] = [
    { ...state, paused: true },
    { ...state, status: 'finished' },
    { ...state, match: { ...state.match, phase: { type: 'RAISE_RESPONSE' } } },
    {
      ...state,
      match: {
        ...state.match,
        powers: {
          ...state.match.powers,
          players: state.match.powers.players.map((p) => ({ ...p, energy: 0 })),
        },
      },
    },
  ];
  for (const room of variants) {
    view.rerender(<Table room={room} send={send} />);
    const card = screen.getByRole('button', { name: 'Poder Máscara' });
    fireEvent.click(card);
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(card.getAttribute('data-can-activate')).toBe('false');
  }
  const special = {
    ...state,
    match: {
      ...state.match,
      powers: {
        ...state.match.powers,
        players: state.match.powers.players.map((p) => ({ ...p, power: null })),
      },
    },
  };
  view.rerender(<Table room={special} send={send} />);
  expect(screen.queryByRole('button', { name: /^Poder / })).toBeNull();
  expect(screen.getByText('Sem poderes nesta mão')).toBeDefined();
  expect(send).not.toHaveBeenCalled();
});

test('other players have an unknown power until activation and a new hand hides their next assignment', () => {
  const state = powered('spy', false);
  const view = render(<Table room={state} send={mock(() => {})} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poder Espião' }));
  fireEvent.click(screen.getByText('Poderes revelados'));
  expect(screen.getByText('Bia: Poder oculto · 2/3')).toBeDefined();
  expect(screen.queryByText(/Bia: Máscara/)).toBeNull();
  if (!state.match.powers) throw new Error('NO_POWERS');

  const activated = {
    ...state,
    match: {
      ...state.match,
      powers: {
        ...state.match.powers,
        players: state.match.powers.players.map((player) =>
          player.seat === 1 ? { ...player, power: 'mask' as const, used: true, energy: 1 } : player,
        ),
        activations: [{ seat: 1, power: 'mask' as const, target: 1 }],
      },
    },
  };
  view.rerender(<Table room={activated} send={mock(() => {})} />);
  expect(screen.getByText('Bia: Máscara · 1/3 · usado')).toBeDefined();
  expect(screen.getByText('Bia ativou Máscara em Bia.')).toBeDefined();

  view.rerender(<Table room={{ ...state, decisionId: 'next_hand' }} send={mock(() => {})} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poder Espião' }));
  expect(screen.getByText('Bia: Poder oculto · 2/3')).toBeDefined();
  expect(screen.queryByText('Bia: Máscara · 1/3 · usado')).toBeNull();
});
