# ADR 005 — Pure composition of M1 base rules

Status: accepted for M1, 2026-10-18.

## Context

Bootstrap and card/trick resolvers could not complete a match. M1 requires betting, eleven and a testable loop, preserving privacy and authority without bringing forward the M2 server or M3 powers.

## Decision

Compose pure functions in `game-core/match` with discriminated phases and immutable transitions. `startMatch` receives player count, opener and trusted Fisher–Yates choices. `executeCommand` receives the application-resolved seat and expected revision. `dealNextHand` deals only after `HAND_END`, with rotation and fresh explicit entropy. Dealing and resolution are synchronous; neither waits for animation or a clock.

Betting separates accepted and proposed values; a counter-raise accepts the previous value before proposing the next. Eleven and 11×11 are discriminated by `hand.kind`, prohibiting bets. Scoring happens only at hand end, caps scores at 12 and preserves the original reward in an event. Cards remain conserved across remaining hands, turn-up card, draw pile and completed/current plays.

Allowlisted projections are separate from state. Hidden hands expose counts, and face-down cards have no public identity. The eleven team retains already-known hand information; 11×11 grants only the player's own hand. Engine events contain no private cards.

## Consequences and limits

The engine completes base-rule matches in tests without runtime, network or database. This creates no classic product mode. Powers/energy/preparation do not yet exist and arrive in M3, with no power assignment or regeneration in special hands. Sessions, room queues, match identity, clocks and reconnection arrive in M2.

Stale revisions prevent reapplying accepted transitions. This does not replace application deduplication using `commandId`, authentication and returning the original ACK. The adapter must also reject commands for other matches and generate uniform cryptographic entropy. Internal state must never be sent directly to clients. There is no persistence or match recovery after a process crash.
