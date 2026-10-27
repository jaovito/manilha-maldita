# AGENTS.md — Truco Caótico

## Product and scope

Act as a senior multiplayer browser game engineer. Prioritize correctness, fun, security and operational simplicity; deliver playable, testable increments that are easy to maintain.

Working title: **Truco Caótico**. This is Truco with powers. Balatro inspires combinations and audiovisual feedback; use original or licensed branding and assets.

- A 2D desktop/mobile browser game, initially for playing with friends.
- **1v1 and 2v2**, with partners in alternating seats; casual and competitive share the same engine.
- Random powers, never selected in advance or unlocked by level.
- Cosmetic progression only; every power in the mode is available from the start.
- No paid advantage, permanent attributes or energy purchases. Stakes are points with no monetary value.
- MVP: private rooms by link/code, nicknames without mandatory registration, lobby, teams, readiness, complete matches, rematches, four powers, casual/competitive presets, timers and reconnection.
- The four MVP powers are **Espião, Segunda Chance, Impulso and Máscara**, in both presets.
- Rankings, public matchmaking, store, experience, events, experimental powers, production bots, spectators, tournaments, public replay and distributed infrastructure follow the MVP.
- Competitive initially means a preset, not a complete ranked/anti-collusion system. Target duration: 10–20 minutes, pending playtesting.

Authorized M5 extension on 2026-10-22: optional accounts, catalog avatars without uploads, complete decks visible to other players, cosmetic tables, XP/levels for unlocks and a global ranking based on competitive wins. This authorization only supersedes the deferral of XP/rankings above. The first increment delivers schemas/migrations and the PostgreSQL queue foundation only; authentication, worker, reward amounts, account recovery and anti-exploitation eligibility were not implemented in that increment. See [docs/database.md](docs/database.md) and [ADR 011](docs/adr/011-m5-postgresql-foundation.md).

Do not change product decisions without authorization. Costs, timings and metrics are playtest hypotheses; document reversible technical adjustments.

## Sources of truth and required reading

[GDD.md](GDD.md) describes the product vision and future ideas. [docs/rules.md](docs/rules.md) defines the current implementable contract, including house conventions. Future GDD proposals do not authorize expanding the MVP. Flag new contradictions and document their resolution; do not silently choose a rule.

Read applicable documents **before editing**. This table requires explicit reading; a documentation folder does not imply automatic loading.

| Task | Required reading |
|---|---|
| Product, scope or presentation | `GDD.md`, `plan.md`; `docs/rules.md` when explaining rules |
| Rules, powers, scoring, turns, timing or abandonment | `docs/rules.md`, `docs/testing.md` |
| Structure, domain, server, transport or operations | `docs/architecture.md`, `docs/security.md`, `docs/testing.md`; `docs/rules.md` when affecting gameplay |
| Interface and experience | Interface section of `docs/architecture.md`, `docs/security.md`; `docs/rules.md` for actions and visibility; `docs/testing.md` when changing behavior |
| Local database, migrations, seeds or SQL fixtures | `docs/database.md`, `docs/security.md`, `docs/testing.md` |
| Authentication, personal data, cryptography or publication | `docs/security.md`, `docs/architecture.md`; `docs/database.md` when persisting data; `docs/testing.md` when changing behavior |
| Tests, tools or CI | `docs/testing.md` and the contract of the affected area |
| Simulation, metrics or balancing | `docs/balancing.md`, `docs/rules.md`, `docs/security.md`, `docs/testing.md` |

Read applicable module-level `AGENTS.md` files before editing, even when the session started at the root. Create local instructions only for real areas, without duplicating documentation contracts. Record structural decisions in `docs/adr/` when needed.

## Essential invariants

- The server decides outcomes, turns, timing and randomness; the client is never authoritative.
- The core is pure: no UI, sockets, ORM, global clock or I/O; time and entropy are explicit inputs.
- Never send private cards, the draw pile, seeds or tokens through public projections, IDs, errors, logs or analytics.
- Serialize commands and timers per room; preserve idempotency and reject stale contexts.
- Rejected or repeated commands consume no cards, energy or randomness and never award points twice.
- Do not weaken types, security or tests to appear finished. Cosmetics must not change advantage, information or accessibility.

## Security during agent development

Follow the detailed [cryptography and persistence policy](docs/security.md#cryptography-and-persistence-policy) in every applicable implementation and review:

- Before public exposure, require HTTPS/WSS, valid certificates, `Secure` cookies and origin validation. Loopback HTTP/WS is for development only; choosing WSS in the client does not prove TLS is configured on the server or proxy.
- Protect remote database connections with TLS and certificate verification. Also protect the proxy/CDN-to-origin connection, or keep it on a controlled local channel.
- Use established protocols and libraries. Do not invent JSON encryption or give the browser keys to hide cards it should never receive; preserve authorized projections.
- Before persisting player data, justify its necessity and define access, retention and deletion. Do not introduce accounts or personal data collection outside the authorized milestone.
- When introducing player persistence, require database and backup encryption at rest. Assess field encryption against sensitivity and the threat model; keep keys and secrets separate from data and out of source, frontend and logs.
- For passwords, use an appropriate password hash, preferably Argon2id with salt and reviewed parameters. Never store plaintext or reversibly encrypted authentication passwords.
- If random session/resume tokens are persisted only for comparison, store verifiers/hashes rather than usable credentials. Preserve expiry, revocation and session/seat binding.
- Distinguish implemented protections from future configuration: do not claim verified TLS, encryption at rest or production security without evidence from the corresponding environment. Changing these rules does not authorize deployment, provisioning or scope expansion.

## Working practices

Before editing, read applicable instructions, Git status when available, the relevant tree, README, manifests, lockfile and existing tests. Do not assume target structures, scripts or tools already exist.

For each task, define the objective, acceptance criteria and risks; implement a small slice; add relevant regressions; run checks; review changes and update affected documentation. Split tasks above 8 points into reviewable increments.

Every implemented or changed behavior needs relevant tests, including errors and boundaries. Require at least 80% line and function coverage per measured executable file, following `docs/testing.md`; run `bun run test:coverage` before delivery. The minimum does not replace critical scenarios or permit source exclusions or a reduced threshold to pass a change.

Preserve prior work. Do not destructively reset, discard files, rewrite history, push, publish packages, provision resources or run destructive migrations without authorization. Do not expose secrets or bypass permissions.

Resolve nonblocking ambiguity conservatively and record the assumption. Rule contradictions require tests and documentation, not a silent `if`.

Complete the requested task: this file does not authorize implementing the entire roadmap. Start implementation with bootstrap and engine, not the store or production infrastructure. Use [GitHub issues](https://github.com/jaovito/manilha-maldita/issues) and [milestones](https://github.com/jaovito/manilha-maldita/milestones) as the source of truth for planned work and status. Keep `plan.md` as a historical implementation/validation record; link new work to an issue and update the relevant GitHub milestone instead of maintaining a competing roadmap.

Preserve existing stack choices; bootstrap defaults are in `docs/architecture.md`. Write repository documentation, code comments and identifiers in English. Preserve Portuguese game-facing text and translations. Responses to the user may remain in pt-BR. Use specific types and runtime validation; comments explain decisions and invariants.

Readability is also required: use a blank line between logical blocks (preparation, validation, effects and return), between functions/methods and between declarations with different responsibilities. Keep closely related declarations and statements together; do not compress an entire function or mechanically add a blank line after every statement. Preserve this spacing when running Biome and review the result visually.

When changing layout, use `playwright-cli` afterward to open the affected flow, capture and visually inspect desktop and mobile. Fix distortion, clipping and overlap before delivery; geometric tests or Playwright Test do not replace this visual check. Preserve the game's professional pixel art identity.

Run the affected suite and feasible general checks, following `docs/testing.md`. Report changes, commands, results and limitations in pt-BR. Do not claim unexecuted tests or deployments. Completion requires functional behavior, relevant regressions, updated documentation and no new leaks or races; state what remains unverified.

## Code review rules

Prioritize correctness and security; flag:

- Secrets sent to clients through data, IDs, telemetry or reconnection.
- Mutations outside authority, missing idempotency or timers for the wrong decision.
- Incorrect counter-raises/ties or energy charged on rejection.
- Unauthorized product changes, cosmetic advantages or rules without regression tests.
- Omniscient bots, tests hiding failures or fake network tests.
- Public exposure without HTTPS/WSS, unverified certificates or session cookies without `Secure`.
- Unnecessary personal data persistence, plaintext/reversible passwords or exposed credentials/keys.

Explain the scenario and consequence. Separate nonblocking suggestions; never assume unexecuted checks passed.

## GitHub contribution workflow

Follow [CONTRIBUTING.md](CONTRIBUTING.md). README contains only setup, installation and execution instructions. Keep repository instructions, templates, issues and PR descriptions in English; game-facing Portuguese text and translations remain allowed.

Before starting new work, consult the linked issue and milestone. Record acceptance criteria, blockers and executed validation in the issue/PR. Future milestones are planning, not blanket approval to change product scope. Close issues only when their acceptance criteria are satisfied.

All paths require @jaovito as CODEOWNER. Other contributors need CODEOWNER approval and required checks before merge. Only @jaovito has the configured review bypass; do not infer authority to bypass protections or merge from being an agent or collaborator. Never weaken CI or authorization to make a contribution pass.
