import type { MatchState, PowerSetup } from '@truco/game-core/match';
import type {
  ClientMessage,
  CommandReply,
  RoomConfig,
  RoomView,
  ServerMessage,
} from '@truco/game-protocol';
import type { DecisionClock } from '../../matches';

export type Sink = { send(message: ServerMessage): void; close(): void };
export type Ports = {
  now(): number;
  id(): string;
  randomInt(exclusiveMax: number): number;
  schedule(at: number, callback: () => void): () => void;
};
export type Member = {
  sessionId: string;
  nickname: string;
  ready: boolean;
  connection: { id: string; sink: Sink } | null;
  strikes: number;
};
export type CachedReply = { fingerprint: string; reply: CommandReply };
export type Room = {
  code: string;
  sequence: number;
  revision: number;
  config: RoomConfig;
  hostSeat: number;
  seats: (Member | null)[];
  status: RoomView['status'];
  match: MatchState | null;
  matchId: string | null;
  outcome: RoomView['outcome'];
  clock: DecisionClock | null;
  transition: NonNullable<RoomView['transition']> | null;
  budgets: readonly number[];
  emptySince: number | null;
  cache: Map<string, CachedReply>;
  chain: Promise<void>;
  pending: number;
  cancel: (() => void) | null;
};
export function memberSeat(room: Room, sessionId: string): number {
  const seat = room.seats.findIndex((member) => member?.sessionId === sessionId);
  if (seat < 0) throw new Error('NOT_MEMBER');
  return seat;
}
export function connected(room: Room): boolean[] {
  return room.seats.map((member) => member?.connection != null);
}
export function protectionMs(room: Room): number {
  return room.config.preset === 'competitive' ? 30000 : 60000;
}
export function choices(ports: Ports): number[] {
  return Array.from({ length: 39 }, (_, index) => ports.randomInt(40 - index));
}
export function cacheKey(sessionId: string, message: ClientMessage): string {
  return JSON.stringify([sessionId, message.matchId, message.commandId]);
}

/** Separate bounded samples for draw, assignment and private information results. */
export function powerSetup(room: Room, ports: Ports): PowerSetup {
  const count = room.config.format === '1v1' ? 2 : 4;
  return {
    preset: room.config.preset,
    draws: Array.from({ length: count }, (_, seat) =>
      ports.randomInt(room.config.preset === 'competitive' && count === 4 && seat === 1 ? 3 : 4),
    ),
    flips: [ports.randomInt(2), ports.randomInt(2)],
    spies: Array.from({ length: count }, () => ports.randomInt(3)),
  };
}
