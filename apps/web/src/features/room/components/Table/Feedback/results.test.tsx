import { afterEach, expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { RoomView } from '@truco/game-protocol';
import { StrictMode } from 'react';
import type { Action } from '../../../../../shared/transport/client';
import { playing } from '../index.test';
import { MatchResult } from './MatchResult';
import { RoundAnnouncement } from './RoundAnnouncement';
import { completedVictory, resultPerspective, resultTitle, roundResult } from './results';

const send = mock((_action: Action) => {});
const originalTimeout = window.setTimeout;
const originalClear = window.clearTimeout;
afterEach(() => {
  send.mockClear();
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

function finalRoom(base: RoomView, winner: 'A' | 'B' = 'A'): RoomView {
  if (!base.match) throw new Error('MISSING_MATCH');
  return {
    ...base,
    status: 'finished',
    deadline: null,
    decisionId: null,
    transition: undefined,
    outcome: { winner, reason: 'completed' },
    match: {
      ...base.match,
      phase: { type: 'MATCH_END', winner },
      score: winner === 'A' ? { A: 12, B: 6 } : { A: 6, B: 12 },
    },
  };
}

function roundRoom(base = playing(), winner: 'A' | 'B' | 'tie' = 'A'): RoomView {
  if (!base.match) throw new Error('MISSING_MATCH');
  return {
    ...base,
    transition: { id: 'trick_result', kind: 'trick', until: 1800 },
    decisionId: null,
    deadline: null,
    match: {
      ...base.match,
      hand: {
        ...base.match.hand,
        plays: [],
        completedTricks: [
          { leader: 0, plays: [], result: { winner, nextLeader: winner === 'B' ? 1 : 0 } },
        ],
      },
    },
  };
}

test('round outcome is relative to the viewer and distinguishes vaza, hand and draw', () => {
  const room = roundRoom();
  const view = render(<RoundAnnouncement room={room} />);
  expect(screen.getByText('VOCÊ VENCEU!')).toBeDefined();
  expect(screen.getByText('VAZA 1')).toBeDefined();
  const ribbon = view.container.querySelector('.round-announcement-ribbon');
  view.rerender(<RoundAnnouncement room={{ ...room, sequence: 15 }} />);
  expect(view.container.querySelector('.round-announcement-ribbon')).toBe(ribbon);
  view.rerender(<RoundAnnouncement room={{ ...room, selfSeat: 1 }} />);
  expect(screen.getByText('VOCÊ PERDEU')).toBeDefined();
  expect(view.container.querySelector('[data-result="lose"]')).not.toBeNull();
  view.rerender(<RoundAnnouncement room={roundRoom(playing(), 'tie')} />);
  expect(screen.getByText('EMPATE!')).toBeDefined();
  expect(view.container.querySelector('[data-result="tie"]')).not.toBeNull();
  if (!room.match) throw new Error('MISSING_MATCH');
  const hand = {
    ...room,
    transition: { id: 'hand_result', kind: 'hand' as const, until: 2400 },
    match: { ...room.match, phase: { type: 'HAND_END' as const, winner: 'A' as const, reward: 3 } },
  };
  view.rerender(<RoundAnnouncement room={hand} />);
  expect(screen.getByText('MÃO 2 · 3 PONTOS')).toBeDefined();
  view.rerender(
    <RoundAnnouncement
      room={{
        ...hand,
        match: { ...hand.match, phase: { type: 'HAND_END', winner: 'tie', reward: 0 } },
      }}
    />,
  );
  expect(screen.getByText('MÃO 2 · 0 PONTOS')).toBeDefined();
  for (const state of [
    playing(),
    { ...room, match: null },
    finalRoom(room),
    { ...room, transition: { id: 'deal', kind: 'deal' as const, until: 900 } },
  ]) {
    view.rerender(<RoundAnnouncement room={state} />);
    expect(view.container.querySelector('.round-announcement')).toBeNull();
  }
  expect(roundResult({ ...hand, match: room.match })).toBeNull();
  expect(
    roundResult({
      ...room,
      match: { ...room.match, hand: { ...room.match.hand, completedTricks: [] } },
    }),
  ).toBeNull();
});

test('each team member gets the corresponding team title; ties and no winner are neutral', () => {
  const base = playing();
  if (!base.match) throw new Error('MISSING_MATCH');
  const teamRoom = { ...base, match: { ...base.match, playerCount: 4 as const } };
  for (const seat of [0, 1, 2, 3]) {
    const room = { ...teamRoom, selfSeat: seat };
    expect(resultTitle(room, 'A', true)).toBe(
      seat % 2 === 0 ? 'SEU TIME VENCEU!!' : 'SEU TIME PERDEU',
    );
    expect(resultTitle(room, 'B', true)).toBe(
      seat % 2 === 1 ? 'SEU TIME VENCEU!!' : 'SEU TIME PERDEU',
    );
  }
  expect(resultPerspective(base, null)).toBe('tie');
  expect(resultPerspective(base, 'tie')).toBe('tie');
  expect(resultTitle(base, null)).toBe('PARTIDA ENCERRADA');
});

test('natural 12-point victory celebrates once, expires and preserves the final result', () => {
  const timers = clock();
  const room = playing();
  const finished = finalRoom(room);
  const view = render(<MatchResult send={send} room={room} />);
  expect(view.container.querySelector('.match-result-panel')).toBeNull();
  view.rerender(<MatchResult send={send} room={finished} />);
  expect(screen.getByRole('heading', { name: 'VOCÊ VENCEU!!' })).toBeDefined();
  expect(screen.getByText('PLACAR FINAL · A 12 × 6 B')).toBeDefined();
  expect(screen.getByText('Partida concluída por pontos')).toBeDefined();
  expect(document.querySelectorAll('.pixel-confetti')).toHaveLength(48);
  const first = document.querySelector('.pixel-confetti');
  expect(first?.getAttribute('style')).toContain('--confetti-color: #ffe29a');
  expect(timers.size).toBe(1);
  expect(document.querySelector('.match-end-layer')?.getAttribute('data-stage')).toBe(
    'celebration',
  );
  expect(screen.queryByRole('button')).toBeNull();
  fireEvent.keyDown(screen.getByLabelText('Resultado da partida'), { key: 'Tab' });
  const timer = [...timers.values()][0];
  expect(timer?.delay).toBe(5000);
  view.rerender(<MatchResult send={send} room={{ ...finished, sequence: 30 }} />);
  expect(document.querySelector('.pixel-confetti')).toBe(first);
  act(() => timer?.run());
  expect(document.querySelector('.pixel-confetti-layer')).toBeNull();
  expect(document.querySelector('.match-end-layer')?.getAttribute('data-stage')).toBe('menu');
  expect(screen.getByRole('dialog', { name: 'Resultado da partida' })).toBeDefined();
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'VOCÊ VENCEU!!' }));
  expect(screen.getAllByRole('button')).toHaveLength(3);
  view.rerender(<MatchResult send={send} room={{ ...finished, sequence: 31 }} />);
  expect(document.querySelector('.pixel-confetti-layer')).toBeNull();
  view.unmount();
  expect(timers.size).toBe(0);
  const restored = render(<MatchResult send={send} room={finished} />);
  expect(screen.getByRole('heading', { name: 'VOCÊ VENCEU!!' })).toBeDefined();
  expect(document.querySelector('.pixel-confetti-layer')).toBeNull();
  restored.unmount();
});

test('only the winning team celebrates; loss, abnormal outcomes and inconsistent completion never get confetti', () => {
  clock();
  const base = playing();
  if (!base.match) throw new Error('MISSING_MATCH');
  for (const seat of [0, 1, 2, 3]) {
    const room = { ...base, selfSeat: seat, match: { ...base.match, playerCount: 4 as const } };
    const view = render(<MatchResult send={send} room={room} />);
    const ended = finalRoom(room, 'B');
    view.rerender(<MatchResult send={send} room={ended} />);
    expect(within(view.baseElement).getByRole('heading').textContent).toBe(
      seat % 2 === 1 ? 'SEU TIME VENCEU!!' : 'SEU TIME PERDEU',
    );
    expect(document.querySelectorAll('.pixel-confetti')).toHaveLength(seat % 2 === 1 ? 48 : 0);
    view.unmount();
  }
  const ended = finalRoom(base);
  if (!ended.match) throw new Error('MISSING_MATCH');
  const variants: RoomView[] = [
    ...(['surrender', 'abandonment', 'expired', 'technical'] as const).map((reason) => ({
      ...ended,
      outcome: { winner: 'A' as const, reason },
    })),
    { ...ended, outcome: { winner: null, reason: 'technical' } },
    { ...ended, match: { ...ended.match, score: { A: 11, B: 6 } } },
    { ...ended, match: { ...ended.match, phase: { type: 'TURN', seat: 0 } } },
    { ...ended, match: null },
  ];
  for (const state of variants) {
    const view = render(<MatchResult send={send} room={base} />);
    view.rerender(<MatchResult send={send} room={state} />);
    expect(completedVictory(state)).toBe(false);
    expect(document.querySelector('.pixel-confetti-layer')).toBeNull();
    expect(within(view.baseElement).getByLabelText('Resultado da partida')).toBeDefined();
    view.unmount();
  }
});

test('rematch cancels confetti and an obsolete expiration cannot hide the next victory', () => {
  const timers = clock();
  const room = playing();
  const view = render(<MatchResult send={send} room={room} />);
  view.rerender(<MatchResult send={send} room={finalRoom(room)} />);
  const old = [...timers.values()][0];
  view.rerender(<MatchResult send={send} room={{ ...room, matchId: 'rematch_new' }} />);
  expect(document.querySelector('.pixel-confetti-layer')).toBeNull();
  expect(timers.size).toBe(0);
  view.rerender(<MatchResult send={send} room={finalRoom({ ...room, matchId: 'rematch_new' })} />);
  act(() => old?.run());
  expect(document.querySelectorAll('.pixel-confetti')).toHaveLength(48);
  view.unmount();
  expect(document.querySelector('.pixel-confetti-layer')).toBeNull();
  expect(timers.size).toBe(0);
});

test('losing and abnormal endings hold the result before showing actions, while initial snapshots skip the hold', () => {
  const timers = clock();
  const base = playing();
  const view = render(<MatchResult send={send} room={base} />);
  const ended = {
    ...finalRoom(base),
    outcome: { winner: 'B' as const, reason: 'surrender' as const },
  };
  view.rerender(<MatchResult send={send} room={ended} />);
  expect(screen.getByRole('heading', { name: 'VOCÊ PERDEU' })).toBeDefined();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(timers.size).toBe(1);
  const hold = [...timers.values()][0];
  view.rerender(<MatchResult send={send} room={{ ...ended, sequence: 20, hostSeat: 1 }} />);
  expect([...timers.values()][0]).toBe(hold);
  act(() => hold?.run());
  expect(screen.getByRole('dialog')).toBeDefined();
  view.unmount();
  render(<MatchResult send={send} room={ended} />);
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Sair da sala' })).toBeDefined();
  expect(timers.size).toBe(0);
});

test('React effect replay preserves the pending celebration and cancels retired timers', () => {
  const timers = clock();
  const base = playing();
  const view = render(
    <StrictMode>
      <MatchResult send={send} room={base} />
    </StrictMode>,
  );
  view.rerender(
    <StrictMode>
      <MatchResult send={send} room={finalRoom(base)} />
    </StrictMode>,
  );
  expect(timers.size).toBe(1);
  expect(screen.queryByRole('button')).toBeNull();
  const timer = [...timers.values()][0];
  act(() => timer?.run());
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(timers.size).toBe(0);
  view.unmount();
});
