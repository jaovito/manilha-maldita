import { afterEach, expect, mock, test } from 'bun:test';
import { GameAudio, type Sound } from './audio';

function gainNode() {
  return {
    gain: {
      setValueAtTime: mock(() => {}),
      linearRampToValueAtTime: mock((_value: number, _time: number) => {}),
      exponentialRampToValueAtTime: mock(() => {}),
    },
    connect: mock(() => {}),
    disconnect: mock(() => {}),
  };
}

function oscillatorNode() {
  return {
    type: 'sine',
    frequency: { setValueAtTime: mock((_frequency: number, _start: number) => {}) },
    connect: mock(() => {}),
    disconnect: mock(() => {}),
    start: mock(() => {}),
    stop: mock((_end: number) => {}),
    onended: null as (() => void) | null,
  };
}

export class TestAudioContext {
  static instances: TestAudioContext[] = [];
  static fail = false;
  currentTime = 2;
  state = 'running';
  destination = {};
  resume = mock(async () => {});
  close = mock(async () => {});
  gains: ReturnType<typeof gainNode>[] = [];
  oscillators: ReturnType<typeof oscillatorNode>[] = [];

  constructor() {
    if (TestAudioContext.fail) throw new Error('device unavailable');
    TestAudioContext.instances.push(this);
  }

  createGain() {
    const node = gainNode();
    this.gains.push(node);
    return node;
  }

  createOscillator() {
    const node = oscillatorNode();
    this.oscillators.push(node);
    return node;
  }
}

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
afterEach(() => {
  if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
  else Reflect.deleteProperty(globalThis, 'AudioContext');
  TestAudioContext.instances = [];
  TestAudioContext.fail = false;
});

export function installAudio() {
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: TestAudioContext,
  });
}

test('audio requires a gesture, respects mute/zero/suspension, and synthesizes every cue', () => {
  installAudio();
  const engine = new GameAudio();
  engine.play('click', { muted: false, volume: 1 });
  expect(TestAudioContext.instances).toHaveLength(0);
  engine.unlock();
  engine.unlock();
  expect(TestAudioContext.instances).toHaveLength(1);
  const context = TestAudioContext.instances[0];
  if (!context) throw new Error('missing context');
  engine.play('click', { muted: true, volume: 1 });
  engine.play('click', { muted: false, volume: 0 });
  context.state = 'suspended';
  engine.play('click', { muted: false, volume: 1 });
  expect(context.oscillators).toHaveLength(0);
  context.state = 'running';
  for (const sound of [
    'click',
    'menu',
    'select',
    'power',
    'turn',
    'deal',
    'result',
  ] satisfies Sound[])
    engine.play(sound, { muted: false, volume: 0.4 });
  expect(context.oscillators).toHaveLength(16);
  expect(context.oscillators[0]?.start).toHaveBeenCalledWith(2);
  context.oscillators[0]?.onended?.();
  expect(context.oscillators[0]?.disconnect).toHaveBeenCalledTimes(1);
  expect(context.gains[0]?.disconnect).toHaveBeenCalledTimes(1);
  engine.silence();
  expect(context.gains[1]?.disconnect).toHaveBeenCalledTimes(1);
  engine.close();
  engine.unlock();
  engine.play('click', { muted: false, volume: 1 });
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(TestAudioContext.instances).toHaveLength(1);
});

test('wins rise, losses descend, final fanfares last longer and draws stay neutral', () => {
  installAudio();
  const engine = new GameAudio();
  engine.unlock();
  const context = TestAudioContext.instances[0];
  if (!context) throw new Error('missing context');
  const frequencies: Record<string, number[]> = {};
  const endings: Record<string, number> = {};
  for (const sound of ['win', 'lose', 'matchWin', 'matchLose', 'tie'] satisfies Sound[]) {
    const start = context.oscillators.length;
    engine.play(sound, { muted: false, volume: 0.4 });
    const voices = context.oscillators.slice(start);
    frequencies[sound] = voices.map((voice) =>
      Number(voice.frequency.setValueAtTime.mock.calls[0]?.[0]),
    );
    endings[sound] = Number(voices.at(-1)?.stop.mock.calls[0]?.[0]);
    expect(voices.length).toBeGreaterThan(0);
  }
  expect(frequencies.win).toEqual([392, 494, 587]);
  expect(frequencies.lose).toEqual([392, 330, 262]);
  expect(frequencies.matchWin).toEqual([523, 659, 784]);
  expect(frequencies.matchLose).toEqual([392, 311, 196]);
  expect(frequencies.tie).toEqual([392, 392]);
  expect(endings.matchWin).toBeGreaterThan(endings.win ?? 0);
  expect(endings.matchLose).toBeGreaterThan(endings.lose ?? 0);
  engine.close();
});

test('unsupported or failing audio never blocks play and resumes may be rejected', async () => {
  Reflect.deleteProperty(globalThis, 'AudioContext');
  const engine = new GameAudio();
  engine.unlock();
  expect(() => engine.close()).not.toThrow();
  installAudio();
  TestAudioContext.fail = true;
  const failing = new GameAudio();
  expect(() => failing.unlock()).not.toThrow();
  TestAudioContext.fail = false;
  failing.unlock();
  const context = TestAudioContext.instances[0];
  if (!context) throw new Error('missing context');
  context.resume = mock(async () => {
    throw new Error('blocked');
  });
  failing.unlock();
  context.createOscillator = () => {
    throw new Error('device');
  };
  expect(() => failing.play('click', { muted: false, volume: 1 })).not.toThrow();
  context.close = mock(async () => {
    throw new Error('closed');
  });
  expect(() => failing.close()).not.toThrow();
  await Promise.resolve();
});

test('five original negotiation cues have different envelopes and restrained retro timbre', () => {
  installAudio();
  const engine = new GameAudio();
  engine.unlock();
  const context = TestAudioContext.instances[0];
  if (!context) throw new Error('missing context');
  const signatures: string[] = [];
  for (const sound of ['truco', 'six', 'nine', 'twelve', 'acceptRaise'] satisfies Sound[]) {
    const start = context.oscillators.length;
    engine.play(sound, { muted: false, volume: 1 });
    const notes = context.oscillators.slice(start);
    expect(notes.every((note) => note.type === 'sawtooth')).toBe(true);
    signatures.push(JSON.stringify(notes.map((note) => note.frequency.setValueAtTime.mock.calls)));
    expect(context.gains.at(-1)?.gain.linearRampToValueAtTime.mock.calls[0]?.[0]).toBe(0.055);
  }
  expect(new Set(signatures).size).toBe(5);
  engine.close();
});
