import { expect, mock, test } from 'bun:test';
import { ResultAudio } from './result-audio';
import { resultRoom } from './tests/result-fixture';

function timers() {
  const originalSet = window.setTimeout;
  const originalClear = window.clearTimeout;
  let sequence = 0;
  const pending = new Map<number, () => void>();
  Object.defineProperty(window, 'setTimeout', {
    configurable: true,
    value: (callback: () => void, delay: number) => {
      expect(delay).toBe(1800);
      pending.set(++sequence, callback);
      return sequence;
    },
  });
  Object.defineProperty(window, 'clearTimeout', {
    configurable: true,
    value: (id: number) => pending.delete(id),
  });
  return {
    pending,
    restore() {
      Object.defineProperty(window, 'setTimeout', { configurable: true, value: originalSet });
      Object.defineProperty(window, 'clearTimeout', { configurable: true, value: originalClear });
    },
  };
}

test('music starts when the result title appears, without rescheduling on duplicate snapshots', () => {
  const clock = timers();
  try {
    const play = mock(() => {});
    const audio = new ResultAudio(play);
    const room = resultRoom();
    audio.observe(room, ['matchWin']);
    audio.observe(room, []);
    expect(play).not.toHaveBeenCalled();
    expect(clock.pending.size).toBe(1);
    const callback = clock.pending.values().next().value;
    callback?.();
    expect(play).toHaveBeenCalledWith('matchWin');
    audio.cancel();
    audio.observe({ ...room, outcome: { reason: 'surrender', winner: 'B' } }, ['matchLose']);
    expect(play).toHaveBeenCalledWith('matchLose');
    audio.observe(room, ['click']);
    expect(play).toHaveBeenCalledWith('click');
  } finally {
    clock.restore();
  }
});

test('navigation, a new match and explicit cancellation retire pending music', () => {
  const clock = timers();
  try {
    const play = mock(() => {});
    const audio = new ResultAudio(play);
    const room = resultRoom();
    for (const replacement of [
      { ...room, status: 'playing' as const },
      { ...room, matchId: 'next' },
      { ...room, code: 'DEF456' },
    ]) {
      audio.observe(room, ['matchLose']);
      audio.observe(replacement, []);
      expect(clock.pending.size).toBe(0);
    }
    audio.observe(room, ['matchWin']);
    audio.cancel();
    expect(clock.pending.size).toBe(0);
    expect(play).not.toHaveBeenCalled();
  } finally {
    clock.restore();
  }
});
