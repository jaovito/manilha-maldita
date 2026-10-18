import { afterEach, expect, test } from 'bun:test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { RoomView } from '@truco/game-protocol';
import { StrictMode } from 'react';
import { Table } from '../..';
import { playing } from '../../index.test';
import { TurnAnnouncement } from './index';

const originalTimeout = window.setTimeout;
const originalClear = window.clearTimeout;
afterEach(() => {
  window.setTimeout = originalTimeout;
  window.clearTimeout = originalClear;
});

function clock() {
  let id = 0;
  const pending = new Map<number, { run: () => void; delay: number }>();
  Object.defineProperty(window, 'setTimeout', {
    configurable: true,
    writable: true,
    value: (run: () => void, delay: number) => {
      pending.set(++id, { run, delay });
      return id;
    },
  });
  Object.defineProperty(window, 'clearTimeout', {
    configurable: true,
    writable: true,
    value: (timer: number) => pending.delete(timer),
  });

  return pending;
}

function withTurn(base: RoomView, owner: number, plays = 0): RoomView {
  if (!base.match) throw new Error('MISSING_MATCH');

  return {
    ...base,
    decisionId: `turn_${owner}_${plays}`,
    match: {
      ...base.match,
      phase: { type: 'TURN', seat: owner },
      hand: {
        ...base.match.hand,
        plays: Array.from({ length: plays }, (_, seat) => ({ seat, covered: true as const })),
      },
    },
  };
}

test('own turn shows a timed central notice once; SYNC and re-render cannot extend or replay it', () => {
  const timers = clock();
  const room = withTurn(playing(), 0);
  const view = render(<TurnAnnouncement room={room} />);
  expect(screen.getByText('SUA VEZ!')).toBeDefined();
  expect(screen.getByText('A mesa é sua. Jogue uma carta.')).toBeDefined();
  expect(timers.size).toBe(1);
  const timeout = [...timers.values()][0];
  if (!timeout) throw new Error('MISSING_TIMER');
  expect(timeout.delay).toBe(2400);
  view.rerender(<TurnAnnouncement room={{ ...room, sequence: room.sequence + 1 }} />);
  expect(timers.size).toBe(1);
  act(() => timeout.run());
  expect(screen.queryByText('SUA VEZ!')).toBeNull();
  view.rerender(<TurnAnnouncement room={{ ...room, sequence: room.sequence + 2 }} />);
  expect(screen.queryByText('SUA VEZ!')).toBeNull();
  view.unmount();
  expect(timers.size).toBe(0);
});

test('React effect replay cancels the retired timer and keeps the dismissal scheduled', () => {
  const timers = clock();
  const view = render(
    <StrictMode>
      <TurnAnnouncement room={withTurn(playing(), 0)} />
    </StrictMode>,
  );
  expect(screen.getByText('SUA VEZ!')).toBeDefined();
  expect(timers.size).toBe(1);
  const timeout = [...timers.values()][0];
  act(() => timeout?.run());
  expect(screen.queryByText('SUA VEZ!')).toBeNull();
  view.unmount();
  expect(timers.size).toBe(0);
});

test('opponent, pause, transition, negotiation and end hide the notice without replaying the same turn', () => {
  const timers = clock();
  const room = withTurn(playing(), 0);
  const view = render(<TurnAnnouncement room={room} />);
  if (!room.match) throw new Error('MISSING_MATCH');
  const hidden: RoomView[] = [
    { ...room, paused: true },
    { ...room, transition: { id: 'present', kind: 'trick', until: 1800 } },
    { ...room, match: { ...room.match, phase: { type: 'RAISE_RESPONSE' } } },
    { ...room, status: 'finished' },
    { ...room, decisionId: null },
    { ...room, match: null },
    withTurn(room, 1),
  ];
  for (const state of hidden) {
    view.rerender(<TurnAnnouncement room={state} />);
    expect(screen.queryByText('SUA VEZ!')).toBeNull();
    expect(timers.size).toBe(0);
    view.rerender(<TurnAnnouncement room={{ ...room, decisionId: 'resumed_decision' }} />);
    expect(screen.queryByText('SUA VEZ!')).toBeNull();
  }
});

test('same seat starting a new vaza, new hand or rematch announces again; obsolete timers are harmless', () => {
  const timers = clock();
  const room = withTurn(playing(), 0);
  if (!room.match) throw new Error('MISSING_MATCH');
  const view = render(<TurnAnnouncement room={room} />);
  const old = [...timers.values()][0];
  const next: RoomView = {
    ...room,
    decisionId: 'next_vaza',
    match: {
      ...room.match,
      hand: {
        ...room.match.hand,
        completedTricks: [{ leader: 0, plays: [], result: { winner: 'A', nextLeader: 0 } }],
      },
    },
  };
  view.rerender(<TurnAnnouncement room={next} />);
  expect(screen.getByText('SUA VEZ!')).toBeDefined();
  expect(timers.size).toBe(1);
  act(() => old?.run());
  expect(screen.getByText('SUA VEZ!')).toBeDefined();
  for (const state of [
    { ...next, match: { ...room.match, hand: { ...room.match.hand, number: 3 } } },
    { ...room, matchId: 'rematch_new' },
  ]) {
    view.rerender(<TurnAnnouncement room={state} />);
    expect(screen.getByText('SUA VEZ!')).toBeDefined();
    expect(timers.size).toBe(1);
  }
  view.unmount();
  expect(timers.size).toBe(0);
});

test('a turn arriving from preparation announces; playing still sends immediately through Table', () => {
  clock();
  const room = withTurn(playing(), 0);
  if (!room.match) throw new Error('MISSING_MATCH');
  const actions: string[] = [];
  const view = render(
    <Table
      room={{ ...room, match: { ...room.match, phase: { type: 'PREPARATION' } } }}
      send={(action) => actions.push(action.type)}
    />,
  );
  expect(screen.queryByText('SUA VEZ!')).toBeNull();
  view.rerender(<Table room={room} send={(action) => actions.push(action.type)} />);
  expect(screen.getByText('SUA VEZ!')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  expect(actions).toEqual(['PLAY_CARD']);
  view.rerender(<Table room={withTurn(room, 1, 1)} send={() => {}} />);
  expect(screen.queryByText('SUA VEZ!')).toBeNull();
});
