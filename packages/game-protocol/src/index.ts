import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
const seat = z.number().int().min(0).max(3);
const team = z.enum(['A', 'B']);
const winner = z.enum(['A', 'B', 'tie']);
const stake = z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(9), z.literal(12)]);

export const cardSchema = z.strictObject({
  rank: z.enum(['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']),
  suit: z.enum(['diamonds', 'spades', 'hearts', 'clubs']),
});

export const nicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\p{L}\p{N} _.-]+$/u);

export const roomCodeSchema = z.string().regex(/^[A-Z0-9]{6}$/);

export const roomConfigSchema = z.strictObject({
  format: z.enum(['1v1', '2v2']),
  preset: z.enum(['casual', 'competitive']),
  cardTimeoutMs: z.number().int().min(1000).max(120000).nullable(),
  preparationTimeoutMs: z.number().int().min(1000).max(120000).default(15000),
  responseTimeoutMs: z.number().int().min(1000).max(120000),
});
export type RoomConfig = z.infer<typeof roomConfigSchema>;
export const defaultRoomConfig: RoomConfig = {
  format: '1v1',
  preset: 'casual',
  cardTimeoutMs: 30000,
  responseTimeoutMs: 20000,
  preparationTimeoutMs: 15000,
};

export function normalizeConfig(config: RoomConfig): RoomConfig {
  const parsed = roomConfigSchema.parse(config);
  return parsed.preset === 'competitive'
    ? { ...parsed, cardTimeoutMs: 20000, responseTimeoutMs: 15000, preparationTimeoutMs: 10000 }
    : parsed;
}

export const powerSchema = z.enum(['spy', 'exchange', 'boost', 'mask']);
export const preparationIntentSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('spy'), target: seat }),
  z.strictObject({ type: z.literal('exchange'), card: cardSchema }),
]);

export const actionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('PREPARE'), intent: preparationIntentSchema }),
  z.strictObject({ type: z.literal('READY'), ready: z.boolean() }),
  z.strictObject({ type: z.literal('SET_SEAT'), seat }),
  z.strictObject({ type: z.literal('CONFIGURE'), config: roomConfigSchema }),
  z.strictObject({ type: z.literal('START_MATCH') }),
  z.strictObject({ type: z.literal('REMATCH') }),
  z.strictObject({ type: z.literal('LEAVE') }),
  z.strictObject({ type: z.literal('SYNC') }),
  z.strictObject({ type: z.literal('SURRENDER') }),
  z.strictObject({ type: z.literal('REQUEST_RAISE') }),
  z.strictObject({
    type: z.literal('PLAY_CARD'),
    card: cardSchema,
    covered: z.boolean(),
    power: z.enum(['boost', 'mask']).optional(),
  }),
  z.strictObject({
    type: z.literal('RESPOND_RAISE'),
    response: z.enum(['accept', 'raise', 'fold']),
  }),
  z.strictObject({ type: z.literal('DECIDE_ELEVEN'), response: z.enum(['play', 'fold']) }),
]);

export const clientMessageSchema = z.strictObject({
  protocol: z.literal(1),
  commandId: id,
  matchId: id.nullable(),
  decisionId: id.nullable(),
  expectedRevision: z.number().int().nonnegative().nullable(),
  action: actionSchema,
});
export type Action = z.infer<typeof actionSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
const play = z.union([
  z.strictObject({ seat, covered: z.literal(false), power: z.literal('mask') }),
  z.strictObject({ seat, covered: z.literal(true) }),
  z.strictObject({
    seat,
    covered: z.boolean(),
    card: cardSchema,
    power: z.enum(['boost', 'mask']).optional(),
  }),
]);
const phase = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('PREPARATION') }),
  z.strictObject({ type: z.literal('TURN'), seat }),
  z.strictObject({ type: z.literal('RAISE_RESPONSE') }),
  z.strictObject({ type: z.literal('ELEVEN_DECISION'), team }),
  z.strictObject({ type: z.literal('HAND_END'), winner, reward: z.number().int().nonnegative() }),
  z.strictObject({ type: z.literal('MATCH_END'), winner: team }),
]);
const hand = z.union([
  z.strictObject({ seat, count: z.number().int().min(0).max(3), visibility: z.literal('hidden') }),
  z.strictObject({
    seat,
    count: z.number().int().min(0).max(3),
    visibility: z.literal('visible'),
    cards: z.array(cardSchema).max(3).readonly(),
  }),
]);

export const matchViewSchema = z.strictObject({
  powers: z
    .strictObject({
      players: z
        .array(
          z.strictObject({
            seat,
            energy: z.number().int().min(0).max(3),
            // null also means an unrevealed assignment belonging to another seat.
            power: powerSchema.nullable(),
            used: z.boolean(),
            ready: z.boolean(),
          }),
        )
        .max(4)
        .readonly(),
      activations: z
        .array(z.strictObject({ seat, power: powerSchema, target: seat }))
        .max(4)
        .readonly(),
      intel: z.strictObject({ target: seat, card: cardSchema }).nullable().optional(),
    })
    .optional(),
  playerCount: z.union([z.literal(2), z.literal(4)]),
  revision: z.number().int().nonnegative(),
  seat,
  score: z.strictObject({ A: z.number().int().min(0).max(12), B: z.number().int().min(0).max(12) }),
  phase,
  hand: z.strictObject({
    number: z.number().int().positive(),
    kind: z.enum(['normal', 'eleven', 'decisive']),
    leader: seat,
    elevenTeam: team.nullable(),
    hands: z.array(hand).max(4).readonly(),
    vira: cardSchema,
    trickLeader: seat,
    plays: z.array(play).max(4).readonly(),
    completedTricks: z
      .array(
        z.strictObject({
          leader: seat,
          plays: z.array(play).max(4).readonly(),
          result: z.strictObject({ winner, nextLeader: seat }),
        }),
      )
      .max(3)
      .readonly(),
    betting: z.strictObject({
      acceptedStake: stake,
      pendingStake: stake.nullable(),
      lastRaisingTeam: team.nullable(),
      resumeTurnSeat: seat.nullable(),
    }),
  }),
});
export type MatchView = z.infer<typeof matchViewSchema>;

export const roomViewSchema = z.strictObject({
  code: roomCodeSchema,
  sequence: z.number().int().nonnegative(),
  roomRevision: z.number().int().nonnegative(),
  status: z.enum(['lobby', 'playing', 'finished']),
  hostSeat: seat,
  seats: z
    .array(
      z
        .strictObject({
          seat,
          nickname: nicknameSchema,
          connected: z.boolean(),
          ready: z.boolean(),
        })
        .nullable(),
    )
    .max(4)
    .readonly(),
  config: roomConfigSchema,
  matchId: id.nullable(),
  decisionId: id.nullable(),
  deadline: z.number().finite().nullable(),
  paused: z.boolean(),
  transition: z
    .strictObject({ id, kind: z.enum(['deal', 'trick', 'hand']), until: z.number().finite() })
    .optional(),
  match: matchViewSchema.nullable(),
  outcome: z
    .strictObject({
      winner: team.nullable(),
      reason: z.enum(['completed', 'surrender', 'abandonment', 'expired', 'technical']),
    })
    .nullable(),
  selfSeat: seat,
});
export type RoomView = z.infer<typeof roomViewSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('SNAPSHOT'), room: roomViewSchema }),
  z.strictObject({
    type: z.literal('ACK'),
    commandId: id,
    ok: z.literal(true),
    sequence: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('ERROR'),
    commandId: id.nullable(),
    code: z.string().regex(/^[A-Z_]{1,80}$/),
  }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type CommandReply = Exclude<ServerMessage, { type: 'SNAPSHOT' }>;

export const guestRequestSchema = z.strictObject({ nickname: nicknameSchema });

export const createRoomRequestSchema = z.strictObject({ config: roomConfigSchema });

export const joinRoomRequestSchema = z.strictObject({});
