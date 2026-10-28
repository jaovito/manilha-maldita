# Database migrations, deployment, and local seeds

PostgreSQL 18.6 Alpine runs in Docker Compose, with Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, and Bun's native SQL driver. The authorized M5 setup adds product schemas and migrations; the server does not use them yet, and gameplay does not query the database.

## Development

```sh
# Optional: customize local settings before starting the containers.
cp .env.example .env
bun run db:up
bun run db:migrate
```

Do not overwrite an existing `.env`. Without one, commands use the local defaults in `.env.example`. If you change ports/passwords, keep `DATABASE_URL` and `TEST_DATABASE_URL` consistent with the Compose variables.

- Development: `127.0.0.1:55432`, database `truco_dev`, user `truco`, volume `truco_postgres-data`.
- Tests: `127.0.0.1:55433`, database `truco_test`, user `truco_test`, temporary `tmpfs` storage discarded when the container stops.
- Both publish ports on loopback only and have health checks; Compose waits for PostgreSQL to become ready.
- Example credentials are fictitious and exclusively local. Never reuse them in production.

`bun run db:down` stops only the development PostgreSQL service, preserving its volume. `bun run db:test:down` stops only the test instance, discarding its temporary storage. There is no destructive development database reset command. Do not use `docker compose down -v` if you want to preserve data.

## Structure and migration lifecycle

```text
apps/server/
  drizzle.config.ts
  database/
    target.ts             # explicit selection and validation of the local target
    connect.ts            # Bun SQL + Drizzle connection
    schema.ts             # exports for Drizzle generation
    schema/               # accounts, catalogs, results, and jobs
    migrations/           # versioned SQL and Drizzle metadata
    migrate.ts
    cli.ts
    seeds/
      run.ts              # transactional runner
      registry.ts         # local product seeds, initially empty
  tests/database/         # guards and real PostgreSQL integration
```

Migrations 0000/0001 reserve the `app` namespace and remain unchanged. Migration 0002 creates the 11 M5 tables, and 0003 installs the queue function/trigger. Drizzle manages the history; do not edit it to force application. `schema.ts` exports models from `schema/`; the generator entry point already loads those files. SQL triggers and functions remain in a versioned custom migration.

When introducing approved models, declare them in schema files grouped by feature and adjust the glob in `drizzle.config.ts` when necessary. Generate SQL with `bun run db:generate --name=description`, review it, and run `bun run db:migrate`. Commit new migrations with their snapshots and journal. Do not rewrite applied migrations or use `push` to bypass review.

`bun run db:migrate:test` applies the same history exclusively to the test database. Local test/seed commands reject production mode, remote hosts, databases/users outside the target, and connection parameters that could redirect the destination. In non-production mode, `db:migrate` retains the same development-target guards. `TEST_DATABASE_URL` never falls back to `DATABASE_URL`. Validation errors do not print the URL or credentials. Production migrations use the explicit deployment path described below; test and seed commands never use that path.

## Seeds and fixtures

Each seed task declares an `id` and `run(transaction)`. Register only deterministic, fictitious data compatible with existing models in `developmentSeeds`. Upsert using stable keys so that running twice produces the same state without duplicates. Avoid uncontrolled randomness and changing dates in tests.

`runSeeds` rejects empty/duplicate IDs and runs the entire batch in one transaction: if a task fails, the batch rolls back. It does not truncate tables, reset automatically, or bypass domain validation. Once modules exist, data creation that requires business rules must use their authorized operations.

The registry should only list imported tasks: implement operations in separate seed files, which also participate in coverage. The local registry contains the cosmetic catalog seed. Migration 0007 now supplies that same product reference data during setup, so `db:seed` is optional for development and is never required in production. Test fixtures are not added to the registry.

Integration tests create a dedicated schema with a random identifier, insert two deterministic fictitious rows, verify repetition without duplication and rollback, and remove their own schema afterward. They do not depend on developer data and can coexist without deleting unrelated tables. The random name isolates the test namespace; fixture contents remain fixed.

## Verification

The M5 suite applies migrations to the test database and checks constraints, deletion/anonymization, NOTIFY delivery after commit, no notification on rollback, persistence without a listener, and two real consumers using SKIP LOCKED. Worker behavior did not exist in the initial setup; those regressions validate the SQL foundation rather than a complete queue service.

```sh
bun run test:database
bun run test:coverage
bun run check
```

`test:database` starts only the test service, waits for its health check, and measures coverage of connection, target selection, migration, and seed infrastructure. `test:coverage` includes this suite, and `check` requires it; full verification and CI therefore need Docker/Compose. Engine unit tests and DOM tests remain runnable separately without a database.

The test database remains available afterward; stop it with `db:test:down` when finished. Shared instances are not stopped automatically. Configuration, CLI, and the seed registry are infrastructure outside the product metric; executable connection, migration, and seed modules are inventoried and require the same 80% minimum as other measured files.

## M5 setup models

| Table | Data and invariants |
| --- | --- |
| `accounts` | UUID, unique canonical login (`[a-z0-9_]{3,32}`), Argon2id PHC hash, status, and creation time. No email, identity document, legal name, or reversible password. Hash format does not prove its parameters. |
| `sessions` | Account, hexadecimal SHA-256 hash of a future random token, creation, expiration, and revocation. Unique hash; SQL format validation does not replace cryptographic generation/validation in the application. |
| `profiles` | Public nickname and optional avatar, deck, and table FKs. `NULL` means a default selection to resolve in the application; no artificial catalog is created. |
| `avatars` | Stable ID, name, `avatar_url` relative to `/art/`, minimum level, availability, and ordering. No uploads or external hosts. Asset existence and any atlas crops will be validated when configuring the catalog. |
| `deck_themes`, `table_themes` | Separate catalogs with a trusted asset key, minimum level, availability, and ordering. Never player-supplied CSS/JavaScript or URLs. |
| `player_progress` | Accumulated, nonnegative XP and competitive points stored as `bigint`. Level derives from the future curve; there is no `level` column. Do not convert to `number` without a safe bound; future DTOs must define serialization. |
| `match_results` | Authoritative summary by match ID, preset, format, training mode, score, reason, winner, public counts, timestamps, and policy version. No cards or snapshots. |
| `match_participants` | Seat and optional account per match; duplicate accounts/seats are prohibited. Context is validated by a composite FK. An absent account supports guests/bots and anonymization. Team derives from seat parity. |
| `match_rewards` | One grant per participant, XP/points, and date. A composite FK preserves preset/training context; positive points require competitive, non-solo play. Winner, amount, eligible account, and total updates still require application validation. |
| `jobs` | `match_rewards` work linked to a result, unique by type/match. No JSON payload, player data, or credentials. |

These tables do not implement account recovery, a password policy, an XP curve, anti-collusion rules, reward grants, or unlock validation. The application is authoritative; constraints provide additional defense rather than authorizing direct player SQL. Cosmetic selections must validate XP/level and availability on the server and preserve the owner's theme in projections without identifying hidden cards.

## PostgreSQL result queue

No extension or global configuration is required: PostgreSQL 18 already provides LISTEN/NOTIFY and SKIP LOCKED. Migration 0003 installs the `jobs_notify_ready` trigger and `app.notify_jobs_ready()` function with a fixed search_path, invoker privileges, and EXECUTE revoked from PUBLIC. Channel `truco_jobs_ready` carries only an empty string, including on rescheduling; notifications may be coalesced. Consumers must drain the table, never count notifications as jobs.

The setup provides `pending`, `running`, `completed`, and `failed` states, `run_at`, attempts, a limit, lease deadline/token, completion time, and a restricted error code. The default of five attempts and technical ceiling of one hundred are reversible setup parameters, not reward policy. Partial indexes support pending work, expired leases, and terminal cleanup.

Worker contract to implement:

1. Create the result and job in a trusted transaction; rollback neither saves nor notifies. Never treat client results/rewards as authoritative.
2. Listen through a dedicated connection (or session pooling); LISTEN cannot depend on transaction pooling. Confirm subscription before querying pending work on startup/reconnection. Poll as a fallback even without notifications.
3. Select a small batch of due jobs with `ORDER BY run_at, id FOR UPDATE SKIP LOCKED`, without holding a transaction during external waits. This queue does not guarantee global ordering across consumers.
4. For PostgreSQL-only rewards, apply grants, atomic total increments, and job completion in the same short transaction. Uniqueness prevents repetition; update multiple accounts in a stable order to avoid unnecessary deadlocks.
5. For work outside the transaction, acquire a lease with a token/deadline, confirm it before execution, and require the same token on completion. Recover expired leases, reschedule with increasing delays, limit attempts, and inspect `failed` jobs. Leases do not remove the need for idempotent effects.
6. Bound workers/connections/batches and monitor wait time, pending age, failures, locks, and table growth. Measure cleanup, autovacuum, and capacity before considering partitioning.

The initial setup had no consumer. The second increment provides `PostgresJobQueue` and `startJobWorker`, with polling/retries/recovery described below; cleanup and capacity metrics remain unimplemented. The per-room command/timer queue remains in memory. A result becomes durable only after commit; crashes before that remain a limitation of the current live state.

### Transactional consumer — increment 2

`src/modules/jobs/adapters/outbound/postgres-queue.ts` receives a Bun.SQL client and a required processor. `enqueue(tx, matchId, maxAttempts)` accepts only a transaction handle; the producer must write the authoritative result in that same transaction. Repeated enqueue preserves the existing job/state/attempts/deadline. The queue has no public endpoint or empty production processor.

`runNext()` leases one due row (or an old expired lease), increments the attempt count, and calls the processor inside a savepoint while holding the row lock. SQL effects and `completed` status share the commit. Exceptions roll effects back to the savepoint and record only retry/failure; connection loss rolls back the entire transaction and releases the job. The processor must use only the supplied handle for effects in the same database, without HTTP, email, other clients, commit/close, or any external I/O. Types define an integration contract, not a sandbox for untrusted code.

Enqueue inputs remain `unknown` until type and domain validation: opaque IDs of 1–80 `[A-Za-z0-9_-]` characters, matching the protocol, and numeric integer attempts from 1–100. Values always use Bun.SQL parameters, including values read from the database; table/column names, ordering, and SQL are static. Do not use `unsafe`, `sql.raw`, ordinary interpolated strings, or SQL keyword blacklists to process inputs. Format checks complement parameterization rather than replacing it. See the [SQL security policy](security.md#parameterized-sql-and-input-validation).

Retry starts at 1 s, doubles up to 60 s, and respects `max_attempts`; these operational parameters are reversible. Failures do not persist exceptions/payloads, only `JOB_PROCESSING_FAILED`. Old expired leases with exhausted attempts become `failed` with `LEASE_EXPIRED`. PostgreSQL time controls due dates. Statement/idle timeout is 5 s, local to the transaction; do not execute long functions or external side effects. External consumers with separately published leases must not be mixed in without reviewing fencing/idempotency.

`startJobWorker` receives the queue port, scheduler, and safe event sink. It performs an initial scan after LISTEN, wakes on NOTIFY/reconnection, and queries every 1 s even without notifications. It coalesces notifications, runs one job at a time, and yields after 25 operations; option bounds are validated. Storage failure ends the round without a busy loop. Shutdown cancels polling/wakes, removes the listener, and awaits ongoing work; the SQL client remains the caller's responsibility. The adapter uses Bun.SQL's dedicated listener; do not use transaction pooling on this path.

The components are available for composition, but `startServer` does not start them: actual XP/point grants and the result producer must be implemented first. Importing the module does not consume jobs, open connections, or install timers. See [ADR 012](adr/012-postgresql-job-processing.md) for protocol and limits.

## Access, retention, and deletion

Only the backend will access the tables; the frontend receives allowlisted DTOs. The local environment retains the existing owner role, with no claim of production least privilege. At deployment, separate migration/DDL credentials from runtime roles, restrict catalogs/credentials/results by responsibility, use verified TLS, and prove database/backup encryption at rest. Never expose the tables directly as an API.

Proposed technical baseline for later increments, without real collection or cleanup routines in this setup:

- Account/profile/progress: until a deletion request; profile, progress, and sessions cascade on deletion. Rankings publish only the nickname, never the login.
- Sessions: application revocation/expiration; remove expired or revoked records within 24 h. Usable tokens are never persisted.
- Results, participants, and rewards: 90 days; deleting a result removes its children/jobs. Account deletion removes the participant link (`SET NULL`), preserving only a summary without nickname/credentials; other operational records require review in the deletion flow.
- Completed jobs: 7 days; failed jobs: up to 30 days for diagnosis using a safe code. Pending jobs/leases are not discarded by age or alongside an unprocessed result; alert and resolve them before cleanup.

These periods are reversible minimization assumptions and must be operationalized before enabling actual persistence. After history expires, long-term totals remain in `player_progress`; full reconstruction from a ledger with finite retention is not promised. Backup deletion must follow the environment's policy and does not imply immediate DELETE from existing copies.

In worktrees, isolate `COMPOSE_PROJECT_NAME`, ports, and URLs in an ignored `.env`, without reusing the primary checkout's volumes/database. The test database remains exclusively `truco_test`, with role `truco_test`, a loopback host, and temporary storage. Do not apply new migrations to a shared development database without a request.

References: [NOTIFY](https://www.postgresql.org/docs/18/sql-notify.html), [LISTEN](https://www.postgresql.org/docs/18/sql-listen.html), [SKIP LOCKED](https://www.postgresql.org/docs/18/sql-select.html).

The worker receives explicit configuration through `WorkerOptions`: default polling is 1,000 ms (bounds 10–60,000 ms), with up to 25 jobs per wake (bounds 1–100). Defaults and bounds are named constants in `application/worker.ts`; invalid options are rejected before subscription. Future worker composition may read environment variables and pass these options; the application layer does not access `process.env`.

The third increment's credential foundation generates Argon2id hashes and SHA-256 verifiers compatible with `accounts.password_hash` and `sessions.token_hash`, demonstrated in `account-credentials.test.ts` using real PostgreSQL and rollback. Passwords are prepared with HMAC-SHA256 using the mandatory environment-only `PASSWORD_PEPPER`; Argon2id still generates independent random salts. The database stores neither the pepper nor a usable session bearer. That increment added no migration or runtime account writes; the following account API increment adds repositories and revocation while operational retention remains pending. See [ADR 013](adr/013-account-credential-foundation.md).

## Account API persistence

Migration 0004 adds `auth_rate_limits` with HMAC-only scope keys, bounded attempts, expiration and an expiry index; prior migrations remain immutable. Registration writes account, profile, initial zero progress and a session in one transaction. Session issuance checks/locks active account state and rotates the presented same-account session atomically. Reads enforce active account, expiry and revocation; logout updates the verifier's record. No result, XP or competitive-point producer is connected.

Rate checks use atomic PostgreSQL upserts, shared across consumer instances, before password work. Expired records are eligible immediately and deleted on later admission in batches of at most 100; physical deletion while idle is not implemented. Global admission bounds creation of peer/login keys. Repository and limiter operations use local statement/lock timeouts; deployment still needs a bounded client pool and operational connection settings. Fixtures use only the dedicated test instance and remove their own account/rate records. No production migrations or player writes were executed. See [ADR 014](adr/014-account-authentication-api.md).

## Persistent player backend and operation

Migration `0005_player-progression-security.sql` adds recovery verifiers, fixed audit events, immutable reward policies, replay receipts and avatar atlas indices. Migration 0007 populates four current pixel avatars and three independent deck/table choices using stable IDs. Existing curated rows are preserved with `ON CONFLICT (id) DO NOTHING`; runtime manifests allow only supported presentation assets. Apply migrations explicitly before enabling accounts:

```sh
bun run db:up
bun run db:migrate
# Set PASSWORD_PEPPER securely in the server environment before activation.
NODE_ENV=development ENABLE_ACCOUNTS=true bun run start:server
```

The example above targets the designated local development database. For production, use the deployment command below with a separate privileged migration role; seed and test commands remain local-only. Tests use only `TEST_DATABASE_URL` and the isolated Compose test database. No remote database was changed by this increment.

The live application uses a bounded Bun.SQL pool (`DATABASE_POOL_SIZE=4`, range 2–8) and a dedicated LISTEN connection, with certificate verification for remote URLs (`sslmode=verify-full`). `ENABLE_ACCOUNTS=false` avoids persistent composition. Database migrations are never applied automatically by server startup. A missing curated default fails startup, and reusing a reward version with different values fails closed. [ADR 015](adr/015-persistent-player-backend.md) lists all typed worker, outbox, lease and policy settings, data access/retention, and failure boundaries.

One result transaction also inserts participants and its `match_rewards` job. The processor uses that result's immutable policy and captured account seats, inserts each participant grant once and increments bigint progress in the same savepoint as completion. Public progress values are decimal strings. Cosmetic selection locks actual progress, validates active catalogs and derives level server-side. Ranking uses positive competitive points, 50 entries per page, at most 1,000 pages, and account ID as the internal stable tie break; IDs are omitted from public entries. This bound intentionally limits deep offset work; accounts below the first 50,000 entries are not exposed through pagination yet.

Maintenance uses bounded 100-row deletes per category and existing targeted indexes, not pg_partman. Finished/revoked sessions are retained for one day, audit for seven days, completed jobs for seven days, failed jobs for thirty days, and results/participants/reward ledgers for ninety days when no unfinished job remains. Pending work is preserved. Progress remains until account deletion. Opaque match receipts remain after result deletion so a repeated result cannot produce new rewards. These receipts and versioned policy rows have no player references. Account deletion cascades profile/progress/session/security rows and nulls historical participant/audit references. No database administrator credential or operational retry endpoint is exposed to players.

Migration 0006 adds `reward_policies.solo_xp_percent` with a 0–99 constraint. Existing policies default to zero, preserving historical training eligibility. New default policy `m5-v2` uses 50%; operators must choose a fresh version when changing any policy field. Reward rows preserve the actual solo context, and the existing database constraint still forbids positive competitive points for solo play.

## Production pre-deploy

Configure Railway's **Pre-deploy Command** to run from the repository root:

```sh
bun run db:migrate
```

With `NODE_ENV=production`, this command requires an explicit `DATABASE_URL` with database name, username/password and exactly `sslmode=verify-full`. No other URL query parameters or fragments are accepted. The Bun SQL connection explicitly verifies the certificate (`rejectUnauthorized: true`); private networks do not waive TLS requirements. Provision a trusted certificate chain before deployment; never disable verification to work around connection errors. This command does not require `ENABLE_ACCOUNTS` or `PASSWORD_PEPPER` and has no local fallback in production.

Use a deployment role permitted to create the `app`/`drizzle` schemas and their tables, indexes, triggers and functions, and to insert the reference catalog. Keep its credentials in deployment secrets; use a separately provisioned least-privilege role for the game server. If the platform shares `DATABASE_URL` between phases, arrange separate credentials/environment for the migration job rather than leaving schema-owner access in the runtime. This change does not provision roles, TLS or backup encryption.

One connection acquires a fixed PostgreSQL advisory lock before Drizzle reads history. Concurrent invocations wait up to the lock timeout (30 seconds); statements have a 120-second timeout. Connection closure releases the lock on success/failure. Drizzle applies only pending migrations in its transaction and records them in `drizzle.__drizzle_migrations`. Failures exit nonzero with an allowlisted category, execution phase and fixed hint, without printing driver messages, SQL, URLs or credentials; the deployment must stop. Database administration tools can inspect migration state separately.

Migration `0007_initial-cosmetic-catalog.sql` inserts only product data: four avatars, three decks and three tables. It creates no player account, progress, reward or fixture. Existing rows are preserved, including curated availability and unlock levels; repeating migration commands does not restore changed/deleted items. Future catalog changes require a new reviewed data migration. Assets remain bundled with the frontend, and the database stores only trusted references.

Do not run `db:seed` in production. `NODE_ENV=production` with `seed` or `--test` is rejected, and unsupported CLI arguments fail before connecting. Do not edit applied migrations, delete migration history or reset the database during deployment. No production database was migrated during local verification.

### Safe migration failure diagnostics

The CLI reports `Database command failed [CATEGORY; phase=PHASE]` followed by a fixed hint. Configuration failures remain distinct from connection, lock and migration execution. Recognized Bun transport/TLS codes and PostgreSQL SQLSTATE values are mapped through an allowlist, including nested Drizzle causes; unknown driver details are discarded. Only five nested causes are inspected, and arbitrary error properties never become log text.

| Category | Next investigation |
|---|---|
| `INVALID_MIGRATION_ENVIRONMENT` | Explicit production `NODE_ENV`, required `DATABASE_URL`, URL syntax and exactly `sslmode=verify-full` |
| `INVALID_LOCAL_DATABASE_TARGET` | A hosted command may be running through local tooling; verify the intended environment/target |
| `DATABASE_TLS_FAILED` | Trusted certificate chain, validity and matching hostname; do not disable verification |
| `DATABASE_CONNECTION_FAILED` | Database availability, DNS, port, network access and TLS configuration |
| `DATABASE_AUTHENTICATION_FAILED` | Deployment credentials and authentication policy |
| `DATABASE_PERMISSION_DENIED` | Deployment role privileges for the reviewed schema/migrations |
| `DATABASE_OPERATION_TIMED_OUT` | Competing migration locks or operation duration |
| `MIGRATION_HISTORY_CONFLICT` / `MIGRATION_SQL_FAILED` | Review database state and the versioned migration using authorized tools; never reset production to force application |
| `MIGRATION_FILES_MISSING` | Packaging of versioned migrations and the journal |

The category is diagnostic evidence, not proof that a hosted environment has been repaired. If the driver supplies no recognized code, the CLI retains `DATABASE_COMMAND_FAILED`. Record the commit, command, category and phase; never paste a connection URL, pepper, password or raw SQL/driver error into a public issue. These diagnostics do not change TLS requirements, local-only seed/test guards, timeouts or migration transactions.

## Request context in authentication audit

Migration `0008_auth-audit-request-context.sql` adds nullable `client_ip inet`, bounded `client_context jsonb`, and an account lookup index to `app.auth_audit`. Existing audit rows remain without context. The JSON object allows only `userAgent` (1–512 UTF-8 bytes, no control characters) and `clientVersion` (1–64 ASCII letters/digits/dot/underscore/hyphen, first character alphanumeric), with a database size ceiling of 2048 bytes. No GIN index or arbitrary header/payload storage is added.

Request IP comes from the actual socket and the existing exact-IP trusted-proxy resolver. Only explicitly trusted peers may supply forwarded chains; the nearest untrusted hop is selected from the right. Untrusted browser forwarding and invalid IP values cannot set the stored IP. An absent or invalid peer is NULL. Malformed/oversized client hints are omitted rather than making authentication unavailable. Client hints are not identity or authorization evidence. The frontend sends its existing public build number through `X-Client-Version` for account requests. No new environment variable is required.

Successful registration/login, logout, recovery-code issuance, recovery and password changes attach context to the existing fixed events. Credential-denial events retain bounded context without login/password/account enumeration data. The seven-day, bounded audit cleanup remains in effect, including unlinked failures. Account deletion anonymizes linked historical events and clears both context columns through the foreign-key detachment trigger in the same transaction. Audit inserts lock an existing account before recording linked context, so concurrent deletion and late writes cannot restore identifying metadata. The unlinked `account_deleted` event deliberately stores no request context. A deletion cannot attribute earlier unlinked login failures to that account; those expire through the seven-day policy.

Migration `0009_additional-pixel-avatars.sql` expands supported avatar indices to 0–7 and inserts four independently bundled PNGs at levels 5–8 with `ON CONFLICT DO NOTHING`. Existing catalogs, availability, unlock levels and selections remain intact. The original four-portrait atlas and its indices 0–3 remain unchanged. Generated assets and prompts are documented in `apps/web/public/art/avatars/README.md`. Run the usual explicit migration command before enabling these entries; production seed execution is unnecessary.

Coordinate frontend/API rollout for the expanded trusted avatar whitelist. Browser tabs built against the previous four-avatar protocol need a reload to render the new portraits. No hosted migration or production rollout was performed during implementation.
