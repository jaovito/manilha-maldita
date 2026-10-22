# ADR 011 — M5 persistence foundation and PostgreSQL queue

Date: 2026-10-22. Status: accepted for the authorized setup; subsequent integrations pending.

## Context

The owner authorized optional accounts, catalog avatars without uploads, cosmetic decks/tables, level unlocks and global ranking by competitive wins. They requested small reviewable increments, starting with tables, migrations and queue configuration. PostgreSQL/Drizzle already exist; live room state/authority remain in memory.

## Decision

- Create 11 feature-separated tables in the `app` namespace with Drizzle generation and a custom SQL notification migration.
- Do not yet integrate authentication, persistent sessions, cosmetics, progression or jobs into runtime. Create no XP/point-writing endpoints or fake consumers.
- Persist XP/points as `bigint`; calculate levels on the server, without an independent column or inventory for level-only unlocks.
- Separate credentials/profile/progress. Reserve only canonical login and Argon2id hashes: email/recovery remain undecided. The PHC constraint validates format, not cryptographic parameter security.
- Reference styles by trusted asset keys; avatars have a local `avatar_url` path. Catalogs accept no uploads, CSS, code or arbitrary URLs. Seeds remain empty until a catalog is approved.
- Record only result summaries, participants/seats and rewards. Persist no hands, seeds, usable tokens or JSON snapshots. Each account occupies at most one seat per result; one reward per participant implies one per account/match.
- Repeating preset/format/solo in composite references prevents forged competitive-point contexts. The application must still validate winners, eligibility, amounts and atomic total updates.
- Use `app.jobs` as a durable queue/local outbox with a result FK, uniqueness by result/type, pending/lease indexes, attempt bounds and coherent states. Add no `pg_partman`, Redis or broker.
- An invoker trigger with `search_path=pg_catalog` and no public EXECUTE emits only `pg_notify('truco_jobs_ready', '')` on pending INSERT/reschedule. NOTIFY is a post-commit wake-up; polling and worker recovery are mandatory in the next increment.

## Consequences

Results and jobs can share one PostgreSQL transaction; jobs do not depend on notification delivery. Workers will use `FOR UPDATE SKIP LOCKED` and short transactions. Delivery is repeatable and effects must be idempotent. Leases/tokens are reserved for tasks leaving the transaction; they promise no automatic recovery before a worker exists.

Compose/global parameters need no changes: LISTEN/NOTIFY and SKIP LOCKED are native. The future listener requires a dedicated connection/session pooling, not transaction pooling. Login/Argon2 work does not belong in this queue and must not persist passwords. The current room queue is unchanged.

Migrations are additive and write no player data. The local environment retains its previous trust model (local owner role). Least privilege, TLS and database/backup encryption at rest require configuration and evidence from the future environment; schema does not verify them. Retention/security boundaries are in `docs/database.md` and `docs/security.md`.

Account recovery, XP/point amounts, level curves, anti-win-trading rules and guest/training grants remain pending. Live-state crash recovery is still absent: the queue protects results only after commit.
