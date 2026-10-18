import { expect, mock, test } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import { Table } from '..';
import { powered } from '../Powers/index.test';

test('turn marker accompanies the own avatar only during an actionable own turn', () => {
  const room = powered('mask', false);
  const send = mock(() => {});
  const view = render(<Table room={room} send={send} />);
  const own = document.querySelector('.own-player');
  if (!own) throw new Error('MISSING_AVATAR');
  expect(within(own as HTMLElement).getByText('Sua vez')).toBeDefined();
  expect(screen.getByLabelText('Status da partida').textContent).toContain('Sua vez');
  expect(screen.queryByText('JOGAR CARTA')).toBeNull();

  for (const state of [
    { ...room, paused: true },
    { ...room, status: 'finished' as const },
    { ...room, match: { ...room.match, phase: { type: 'TURN' as const, seat: 1 } } },
    { ...room, match: { ...room.match, phase: { type: 'PREPARATION' as const } } },
    { ...room, match: { ...room.match, phase: { type: 'RAISE_RESPONSE' as const } } },
  ]) {
    view.rerender(<Table room={state} send={send} />);
    expect(document.querySelector('.own-player .turn-badge')).toBeNull();
  }
});
