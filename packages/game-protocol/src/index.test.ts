import { expect, test } from 'bun:test';
import {
  actionSchema,
  clientMessageSchema,
  defaultRoomConfig,
  normalizeConfig,
  roomCodeSchema,
  serverMessageSchema,
} from './index';

test('validates every command and rejects spoofed authority and unsupported card identities', () => {
  const actions = [
    ...['START_MATCH', 'REMATCH', 'LEAVE', 'SYNC', 'SURRENDER', 'REQUEST_RAISE'].map((type) => ({
      type,
    })),
    { type: 'READY', ready: true },
    { type: 'SET_SEAT', seat: 3 },
    { type: 'CONFIGURE', config: defaultRoomConfig },
    { type: 'PLAY_CARD', card: { rank: 'A', suit: 'clubs' }, covered: false },
    ...['accept', 'raise', 'fold'].map((response) => ({ type: 'RESPOND_RAISE', response })),
    ...['play', 'fold'].map((response) => ({ type: 'DECIDE_ELEVEN', response })),
  ];
  for (const action of actions) expect(actionSchema.safeParse(action).success).toBe(true);
  const envelope = {
    protocol: 1,
    commandId: 'command_1',
    matchId: null,
    decisionId: null,
    expectedRevision: null,
    action: { type: 'SYNC' },
  };
  expect<unknown>(clientMessageSchema.parse(envelope)).toEqual(envelope);
  for (const invalid of [
    { ...envelope, playerId: 'spoof' },
    { ...envelope, commandId: 'a/b' },
    { ...envelope, expectedRevision: -1 },
    { ...envelope, protocol: 2 },
    {
      ...envelope,
      action: { type: 'PLAY_CARD', card: { rank: '8', suit: 'clubs' }, covered: false },
    },
  ])
    expect(clientMessageSchema.safeParse(invalid).success).toBe(false);
});
test('configuration bounds and competitive fixed timers are enforced without mutation', () => {
  expect(normalizeConfig(defaultRoomConfig)).toEqual(defaultRoomConfig);
  expect(
    normalizeConfig({ ...defaultRoomConfig, preset: 'competitive', cardTimeoutMs: null }),
  ).toEqual({
    ...defaultRoomConfig,
    preset: 'competitive',
    cardTimeoutMs: 20000,
    responseTimeoutMs: 15000,
    preparationTimeoutMs: 10000,
  });
  for (const value of [0, 999, 120001, NaN, Infinity])
    expect(() => normalizeConfig({ ...defaultRoomConfig, responseTimeoutMs: value })).toThrow();
  expect(roomCodeSchema.safeParse('ABC123').success).toBe(true);
  expect(roomCodeSchema.safeParse('../ABC').success).toBe(false);
});
test('server messages accept only the declared safe envelope', () => {
  expect(serverMessageSchema.parse({ type: 'ACK', commandId: 'a', ok: true, sequence: 1 })).toEqual(
    { type: 'ACK', commandId: 'a', ok: true, sequence: 1 },
  );
  expect(
    serverMessageSchema.parse({ type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' }),
  ).toEqual({ type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' });
  expect(
    serverMessageSchema.safeParse({ type: 'ERROR', commandId: null, code: 'secret: cards' })
      .success,
  ).toBe(false);
  expect(
    serverMessageSchema.safeParse({
      type: 'ACK',
      commandId: 'a',
      ok: true,
      sequence: 1,
      token: 'SECRET',
    }).success,
  ).toBe(false);
});

test('power commands reject extra authority, mixed windows and malformed targets; preparation timers normalize', () => {
  for (const action of [
    { type: 'PREPARE', intent: { type: 'pass' } },
    { type: 'PREPARE', intent: { type: 'spy', target: 1 } },
    { type: 'PREPARE', intent: { type: 'exchange', card: { rank: 'A', suit: 'clubs' } } },
    { type: 'PLAY_CARD', card: { rank: 'A', suit: 'clubs' }, covered: false, power: 'mask' },
  ])
    expect(actionSchema.safeParse(action).success).toBe(true);
  for (const action of [
    { type: 'PREPARE', intent: { type: 'spy', target: 4 } },
    { type: 'PREPARE', intent: { type: 'spy', target: 1, cardIndex: 0 } },
    { type: 'PREPARE', intent: { type: 'mask' } },
    { type: 'PREPARE', intent: { type: 'pass' }, seed: 1 },
    { type: 'PLAY_CARD', card: { rank: 'A', suit: 'clubs' }, covered: false, power: 'spy' },
  ])
    expect(actionSchema.safeParse(action).success).toBe(false);
  for (const value of [0, 999, 120001, NaN])
    expect(() => normalizeConfig({ ...defaultRoomConfig, preparationTimeoutMs: value })).toThrow();
  expect(
    normalizeConfig({ ...defaultRoomConfig, preset: 'competitive', preparationTimeoutMs: 30000 })
      .preparationTimeoutMs,
  ).toBe(10000);
});

test('transition metadata is optional, bounded to public presentation kinds and rejects extra state', async () => {
  const { roomViewSchema } = await import('./index');
  const schema = roomViewSchema.shape.transition;
  expect(schema.safeParse(undefined).success).toBe(true);
  for (const kind of ['deal', 'trick', 'hand'])
    expect(schema.safeParse({ id: 'pause_1', kind, until: 900 }).success).toBe(true);
  for (const value of [
    null,
    { id: 'pause_1', kind: 'power', until: 900 },
    { id: 'pause_1', kind: 'deal', until: Infinity },
    { id: 'pause_1', kind: 'deal', until: 900, seed: 1 },
    { id: 'private/card', kind: 'deal', until: 900 },
  ])
    expect(schema.safeParse(value).success).toBe(false);
});
