import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { Table } from '..';
import { powered } from '../Powers/index.test';

test('boost targets only eligible cards in the actual hand and submits the effect with that card', () => {
  const state = powered('boost', false);
  state.match = {
    ...state.match,
    hand: {
      ...state.match.hand,
      hands: [
        {
          seat: 0,
          count: 3,
          visibility: 'visible',
          cards: [
            { rank: '3', suit: 'hearts' },
            { rank: 'J', suit: 'clubs' },
            { rank: '4', suit: 'diamonds' },
          ],
        },
        { seat: 1, count: 3, visibility: 'hidden' },
      ],
    },
  };
  const send = mock(() => {});
  render(<Table room={state} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poder Impulso' }));
  expect((screen.getByRole('button', { name: '3 de Copas ♥' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect((screen.getByRole('button', { name: 'J de Paus ♣' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  const target = screen.getByRole('button', { name: '4 de Ouros ♦' });
  expect((target as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(target);
  expect(send).toHaveBeenLastCalledWith({
    type: 'PLAY_CARD',
    card: { rank: '4', suit: 'diamonds' },
    covered: false,
    power: 'boost',
  });
  expect(screen.queryByRole('button', { name: 'Cancelar seleção do poder' })).toBeNull();
});
