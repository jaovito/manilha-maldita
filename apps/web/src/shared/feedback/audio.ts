import type { AudioPreferences } from './preferences';

export type Sound =
  | 'click'
  | 'menu'
  | 'select'
  | 'power'
  | 'turn'
  | 'deal'
  | 'result'
  | 'win'
  | 'lose'
  | 'matchWin'
  | 'matchLose'
  | 'tie';
type Note = readonly [frequency: number, offset: number, duration: number];
const notes: Record<Sound, readonly Note[]> = {
  click: [[340, 0, 0.035]],
  menu: [
    [390, 0, 0.05],
    [520, 0.045, 0.07],
  ],
  select: [
    [240, 0, 0.035],
    [360, 0.025, 0.045],
  ],
  power: [
    [330, 0, 0.09],
    [495, 0.07, 0.1],
    [660, 0.14, 0.14],
  ],
  turn: [
    [523, 0, 0.09],
    [784, 0.11, 0.13],
  ],
  deal: [
    [200, 0, 0.045],
    [240, 0.1, 0.045],
    [280, 0.2, 0.045],
  ],
  result: [
    [392, 0, 0.12],
    [494, 0.12, 0.12],
    [587, 0.24, 0.18],
  ],
  win: [
    [392, 0, 0.12],
    [494, 0.12, 0.12],
    [587, 0.24, 0.18],
  ],
  lose: [
    [392, 0, 0.12],
    [330, 0.12, 0.12],
    [262, 0.24, 0.18],
  ],
  matchWin: [
    [523, 0, 0.2],
    [659, 0.2, 0.2],
    [784, 0.4, 0.4],
  ],
  matchLose: [
    [392, 0, 0.2],
    [311, 0.2, 0.2],
    [196, 0.4, 0.4],
  ],
  tie: [
    [392, 0, 0.09],
    [392, 0.15, 0.09],
  ],
};

/** A small original synthesizer; no remote audio, recordings or gameplay state. */
export class GameAudio {
  private context: AudioContext | null = null;
  private unlocked = false;
  private disposed = false;
  private active = new Set<GainNode>();

  unlock(): void {
    if (this.disposed) return;

    try {
      this.context ??= typeof AudioContext === 'undefined' ? null : new AudioContext();
      this.unlocked = this.context !== null;
      const resumed = this.context?.resume();
      void resumed?.catch(() => {});
    } catch {
      this.unlocked = false;
    }
  }

  play(sound: Sound, preferences: AudioPreferences): void {
    const context = this.context;
    if (
      !this.unlocked ||
      this.disposed ||
      !context ||
      context.state !== 'running' ||
      preferences.muted ||
      preferences.volume <= 0
    )
      return;

    try {
      for (const [frequency, offset, duration] of notes[sound]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + offset;
        oscillator.type = sound === 'deal' || sound === 'select' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(Math.min(preferences.volume, 1) * 0.13, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        this.active.add(gain);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          this.active.delete(gain);
        };
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
      }
    } catch {
      // Audio is optional; device and browser failures never reject an action.
    }
  }

  silence(): void {
    for (const gain of this.active) {
      try {
        gain.disconnect();
      } catch {
        // A removed device may already have disconnected the audio graph.
      }
    }
    this.active.clear();
  }

  close(): void {
    this.disposed = true;
    this.unlocked = false;
    this.silence();
    try {
      void this.context?.close().catch(() => {});
    } catch {
      // Browser shutdown can synchronously invalidate an existing context.
    }
    this.context = null;
  }
}
