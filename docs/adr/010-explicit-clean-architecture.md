# ADR 010 — Explicit backend Clean Architecture layers

- Status: accepted; migration authorized by the owner.
- Date: 2026-10-20.
- Complements: [ADR 001](001-bun-modular-architecture.md) and [ADR 006](006-room-authority-and-reconnection.md).

## Context

The rules engine was already pure, but server implementation concentrated storage, command execution, presence, publication and timers in `RoomService`. Room types included connections and queues; HTTP/WS handlers lived in bootstrap; sessions mixed storage and operations. This made the approved architecture difficult to recognize and its boundaries difficult to test.

## Decision

Keep a feature-organized modular monolith with Clean Architecture. Ports/adapters express external boundaries; they are neither an alternative architecture nor a requirement for a DI container.

Responsibilities:

- `domain`: entities, configuration and policies without network protocol, runtime or I/O. Card, hand, trick and match domains remain in `packages/game-core` as pure types/functions.
- `application/use-cases`: application operations separated by intent. Shared coordination belongs in `application/services`; input/output contracts in `application/ports`; input/projection data in `application/dto`.
- `adapters/inbound`: input validation/translation and HTTP/WS integration.
- `adapters/outbound`: concrete implementations of in-memory storage, credentials, clock, entropy, scheduling and socket delivery.
- `composition.ts` and `bootstrap`: explicit assembly; public `index.ts` entrypoints export module contracts/factories.

`rooms` retains lobby/match authority. `sessions` implements guest identity, issuance, lookup and nickname changes. `transport` contains HTTP/WS adapters and network protections. `matches` provides decision-clock policies; it is not a second match writer.

Room domain state is separate from the operational envelope containing connections, response cache, queue, timer cancellation and snapshot sequence. Repository ports are consumer-specific. There are no generic repositories or ORM models without corresponding persistence.

Within `application`, organize first by responsibility (`use-cases`, `services`, `ports`, `dto`, `state`), then feature. Shared lobby, match, bot and dispatch coordination belongs under `services`; projections and outbound errors belong in `dto/mappers`. Presence and entropy preparation are service behavior, not state. Development hand reset is an operation in `use-cases/solo`. Do not create a generic helpers folder or duplicate feature folders at the application root.

### Repository consistency and boundaries

The room repository stores live authority in memory. It returns the same operational instance to preserve the per-room queue, rather than independent aggregate copies. It therefore cannot be replaced with a SQL `load/save` repository without revisiting consistency and recovery. This migration introduces no durable persistence.

All writers, including timers and the bot, still use the room queue. Extracting use cases creates no independent locks, queues or transactions. Connection identity, idempotency cache, revision, decision context and callback identity preserve the existing validation order.

Internal DTOs belong to the application. The public protocol remains in `game-protocol`; schemas and serialization stay at boundaries. Projections remain allowlisted and recipient-specific. Structural type compatibility does not authorize sending private state.

### Verification

The architecture checker blocks inappropriate external imports in domain/application, including protocol imports in application, and common direct runtime calls in those files. The local server graph checks cycles and indirect dependencies from inner layers to adapters/bootstrap, including reexports.

These checks are complemented by use-case tests with fake ports, engine tests and real HTTP/WS integration. Static analysis proves neither every semantic property nor replaces concurrency/privacy tests. Coverage requirements were not reduced.

## Consequences

Use cases/adapters now have recognizable paths; rules and coordination can be exercised without an HTTP server. Separation adds specific contracts while preserving manual composition and functions where classes add no behavior.

There is no change to stack, rules, message formats, authentication, persistence or infrastructure. Restarting still loses rooms and sessions. Deployment and push are outside this decision.

## References

- [Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html): dependency direction and separation of rules, use cases and adapters.
- [Hexagonal Architecture — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture): application isolation through ports/adapters.
