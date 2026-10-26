import type { MatchState } from '@truco/game-core/match';

export type RoomConfig = {
  format: '1v1' | '2v2';
  preset: 'casual' | 'competitive';
  cardTimeoutMs: number | null;
  preparationTimeoutMs: number;
  responseTimeoutMs: number;
};

export type MemberAppearance = Readonly<{
  avatar: Readonly<{ id: string; avatarUrl: '/art/avatars-pixel.png'; spriteIndex: number }>;
  deck: Readonly<{ id: 'classic' | 'ember' | 'arcane'; assetKey: 'classic' | 'ember' | 'arcane' }>;
  table: Readonly<{
    id: 'classic' | 'burgundy' | 'midnight';
    assetKey: 'classic' | 'burgundy' | 'midnight';
  }>;
}>;

export type MemberIdentity = Readonly<{ accountId: string; appearance: MemberAppearance }>;

export type Member = {
  bot?: boolean;
  identity?: MemberIdentity;
  sessionId: string;
  nickname: string;
  ready: boolean;
  strikes: number;
};

export type RoomOutcome = {
  winner: 'A' | 'B' | null;
  reason: 'completed' | 'surrender' | 'abandonment' | 'expired' | 'technical';
};

/** Authoritative state only. Connections, queues and scheduling belong to the application. */
export type RoomState = {
  solo?: boolean;
  devTools?: boolean;
  code: string;
  revision: number;
  config: RoomConfig;
  hostSeat: number;
  seats: (Member | null)[];
  status: 'lobby' | 'playing' | 'finished';
  match: MatchState | null;
  matchId: string | null;
  outcome: RoomOutcome | null;
};
