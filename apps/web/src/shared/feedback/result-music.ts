import type { AudioPreferences } from './preferences';

type Cue = 'matchWin' | 'matchLose';
const assets: Record<Cue, string> = {
  matchWin: '/audio/match-victory.mp3',
  matchLose: '/audio/match-defeat.mp3',
};

/** Local decoded clips share the gesture-unlocked context with the original synthesizer. */
export class ResultMusic {
  private buffers = new Map<Cue, AudioBuffer>();
  private loading: Promise<void> | undefined;
  private abort = new AbortController();
  private disposed = false;
  private active: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor(private readonly context: AudioContext) {}

  preload(): Promise<void> {
    if (this.disposed) return Promise.resolve();

    this.loading ??= Promise.allSettled(
      (Object.keys(assets) as Cue[]).map(async (cue) => {
        const response = await fetch(assets[cue], { signal: this.abort.signal });
        if (!response.ok) return;

        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        if (
          !this.disposed &&
          Number.isFinite(buffer.duration) &&
          buffer.duration > 0 &&
          buffer.duration <= 4
        )
          this.buffers.set(cue, buffer);
      }),
    ).then(() => {});

    return this.loading;
  }

  play(cue: Cue, preferences: AudioPreferences): boolean {
    const buffer = this.buffers.get(cue);
    if (
      this.disposed ||
      !buffer ||
      preferences.muted ||
      preferences.volume <= 0 ||
      this.context.state !== 'running'
    )
      return false;

    this.silence();
    try {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(Math.min(preferences.volume, 1), this.context.currentTime);
      source.connect(gain);
      gain.connect(this.context.destination);
      const playback = { source, gain };
      this.active = playback;
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          /* A retired device may invalidate its nodes. */
        }
        if (this.active === playback) this.active = null;
      };
      source.start();

      return true;
    } catch {
      this.silence();
      return false;
    }
  }

  updatePreferences(preferences: AudioPreferences): void {
    if (preferences.muted || preferences.volume <= 0) this.silence();
    else {
      try {
        this.active?.gain.gain.setValueAtTime(
          Math.min(preferences.volume, 1),
          this.context.currentTime,
        );
      } catch {
        this.silence();
      }
    }
  }

  silence(): void {
    const playback = this.active;
    this.active = null;
    if (!playback) return;

    try {
      playback.source.stop();
    } catch {
      /* A completed source can already be stopped. */
    }
    try {
      playback.source.disconnect();
      playback.gain.disconnect();
    } catch {
      /* Audio devices may disappear. */
    }
  }

  close(): void {
    this.disposed = true;
    this.abort.abort();
    this.silence();
    this.buffers.clear();
  }
}
