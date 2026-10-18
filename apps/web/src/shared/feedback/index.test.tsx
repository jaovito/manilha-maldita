import { afterEach, expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { AudioControls, useGameFeedback } from './index';
import { AUDIO_PREFERENCES_KEY } from './preferences';

class Context {
  static instances: Context[] = [];
  currentTime = 0;
  state = 'running';
  destination = {};
  resume = mock(async () => {});
  close = mock(async () => {});
  start = mock(() => {});
  disconnect = mock(() => {});

  constructor() {
    Context.instances.push(this);
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime() {} },
      connect() {},
      disconnect() {},
      onended: null,
      start: this.start,
      stop() {},
    };
  }

  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect: this.disconnect,
    };
  }
}

const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
afterEach(() => {
  if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor);
  else Reflect.deleteProperty(globalThis, 'AudioContext');
  if (visibilityDescriptor)
    Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
  else Reflect.deleteProperty(document, 'visibilityState');
  Context.instances = [];
});

function room(sequence: number, finished = false): RoomView {
  return {
    code: 'ABC123',
    sequence,
    roomRevision: 0,
    status: finished ? 'finished' : 'playing',
    hostSeat: 0,
    selfSeat: 0,
    seats: [],
    config: defaultRoomConfig,
    matchId: 'match_one',
    decisionId: null,
    deadline: null,
    paused: false,
    outcome: null,
    match: {
      revision: sequence,
      seat: 0,
      playerCount: 2,
      score: { A: 0, B: 0 },
      phase: finished ? { type: 'MATCH_END', winner: 'A' } : { type: 'TURN', seat: 1 },
      hand: {
        number: 1,
        kind: 'normal',
        leader: 0,
        elevenTeam: null,
        trickLeader: 0,
        vira: { rank: '4', suit: 'clubs' },
        hands: [],
        plays: [],
        completedTricks: [],
        betting: {
          acceptedStake: 1,
          pendingStake: null,
          lastRaisingTeam: null,
          resumeTurnSeat: null,
        },
      },
    },
  };
}

test('accessible sound controls update mute and bounded volume independently', () => {
  const change = mock(() => {});
  const { rerender } = render(
    <AudioControls preferences={{ muted: false, volume: 0.35 }} onChange={change} />,
  );
  expect(screen.getByLabelText('Configurações de som').tagName).toBe('SUMMARY');
  fireEvent.click(screen.getByLabelText('Efeitos sonoros'));
  expect(change).toHaveBeenLastCalledWith({ muted: true, volume: 0.35 });
  fireEvent.change(screen.getByLabelText('Volume dos efeitos sonoros'), {
    target: { value: '100' },
  });
  expect(change).toHaveBeenLastCalledWith({ muted: false, volume: 1 });
  rerender(<AudioControls preferences={{ muted: true, volume: 0 }} onChange={change} />);
  expect(screen.getByText('0%')).toBeDefined();
  const toggle = screen.getByLabelText('Efeitos sonoros');
  expect(toggle instanceof HTMLInputElement && toggle.checked).toBe(false);
});

test('feedback hook unlocks by pointer/keyboard, observes confirmed results and cleans up', () => {
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  let feedback: ReturnType<typeof useGameFeedback> | null = null;
  function Harness() {
    feedback = useGameFeedback();
    return (
      <>
        <AudioControls preferences={feedback.preferences} onChange={feedback.changePreferences} />
        <button type="button">Entrar</button>
      </>
    );
  }
  const { unmount } = render(<Harness />);
  expect(Context.instances).toHaveLength(0);
  fireEvent.keyDown(document, { key: 'ArrowDown' });
  expect(Context.instances).toHaveLength(0);
  fireEvent.pointerDown(document);
  fireEvent.keyDown(document, { key: 'Enter' });
  fireEvent.keyDown(document, { key: ' ' });
  const context = Context.instances[0];
  if (!context || !feedback) throw new Error('missing feedback');
  const current: ReturnType<typeof useGameFeedback> = feedback;
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(context.start).toHaveBeenCalledTimes(1);
  act(() => {
    current.observe(room(1));
    current.observe(room(2, true));
    current.observe(room(2, true));
  });
  expect(context.start).toHaveBeenCalledTimes(4);
  fireEvent.click(screen.getByLabelText('Efeitos sonoros'));
  expect(JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) ?? '{}')).toEqual({
    muted: true,
    volume: 0.35,
  });
  expect(context.disconnect).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(context.start).toHaveBeenCalledTimes(4);
  fireEvent.click(screen.getByLabelText('Efeitos sonoros'));
  fireEvent.change(screen.getByLabelText('Volume dos efeitos sonoros'), { target: { value: '0' } });
  expect(JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) ?? '{}').volume).toBe(0);
  current.reset();
  act(() => current.observe(room(3)));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  fireEvent(document, new Event('visibilitychange'));
  act(() => current.observe(room(4, true)));
  expect(context.start).toHaveBeenCalledTimes(4);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  fireEvent(document, new Event('visibilitychange'));
  unmount();
  fireEvent.pointerDown(document);
  fireEvent.keyDown(document, { key: 'Enter' });
  fireEvent.click(document);
  fireEvent(document, new Event('visibilitychange'));
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(context.resume).toHaveBeenCalledTimes(7);
});
