import type { Card } from '@truco/game-core/cards';
import type { PlayerCommand } from '@truco/game-core/match';
import type { RoomConfig } from '../../domain/room';

export type Action =
  | PlayerCommand
  | { type: 'READY'; ready: boolean }
  | { type: 'SET_SEAT'; seat: number }
  | { type: 'CONFIGURE'; config: RoomConfig }
  | { type: 'START_MATCH' | 'REMATCH' | 'LEAVE' | 'SYNC' | 'SURRENDER' }
  | {
      type: 'DEV_RESET_HAND';
      cards?: Card[] | undefined;
      power?: 'spy' | 'exchange' | 'boost' | 'mask' | undefined;
      energy?: number | undefined;
    };

export type RoomCommand = {
  commandId: string;
  matchId: string | null;
  decisionId: string | null;
  expectedRevision: number | null;
  action: Action;
};

export type CommandReply =
  | { type: 'ACK'; commandId: string; ok: true; sequence: number }
  | { type: 'ERROR'; commandId: string | null; code: string };
