# ADR 006 — M2 authoritative rooms and reconnection

Status: accepted for M2, 2026-10-18.

## Context

The pure M1 engine ran matches without networking. Private 1v1/2v2 rooms require guest identity, a lobby and one writer for matches, presence, timers and rematches. The MVP needs neither distribution nor per-play persistence.

## Decision

Use an in-memory `RoomService` with a bounded per-room queue that recovers after errors. Hono/Bun stay in bootstrap/adapters; time, IDs, entropy and scheduling enter through ports. Transport validates strict protocol schemas; the browser imports only public contracts. The server generates the opener, shuffles and decisions.

Guests resume seats through an HttpOnly/SameSite=Strict cookie with an expiring cryptographic credential. Room codes are invitations, never identity. Session/room/seat membership is checked before idempotency recording or projection delivery. A new connection replaces the old one without competing automatic reconnections.

Separate snapshot sequence, lobby revision and gameplay revision/context. A recent cache keyed by logical player, match and command returns the original ACK after reconnection; different content with the same ID is rejected. Each room retains 512 recent results until eviction/expiry. Revision/decision checks continue blocking old replays after eviction. Every send is a complete authorized, schema-validated projection.

Decision clocks use explicit time and a cumulative reconnection budget that does not refill between absences. Pause only when no connected eligible actor can act; resume the remainder, never the whole deadline. Ending absences without a card timer requires a fallback after protection. Fully disconnected rooms expire after 60 s casual/30 s competitive without a winner. These operational details do not change card, betting or power rules.

## Consequences

Matches, lobbies and rematches can be exercised through independent HTTP/WS clients and browser contexts. A functional DOM table validates M2 before visual polish. Powers, energy and preparation remain in M3; no new product preset was created.

Server Bun unit/integration tests share one coverage run: bootstrap imports real transport so each file is measured over the combined behavior rather than applying thresholds to partial smoke-test imports. DOM and PostgreSQL stay isolated. The 80% per-file minimum and source inventory remain mandatory, without new product exclusions.

The process is a single authority with 256 rooms, three rooms per session, bounded queues, payload/rate limits and slow-client disconnection. No deployment, remote resource or analytics was provisioned. Restart loses sessions and matches: this is a technical failure without a recorded loss, not recoverable reconnection. Redis, durable recovery and multiple instances remain outside M2.
