import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { Table } from '..';
import { powered } from './index.test';

test('only a confirmed use removes the power; rejected and pending commands preserve it, next hand restores it', () => {
  for (const power of ['spy', 'exchange', 'boost', 'mask'] as const) {
    const send = mock(() => {});
    const room = powered(power, power === 'spy' || power === 'exchange');
    if (!room.match.powers) throw new Error('NO_POWERS');
    const view = render(<Table room={room} send={send} />);
    const button = screen.getByRole('button', { name: /^Poder / });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: /^Poder / })).toBe(button);

    // A pending preparation or a rejected intention is not a consumed power.
    view.rerender(<Table room={{ ...room, decisionId: 'rejected' }} send={send} />);
    expect(screen.getByRole('button', { name: /^Poder / })).toBeDefined();
    const players = room.match.powers.players.map((p) => ({ ...p, ready: true }));
    view.rerender(
      <Table
        room={{ ...room, match: { ...room.match, powers: { ...room.match.powers, players } } }}
        send={send}
      />,
    );
    expect(screen.getByRole('button', { name: /^Poder / })).toBeDefined();

    view.rerender(
      <Table
        room={{
          ...room,
          match: {
            ...room.match,
            powers: {
              ...room.match.powers,
              players: players.map((p) =>
                p.seat === room.selfSeat ? { ...p, used: true, energy: 0 } : p,
              ),
            },
          },
        }}
        send={send}
      />,
    );
    expect(screen.queryByRole('button', { name: /^Poder / })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Detalhes do poder' })).toBeNull();
    expect(screen.getByLabelText('Energia 0 de 3')).toBeDefined();

    view.rerender(
      <Table
        room={{ ...room, match: { ...room.match, hand: { ...room.match.hand, number: 2 } } }}
        send={send}
      />,
    );
    expect(screen.getByRole('button', { name: /^Poder / })).toBeDefined();
    view.unmount();
  }
});
