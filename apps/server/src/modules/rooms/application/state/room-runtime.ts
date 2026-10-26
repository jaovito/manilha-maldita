import type { DecisionClock } from '../../../matches';
import type { MemberIdentity, RoomState } from '../../domain/room';
import type { CommandReply } from '../dto/commands';
import type { RoomTransition } from '../dto/room-snapshot';
import type { Sink } from '../ports/room-publisher';

export type CachedReply = { fingerprint: string; reply: CommandReply };

/** Operational envelope owns one domain state and one serialized stream of commands. */
export type RoomRuntime = {
  state: RoomState;
  matchRecord?: {
    id: string;
    startedAt: number;
    policyVersion: string;
    seats: readonly { seat: number; accountId: string | null; identity?: MemberIdentity }[];
    lastHand: number;
    lastActivations: number;
    powersUsed: number;
    reported: boolean;
  };
  connections: Map<string, { id: string; sink: Sink }>;
  sequence: number;
  botWake?: { key: string; at: number } | null;
  clock: DecisionClock | null;
  transition: RoomTransition | null;
  budgets: readonly number[];
  emptySince: number | null;
  cache: Map<string, CachedReply>;
  chain: Promise<void>;
  pending: number;
  cancel: (() => void) | null;
};
