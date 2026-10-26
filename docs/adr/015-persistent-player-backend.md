# ADR 015 — Persistent player backend and authoritative progression

- Status: accepted for implementation; production infrastructure remains unverified.
- Date: 2026-10-22.
- Scope: the owner authorized the remaining M5 backend after increments 1–4, preserving optional accounts and guests.

## Decisions

`ENABLE_ACCOUNTS=true` composes the account API, player repository, result producer, PostgreSQL reward worker and retention scheduler. Disabled is the default. Schema migrations and curated seeds are explicit steps before startup. No remote resource or deployment is created by this change.

The approved initial policy is configurable and versioned: 100 XP per completed match, 50 additional XP for a win, 10 points per competitive win, and level `1 + floor(XP / 500)`. Casual wins grant XP without ranked points. The original policy excluded training and abandonment. The authorized 26/10/2026 revision introduces `m5-v2` with `REWARD_SOLO_XP_PERCENT=50`: completed solo matches receive half the total XP, rounded down, with no ranked points. Existing policy rows retain zero solo XP and are never rewritten; delayed jobs use the policy captured at match start. Abandonment remains excluded. The conservative completion-only interpretation also excludes surrender, expiry and technical endings; this explicit provisional classification avoids rewards for interrupted matches. Only account identities captured at match start are eligible; guests are never retroactively linked. Partners occupy alternating seats. Active accounts receive grants; deleted/disabled accounts do not. Ranking sorts positive competitive points descending and internal account ID ascending for stable ties; public responses omit account IDs and credentials. This is an accumulated-points ranking, without matchmaking, Elo, seasons or anti-collusion enforcement.

Reward policy versions are immutable once registered. Changing an amount requires a new version. Results preserve the version from match start, and delayed jobs use that stored policy. The current configured XP step determines displayed levels and unlocks; changing the step intentionally recalculates them and requires product review. Progress uses PostgreSQL bigint and decimal JSON strings, including level, so JavaScript rounding cannot alter unlock decisions.

## Result and job lifecycle

Before drawing cards, the server reserves one bounded in-memory result slot (default 1,024). Saturation rejects a new match before gameplay entropy is consumed. Finished summaries contain outcome, scores, counts, timing and frozen seat/account references, never cards, stock, powers in hand, seeds, cookies or arbitrary client payloads. The summary survives rematch/room expiry in the process until commit, with bounded retries and fixed telemetry codes. Shutdown marks active matches technical and attempts to drain results before stopping the worker and database pool.

One transaction inserts the replay receipt, authoritative result, participants and reward job. LISTEN/NOTIFY wakes a worker; polling recovers missed notifications. SKIP LOCKED and the existing transactional processor serialize work across consumers. The unique participant reward ledger and progress increments commit with job completion. Retries, duplicate result submissions and manual job retries cannot grant twice. Opaque match receipts remain after 90-day result retention to prevent replay; they contain no player reference.

Durability begins at database commit. Live rooms, command queues and pre-commit summaries remain in memory. A process crash can lose an unfinished match or an uncommitted result; this change does not implement distributed rooms, event sourcing or crash replay. Notifications are wakeups, not the durable queue.

## Account and transport security

Account cookies use HttpOnly, SameSite=Strict and `/api`, so HTTP and WebSocket handshakes authenticate directly. Legacy `/api/accounts` cookies are removed when issuing/clearing a cookie. The server derives a stable private seat identity from the authenticated account; no client account ID is accepted. Guests retain their original flow. An invalid account cookie does not silently downgrade to a guest.

Handshakes validate database sessions and profile state. Established sockets use a five-second revocation lease, refreshed outside gameplay with at most four concurrent queries and a bounded lease map. Local logout/password changes/recovery/deletion close affected sockets immediately through revocation listeners. Remote disable/revocation and storage failures expire access within the configured lease (1–10 seconds); every outbound snapshot and command checks expiry. There is no SQL query per gameplay command. A read-only authorization guard is rechecked inside the room queue before executing a command. Handshake grants are bounded and single-use; validation/refresh deadlines start before the database read, refresh batches never overlap, and retired connection callbacks cannot alter or borrow replacement leases. This is bounded revocation, not a globally instantaneous revocation guarantee.

Registration/login and credential maintenance share durable global/peer/login admission and the same Argon2 capacity limiter. Password hashing runs outside database transactions. Session issuance subsequently locks the account and compares the exact verified password hash, preventing a concurrent credential change from issuing a session based on the old proof. An offline baseline blocks common passwords for new credentials; an optional reviewed local `PASSWORD_BLOCKLIST_FILE` extends it, bounded to 8 MiB and 100,000 lines. It is not a comprehensive breached-password corpus. Login verification still supports existing credentials. Passwords are never sent to external checking services.

Authenticated recovery-code issuance, password change and deletion require the current password. Recovery uses a random 256-bit one-time code, with only a domain-separated SHA-256 verifier persisted. Successful recovery atomically replaces the password/code and revokes all sessions; concurrent reuse permits one success. Codes are returned once in no-store responses. There is no email, security question, administrative bypass or recovery if both password and recovery code are lost. Password changes invalidate the recovery code. A missing/changed pepper prevents password reauthentication, but the independently stored recovery verifier can authorize a reset when a recovery code was previously issued.

Fixed audit events retain an optional account reference and timestamp, without raw IPs, attempted logins, passwords, tokens or recovery codes. Failed authentication events are bounded by admission. Deletion cascades credentials/profile/progress/sessions and anonymizes participant/audit references. Auditing occurs after the credential transaction; it is operational evidence, not an atomic compliance ledger.

Forwarded IPs are ignored by default. `TRUSTED_PROXY_IPS` names at most 32 exact socket peer IPs. Only a trusted actual peer enables bounded X-Forwarded-For parsing, traversed right to left to the first untrusted hop. Configure the actual deployment topology explicitly; trusting an arbitrary Internet peer breaks this boundary. Without that configuration, proxy users share the proxy's rate budget. This change does not assume Railway proxy addresses.

## Cosmetics and visibility

Three independent catalogs contain avatars, decks and tables. Seeds reuse the existing pixel avatar atlas; there are no uploads or arbitrary player URLs/CSS. Runtime manifests permit only known assets and rendering keys. Deck manifests describe backs, rank and suit styles; rendering new styles belongs to the frontend increment. Table themes affect the viewer's table. Seat projections expose each owner's avatar/deck so other players can see unlocked styles, with appearance frozen through that match. Hidden cards remain hidden, and vira retains its existing presentation.

Selections accept exactly three cosmetic IDs and validate availability plus the level computed from locked server progress. No XP/level/points mutation route exists. Unsupported, disabled or no-longer-unlocked stored selections fall back to defaults. Powers remain random, fully available from the start and independent of progression.

## Operation and limits

The typed configuration defaults to a four-connection SQL pool plus Bun's dedicated listener, bounded statement/lock timeouts, one worker operation at a time and 25 jobs per wake. `/health` is liveness; `/ready` reports cached database/producer/worker/maintenance availability without credentials or a database query per probe. It is not a queue-depth dashboard or a verified capacity benchmark.

Remote database URLs require `sslmode=verify-full` and certificate verification. Production activation also requires Secure cookies and explicitly configured HTTPS origins. Actual HTTPS/WSS termination, origin encryption, database/backups encryption at rest, least-privilege production roles, secrets custody and 1 GiB Railway resource capacity still require environment evidence before publication.

Retention runs in bounded batches: expired/revoked sessions after one day, expired attempt counters, audit after seven days, completed jobs after seven days, failed jobs after thirty days, and results/participants/reward ledgers after ninety days only without unfinished work. Progress remains until account deletion. Recovery verifiers remain until replacement/invalidation/deletion. Replay receipts and policy versions have no player reference and persist for idempotency. Pending jobs are not automatically discarded.

The [player API contract](../player-api.md) documents endpoint bodies, public DTOs and errors.

## Verification

Unit tests exercise policy boundaries, immutable summaries, saturation before entropy, retries/shutdown, frozen identity/appearance, strict input, permission leases, proxy spoofing and password blocking. Real PostgreSQL tests cover policy conflicts, transaction rollback, retries, all reward eligibility cases, 2v2 teams, guests/deletion/disabling, exact bigint arithmetic, unlocks, ranking and retention. Full backend E2E starts the production HTTP/WebSocket composition with a controlled game clock, completes a real multiplayer match and observes committed reward processing. Recovery races use real HTTP, Argon2 and PostgreSQL. Backend/SQL suites share one coverage process so the complete runtime is measured together; DOM runs separately. No production environment is certified by these local tests.
