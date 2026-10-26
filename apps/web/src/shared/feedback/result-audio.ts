import type { RoomView } from '@truco/game-protocol';
import { MATCH_RESULT_READING_MS } from '../match-presentation';
import type { Sound } from './audio';

/** Align the cue with the title after the final trick's reading interval. */
export class ResultAudio {
  private pending: { timer: number; matchId: string | null; code: string } | null = null;

  constructor(private readonly play: (sound: Sound) => void) {}

  observe(room: RoomView, sounds: readonly Sound[]): void {
    if (
      this.pending &&
      (room.matchId !== this.pending.matchId ||
        room.code !== this.pending.code ||
        room.status !== 'finished')
    )
      this.cancel();

    for (const sound of sounds) {
      const reading =
        (sound === 'matchWin' || sound === 'matchLose') &&
        room.outcome?.reason === 'completed' &&
        (room.match?.hand.completedTricks.at(-1)?.plays.length ?? 0) > 0;
      if (!reading) {
        this.play(sound);
        continue;
      }

      this.cancel();
      const timer = window.setTimeout(() => {
        this.pending = null;
        this.play(sound);
      }, MATCH_RESULT_READING_MS);
      this.pending = { timer, matchId: room.matchId, code: room.code };
    }
  }

  cancel(): void {
    if (this.pending) window.clearTimeout(this.pending.timer);
    this.pending = null;
  }
}
