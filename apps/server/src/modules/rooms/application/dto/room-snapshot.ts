import type { projectPlayerView } from '@truco/game-core/projections';
import type { RoomConfig, RoomOutcome, RoomState } from '../../domain/room';
import type { CommandReply } from './commands';

export type RoomTransition = { id: string; kind: 'deal' | 'trick' | 'hand'; until: number };

/** Allowlisted projection; never an authoritative room serialized wholesale. */
export type RoomView = {
  solo?: boolean | undefined;
  devTools?: boolean | undefined;
  code: string;
  sequence: number;
  roomRevision: number;
  status: RoomState['status'];
  hostSeat: number;
  selfSeat: number;
  seats: readonly ({ seat: number; nickname: string; connected: boolean; ready: boolean } | null)[];
  config: RoomConfig;
  matchId: string | null;
  decisionId: string | null;
  deadline: number | null;
  paused: boolean;
  transition?: RoomTransition | undefined;
  match: ReturnType<typeof projectPlayerView> | null;
  outcome: RoomOutcome | null;
};

export type ServerMessage = CommandReply | { type: 'SNAPSHOT'; room: RoomView };
