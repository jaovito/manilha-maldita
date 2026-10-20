import type { PowerSetup } from '@truco/game-core/match';
import type { Ports } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';

export function choices(ports: Ports): number[] {
  return Array.from({ length: 39 }, (_, index) => ports.randomInt(40 - index));
}

/** Separate bounded samples for draw, assignment and private information results. */
export function powerSetup(room: RoomRuntime, ports: Ports): PowerSetup {
  const count = room.state.config.format === '1v1' ? 2 : 4;

  return {
    preset: room.state.config.preset,
    draws: Array.from({ length: count }, (_, seat) =>
      ports.randomInt(
        room.state.config.preset === 'competitive' && count === 4 && seat === 1 ? 3 : 4,
      ),
    ),
    flips: [ports.randomInt(2), ports.randomInt(2)],
    spies: Array.from({ length: count }, () => ports.randomInt(3)),
  };
}
