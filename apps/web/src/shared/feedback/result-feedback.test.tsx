import { expect, spyOn, test } from 'bun:test';
import { act, fireEvent, render } from '@testing-library/react';
import { GameAudio } from './audio';
import { useGameFeedback } from './index';
import { resultRoom } from './tests/result-fixture';

test('feedback cancels queued music on mute, hidden tabs, navigation and unmount; latest volume wins', () => {
  const originalSet = window.setTimeout;
  const originalClear = window.clearTimeout;
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const pending = new Map<number, () => void>();
  let serial = 0;
  Object.defineProperty(window, 'setTimeout', {
    configurable: true,
    value: (callback: () => void, delay: number) => {
      if (delay !== 1800) return originalSet.call(window, callback, delay);
      pending.set(++serial, callback);
      return serial;
    },
  });
  Object.defineProperty(window, 'clearTimeout', {
    configurable: true,
    value: (id: number) => {
      if (!pending.delete(id)) originalClear.call(window, id);
    },
  });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  const play = spyOn(GameAudio.prototype, 'play').mockImplementation(() => {});
  let feedback: ReturnType<typeof useGameFeedback> | null = null;
  function Harness() {
    feedback = useGameFeedback();
    return null;
  }
  const view = render(<Harness />);
  if (!feedback) throw new Error('MISSING_FEEDBACK');
  const current: ReturnType<typeof useGameFeedback> = feedback;
  const queue = (id: string) => {
    const finished = { ...resultRoom(), matchId: id };
    if (!finished.match) throw new Error('MISSING_MATCH');
    current.observe({
      ...finished,
      sequence: 1,
      status: 'playing',
      outcome: null,
      match: {
        ...finished.match,
        phase: { type: 'TURN', seat: 0 },
        hand: { ...finished.match.hand, completedTricks: [] },
      },
    });
    current.observe(finished);
  };

  try {
    act(() => queue('first'));
    expect(pending.size).toBe(1);
    act(() => current.changePreferences({ muted: false, volume: 0.1 }));
    const callback = pending.values().next().value;
    pending.clear();
    act(() => callback?.());
    expect(play).toHaveBeenCalledWith('matchWin', { muted: false, volume: 0.1 });

    act(() => queue('muted'));
    act(() => current.changePreferences({ muted: true, volume: 0.1 }));
    expect(pending.size).toBe(0);
    act(() => current.changePreferences({ muted: false, volume: 0.1 }));
    expect(pending.size).toBe(0);

    act(() => queue('hidden'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));
    expect(pending.size).toBe(0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => queue('navigation'));
    act(() => current.reset());
    expect(pending.size).toBe(0);
    act(() => queue('unmount'));
    view.unmount();
    expect(pending.size).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    play.mockRestore();
    Object.defineProperty(window, 'setTimeout', { configurable: true, value: originalSet });
    Object.defineProperty(window, 'clearTimeout', { configurable: true, value: originalClear });
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
    else Reflect.deleteProperty(document, 'visibilityState');
  }
});
