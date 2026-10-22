# ADR 001 — Bun and modular architecture

- Status: accepted by the owner.
- Date: 2026-10-17.
- Current contract: [architecture.md](../architecture.md).

## Context

The project is still in preproduction. The owner selected Bun for frontend/backend and requested Clean Architecture, DDD and SOLID where useful, with attention to oversized files and hard-to-navigate folders.

## Decision

Adopt Bun as monorepo manager, tooling runner and backend runtime. React/Vite deliver browser code. Use one `bun.lock` and pin the Bun version during bootstrap.

Keep a modular monolith: features grouped into modules, application and adapters separated, pure match domain in `game-core` and public contracts in `game-protocol`. Compose dependencies explicitly and preserve one authority per room. Apply state machines, ports/adapters, events and strategies only where there is a concrete need.

Organize frontend code by feature, separating server state from selection and animation. Keep tests close to behavior and check import boundaries. Review files exceeding 300 lines, extract before extending files near 450, and refactor files with 500 or more unless an exception is justified; reassess folders around 15 files.

## Consequences

The domain can be tested and simulated without Bun, HTTP or a browser. Adapters concentrate integrations; the application coordinates effects and serialization. Avoiding empty layers, unused interfaces and mechanical fragmentation requires cohesion review in addition to size metrics.

Bootstrap must validate tools under Bun and implement boundary checks. This decision alone completes no installation, implementation or compatibility testing. In-memory match state still cannot recover after a process crash.
