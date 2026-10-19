import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Action } from '@truco/game-protocol';
import { raiseRoom } from '../../../../shared/feedback/raises.test';
import DevTools from './index';

test('development form builds a validated scenario, rejects duplicate cards and offers a random reset', () => {
  const send = mock((_action: Action) => {});
  const room = raiseRoom();
  if (!room.match) throw new Error('Missing match');
  room.match.hand.hands = [
    { seat: 0, count: 1, visibility: 'visible', cards: [{ rank: 'A', suit: 'hearts' }] },
  ];
  const view = render(<DevTools room={room} send={send} connected />);
  fireEvent.click(screen.getByText('Ferramentas de desenvolvimento'));
  expect(screen.getByLabelText<HTMLSelectElement>('Carta 1').value).toBe('A:hearts');
  fireEvent.change(screen.getByLabelText('Carta 2'), { target: { value: 'A:hearts' } });
  expect(screen.getByRole('alert').textContent).toContain('diferentes');
  expect(
    screen
      .getByRole('button', { name: 'Aplicar cenário e reiniciar mão' })
      .hasAttribute('disabled'),
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Carta 2'), { target: { value: '3:clubs' } });
  fireEvent.change(screen.getByLabelText('Poder de teste'), { target: { value: 'exchange' } });
  fireEvent.change(screen.getByLabelText('Energia de teste'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar cenário e reiniciar mão' }));
  expect(send).toHaveBeenLastCalledWith({
    type: 'DEV_RESET_HAND',
    power: 'exchange',
    energy: 2,
    cards: [
      { rank: 'A', suit: 'hearts' },
      { rank: '3', suit: 'clubs' },
      { rank: '6', suit: 'clubs' },
    ],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reiniciar mão aleatória' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'DEV_RESET_HAND' });
  room.match.hand.kind = 'eleven';
  view.rerender(<DevTools room={room} send={send} connected />);
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar cenário e reiniciar mão' }));
  expect(send.mock.calls.at(-1)?.[0]).not.toHaveProperty('power');
  view.rerender(<DevTools room={room} send={send} connected={false} />);
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
});
