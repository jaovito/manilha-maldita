import { expect, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { TableHistory } from '.';
import { playing } from '../index.test';

test('history expands and collapses with a stable accessible control and Escape', () => {
  const room = playing();
  if (!room.match) throw new Error('Missing fixture match');
  const view = render(<TableHistory room={room} match={room.match} />);
  const history = screen.getByRole('region', { name: 'Histórico da partida' });
  const toggle = screen.getByRole('button', { name: 'Expandir histórico' });
  const listId = toggle.getAttribute('aria-controls');
  if (!listId) throw new Error('Missing history control association');

  expect(history.getAttribute('data-expanded')).toBe('false');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(view.container.querySelector('ol')?.id).toBe(listId);
  fireEvent.click(toggle);
  expect(history.getAttribute('data-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: 'Recolher histórico' })).toBe(toggle);
  fireEvent.keyDown(toggle, { key: 'ArrowDown' });
  expect(history.getAttribute('data-expanded')).toBe('true');
  fireEvent.keyDown(toggle, { key: 'Escape' });
  expect(history.getAttribute('data-expanded')).toBe('false');
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(history.textContent).toContain('carta coberta');
});

test('history follows the end, preserves manual reading and resumes at the bottom', () => {
  const room = playing();
  if (!room.match) throw new Error('Missing fixture match');
  const match = room.match;
  const view = render(<TableHistory room={room} match={match} />);
  const list = view.container.querySelector('ol');
  if (!list) throw new Error('Missing history list');

  let height = 300;
  Object.defineProperties(list, {
    scrollHeight: { get: () => height },
    clientHeight: { value: 100 },
  });
  const update = () => view.rerender(<TableHistory room={room} match={{ ...match }} />);

  update();
  expect(list.scrollTop).toBe(300);
  list.scrollTop = 200;
  fireEvent.scroll(list);
  height = 400;
  update();
  expect(list.scrollTop).toBe(400);

  list.scrollTop = 45;
  fireEvent.scroll(list);
  height = 500;
  update();
  expect(list.scrollTop).toBe(45);
  update();
  expect(list.scrollTop).toBe(45);

  list.scrollTop = 399;
  fireEvent.scroll(list);
  height = 600;
  update();
  expect(list.scrollTop).toBe(600);

  list.scrollTop = 0;
  fireEvent.scroll(list);
  fireEvent.click(screen.getByRole('button', { name: 'Expandir histórico' }));
  expect(list.scrollTop).toBe(600);

  list.scrollTop = 0;
  fireEvent.scroll(list);
  view.rerender(
    <TableHistory room={room} match={{ ...match, hand: { ...match.hand, number: 3 } }} />,
  );
  expect(list.scrollTop).toBe(600);
});

test('Spy history reveals only the viewer intel and retains the observation after the card is played', () => {
  const base = playing();
  if (!base.match) throw new Error('Missing fixture match');
  const room = {
    ...base,
    config: { ...base.config, format: '2v2' as const },
    seats: Array.from({ length: 4 }, (_, seat) => ({
      seat,
      nickname: `Jogador ${seat + 1}`,
      connected: true,
      ready: false,
    })),
  };
  const powers = {
    players: [],
    activations: [
      { seat: 0, power: 'spy' as const, target: 1 },
      { seat: 2, power: 'spy' as const, target: 3 },
    ],
    intel: { target: 1, card: { rank: '3' as const, suit: 'clubs' as const } },
  };
  const match = {
    ...base.match,
    playerCount: 4 as const,
    powers,
    hand: { ...base.match.hand, plays: [] },
  };
  const view = render(<TableHistory room={room} match={match} />);
  const observation = 'Só você · Carta espiada: 3 de Paus ♣.';
  expect(screen.getByText(observation)).toBeDefined();
  expect(view.container.querySelectorAll('.history-spy-intel')).toHaveLength(1);

  // Target, partner and other opponent receive the same public activation but no private result.
  for (const selfSeat of [1, 2, 3]) {
    view.rerender(
      <TableHistory
        room={{ ...room, selfSeat }}
        match={{ ...match, seat: selfSeat, powers: { ...powers, intel: null } }}
      />,
    );
    expect(view.container.querySelectorAll('.power-reveal')).toHaveLength(2);
    expect(view.container.querySelector('.history-spy-intel')).toBeNull();
    expect(view.container.textContent).not.toContain('3 de Paus');
  }

  view.rerender(
    <TableHistory
      room={{ ...room, selfSeat: 2 }}
      match={{
        ...match,
        seat: 2,
        powers: { ...powers, intel: { target: 3, card: { rank: 'K', suit: 'diamonds' } } },
      }}
    />,
  );
  expect(screen.getByText('Só você · Carta espiada: K de Ouros ♦.')).toBeDefined();
  expect(view.container.textContent).not.toContain('3 de Paus');

  view.rerender(
    <TableHistory
      room={room}
      match={{
        ...match,
        hand: {
          ...match.hand,
          plays: [{ seat: 1, covered: false, card: powers.intel.card }],
        },
      }}
    />,
  );
  expect(screen.getByText(observation)).toBeDefined();

  // Correlate only the owner's activation and its authorized target.
  view.rerender(
    <TableHistory
      room={room}
      match={{ ...match, powers: { ...powers, intel: { ...powers.intel, target: 3 } } }}
    />,
  );
  expect(view.container.querySelector('.history-spy-intel')).toBeNull();

  view.rerender(
    <TableHistory
      room={room}
      match={{
        ...match,
        hand: { ...match.hand, number: match.hand.number + 1 },
        powers: { ...powers, activations: [], intel: null },
      }}
    />,
  );
  expect(view.container.querySelector('.history-spy-intel')).toBeNull();
  expect(view.container.textContent).not.toContain('3 de Paus');
});
