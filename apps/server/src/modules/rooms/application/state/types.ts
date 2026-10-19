import type { MatchState } from '@truco/game-core/match';
import type { CommandReply, RoomConfig, RoomView, ServerMessage } from '@truco/game-protocol';
import type { DecisionClock } from '../../../matches';

export type RoomOptions = { soloEnabled?: boolean; devTools?: boolean };

export type Sink = { send(message: ServerMessage): void; close(): void };

export type Ports = {
  now(): number;
  id(): string;
  randomInt(exclusiveMax: number): number;
  schedule(at: number, callback: () => void): () => void;
};

export type Member = {
  bot?: boolean;
  sessionId: string;
  nickname: string;
  ready: boolean;
  connection: { id: string; sink: Sink } | null;
  strikes: number;
};

export type CachedReply = { fingerprint: string; reply: CommandReply };

export type Room = {
  solo?: boolean;
  devTools?: boolean;
  botWake?: { key: string; at: number } | null;
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
