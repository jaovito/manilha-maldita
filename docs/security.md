# Privacy, sessions and security

Read before changing projections, card interfaces, HTTP/WS, sessions, logs, auditing or seat resumption. Timing and abandonment rules are in [rules.md](rules.md); serialization and idempotency are in [architecture.md](architecture.md).

## Privacy, sessions and security

Build allowlisted projections: public, individual and team only when authorized by a rule. Do not copy the whole state and remove fields afterward. Never broadcast internal state and filter it in the browser.

Protect assigned but unactivated powers from every other seat, including partners, along with other players' hands, ordered draw piles, seeds, discards, face-down/masked cards and private Espião results across HTTP, WS, errors, analytics, logs and reconnection. IDs can also leak cards: use opaque presentation references, not `3-clubs` for a hidden card. Do not reuse an ID revealed by Espião in a masked play, allowing premature correlation. Previously known information cannot be erased, but new messages must not reveal which card was masked.

Resume tokens must be unpredictable, bound to a seat/session, expiring and revocable. Room codes are invitations, not identity. Do not put tokens in URLs/logs. Prefer secure `HttpOnly` cookies where possible; validate origins during WS handshakes. CORS does not replace authorization.

Validate payloads/nicknames/enums, bound messages and outbound queues, apply per-session/IP/room rate limits and control join attempts. Never render nicknames as HTML. Protect configuration with host authorization; freeze teams and rules at match start.

Only one connection controls a seat: replacing a connection invalidates its predecessor without trusting nicknames. Revalidate session/room/seat membership on resumption. Keep secrets out of Git; `.env.example` must contain no real values. Use production TLS without disabling certificate validation.

Do not send player data to external debugging services. Projections cannot prevent partners sharing cards over voice; do not promise anti-collusion. Future full replays require a finished match and explicit authorization.

## M2 implementation

The resume credential is an HttpOnly/SameSite=Strict cookie containing two cryptographic UUIDs, expiring after 24 hours, scoped to `/api`, with configurable Secure for HTTPS. The token stays in the session adapter; authority receives only an internal ID and resolves room/seat membership before deduplicating or projecting. Public links carry only room codes. A new connection replaces its predecessor; the old socket receives `CONNECTION_REPLACED` and the client does not reconnect it automatically.

Exact origins are required for HTTP mutations and WS handshakes; a missing `Origin` is also rejected. Strict Zod schemas reject extra fields and attempts to submit authoritative seats/entropy. The application rechecks phase, card ownership, context and revision. Outbound snapshots are schema-validated, and connections close for expired sessions or excessive queues; one recipient's failure neither reverses an accepted command nor prevents another socket from resuming.

Limits: 8 KiB per HTTP/WS input; 64 KiB per outbound message/native queue; 16 in-flight messages per socket; 60 WS messages/min per session; 120 HTTP requests/min per real IP and 180/min per session; up to 10,000 sessions and 10,000 rate-limit keys. Forwarded-IP headers are not trusted. These are conservative operational defaults, not production capacity measurements.

There is no external analytics collection or payload logging. HTTP and WS errors use allowlists/stable codes without stacks, cards, tokens or seeds. In-memory deduplication retains 512 recent results per room, partitioned by logical player and match; revisions/contexts continue rejecting old replays after eviction. Restart loses state and credentials; it neither records a loss nor allows rebuilding a room using client identity.

## Cryptography and persistence policy

On first access, the nickname draft stays in local welcome-screen state; only confirmation of a valid value saves the preference. Confirmation does not create a session or send the nickname: the guest endpoint is still called when creating/joining a room. Profile edits after confirmation update/remove the preference.

The nickname is stored as a browser `localStorage` preference under `truco.nickname` to avoid retyping after reload or session loss. The value is validated by the nickname contract and stored in plaintext, scoped to the origin, until replaced, cleared in the field or removed with site data. It is not a credential: same-origin scripts can read it. Session cookies remain HttpOnly; tokens, seats, cards and snapshots are never written to this storage. A valid session remains the identity source and may restore its nickname even after the local preference is removed. Blocked or full storage does not prevent play; no new player data is stored in the database.

M4 adds the local `truco.audio` preference: only volume between 0 and 1 and a boolean disabling effects. Stored values are validated; corruption or blocked storage falls back to defaults without preventing play. Access is same-origin and retention lasts until changed or site data is removed; there is no external synchronization or account association. The Web Audio synthesizer generates ordinary effects locally. Approved match-result music is fetched from two fixed same-origin asset paths after user interaction, without player data or an external audio provider. Comparisons of authorized snapshots stay only in memory; reconnection/initial load do not replay old events. localStorage still contains no tokens, cards, seats or snapshots.

Current state: M2/M3/M4 do not persist players, sessions or rooms in PostgreSQL. The local database contains only infrastructure and test fixtures. Local transport uses loopback HTTP/WS; this delivery publishes/configures no TLS. The client selects WSS for an HTTPS backend (or HTTPS page without a configured URL), but this does not install certificates or secure the proxy-to-backend path.

Before public exposure, serve frontend/API over HTTPS and sockets over WSS, configure Secure cookies and protect remote database connections with TLS and certificate verification. With a proxy/CDN, the origin connection must also be protected or stay on a controlled local channel. Certificates, HTTPS redirects and transport policies must be validated on the selected deployment; development defaults are not production configuration.

TLS provides confidentiality and integrity in transit; there is currently no need to invent secondary encryption for each JSON message. Encrypting cards with keys delivered to the same browser does not replace authorized projections: opponents' cards must remain outside the message.

Optional-account, cosmetic and result persistence remains in M5. Collect only what approved features require. When introducing persistence, define retention, access and database/backup encryption at rest; field protection must match sensitivity and the threat model, with keys kept separate from data. Nicknames, product identifiers and results do not automatically require per-field encryption. Sensitive personal data may require additional protection.

If passwords are adopted, store only appropriate password hashes, preferably Argon2id with salt and reviewed parameters; never plaintext or reversible authentication passwords. If session/resume credentials become persistent, store verifiers/hashes of random tokens when only comparison is needed, not usable values. No models, migrations, login or hosting resources were created in the original revision of this policy.

References: [OWASP — WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html), [Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) and [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### M5 setup — delivered protection boundary

The 2026-10-22 increment creates tables/migrations for optional accounts, cosmetics, progress, result summaries and a PostgreSQL queue. No endpoint, login, worker or player write was connected to the runtime; the M2/M3/M4 descriptions above still describe the running game. Data necessity, access, retention and deletion are defined in [database.md](database.md).

Accounts reserve canonical login names and Argon2id PHC hashes, not email or reversible passwords. Sessions reserve random-token hashes, expiration and revocation. Format constraints do not demonstrate password strength, hash cost or token entropy. Hashing/verification, attempt/concurrency limits, session rotation/revocation, CSRF, recovery and reauthentication remain required in the authentication increment. Schema alone does not stop brute force.

Nonnegative XP/points, unique account participation/rewards per match, catalog references and competitive/training context are database defenses. The future backend must derive users from sessions, reject extra fields, calculate levels from confirmed XP, authorize every selection and accept only room-authority results. There will be no public endpoint to increment XP/points or confirm wins. Catalogs/URLs are application-controlled, not player-controlled. The path regex restricts only format; the future catalog must still verify existing, trusted assets.

The queue stores only a reference to the match summary. The NOTIFY channel contains no IDs or private data; notifications are visible to database users and do not authenticate content. A forged notification merely wakes a worker, which must query/validate real jobs. The trigger function is not SECURITY DEFINER, fixes search_path and has no public EXECUTE permission. Queue access belongs in the backend; the local owner role does not represent secure production configuration.

Without runtime integration, protection against ranking fraud, win trading, incorrect eligibility, unauthorized cosmetic selection or repeated worker effects is not claimed as implemented. TLS, volume/backup encryption and production roles remain unverified in an actual environment. The queue cannot recover matches that were never persisted.

### PostgreSQL consumer security (M5, increment 2)

The transactional consumer now exists as an explicit component, still without a reward processor or server activation. It exposes no HTTP/WS, accepts no client XP/points/timestamps and executes no job-supplied code/URLs. Enqueue receives an existing transaction and a result FK; the authoritative producer is yet to be integrated. Login, anti-fraud and unlock policies remain pending.

The SQL processor and job completion share one transaction; errors roll effects back to the savepoint and lost connections roll back all work. Retries do not guarantee exactly-once effects for external services. Processors are trusted code and must not escape the transaction handle, commit/close transactions or perform external I/O. Types do not replace review of these invariants. Do not mix this with consumers completing jobs through leases/tokens without reviewing fencing.

NOTIFY/reconnection wake a scan, never treating payloads as commands. The scheduler coalesces notifications and limits operations per cycle; retry and polling have validated bounds. Only fixed failure codes are persisted, and operational events contain no IDs, payloads, stacks or credentials. Telemetry sink failures do not change processing. Future bootstrap must supply SQL connections with least privilege, validated TLS and bounded pools; this increment neither configures production nor stores passwords in the queue.

### Parameterized SQL and input validation

Queue review found no value concatenation into executable SQL: Bun.SQL tagged templates bind values as parameters; ordinary templates, `+` concatenation, `unsafe` APIs or `sql.raw` using input data do not provide that guarantee. Migration SQL and schema expressions are version-controlled code, not queries assembled from browser input. Every query must remain parameterized, including when a value came from the database itself, to prevent second-order injection.

The queue producer now accepts IDs/limits as `unknown` and validates runtime types before writing: opaque IDs of 1–80 ASCII alphanumeric, hyphen or underscore characters, matching the protocol; attempts must be integer numbers between 1 and 100, without string/object coercion. Schema/table/column identifiers, ORDER BY and SQL commands remain static. Any future dynamic selection must map a validated enum to trusted identifiers; never interpolate user-supplied names as arbitrary SQL.

Field-contract validation is additional defense. Do not rely on SELECT/DROP word blacklists, quote removal or regexes attempting to recognize SQL. A valid identifier named SELECT is literal data; passwords/text must not be rewritten to “escape SQL.” This does not change existing nickname contracts, resource authorization, rule validation or least-privilege deployment requirements.

Real regressions exercise quotes, comments, statement separators, unexpected types, boundaries and a malicious reference already in storage. Processing/UPDATE treat that reference literally, without touching the control row or producing extra increments. These tests validate exercised paths; they do not prove global environment security or future account endpoints.

Additional network tests start the real bootstrap, two sessions and HTTP/WebSocket connections to inject payloads into existing contracts. Rejections preserve profiles/authoritative state and do not block subsequent valid commands; malicious cookies do not authenticate. These guest scenarios cover the network boundary through in-memory authority. Separate account API tests now cover their own real HTTP→PostgreSQL path without claiming persistence for gameplay.

References: [Bun.SQL — tagged templates](https://bun.sh/docs/runtime/sql), [OWASP — SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).

## Power privacy (M3)

Accepted preparation commitments remain private until the batch closes; only readiness is public. Spending, usage and activations appear together after resolution. Espião remains only in its user's projection; partners do not receive the result. Reconnection snapshots use the same allowlist. Public activation history identifies power/actor/target without discards, replacements or inspected cards.

Máscara in an open trick sends only seat, marker and status, without physical identity or correlatable IDs; its owner retains their own view. Trick resolution reveals the card. Folding or ending without resolution does not reveal it. Face-down and remaining cards stay private, including after the match ends. Simulations use local synthetic data without external analytics or personal data.

Unused powers are redacted in authoritative projections before serialization: `players[].power` is `null` for other seats until an accepted public activation exists in that hand. Owners receive their assignment. Public activations change only when preparation closes or during the atomic play; readiness does not reveal choices. Reconnection and termination preserve this contract. This cannot prevent deductions from a known mirrored assignment policy or communication outside the game.

The face revealed by Espião is rendered only from `powers.intel` in the individual projection. Visual back selection stays in component memory, is not a physical card ID and does not affect sampling. After a still-opaque play by the target, the observation remains separate from remaining backs as historical memory until an authorized play reveals the same rank/suit from that seat or the hand count reaches zero; the UI never uses back removal to discover which masked/face-down card was played. No extra card, private position or tracking identifier was added to transport or local storage.

## Public backend URL

`VITE_BACKEND_URL` is public build configuration, never a secret or token. It accepts only an HTTP(S) origin without credentials, path, query or fragment. The client retains HttpOnly cookies and sends requests with credentials=include; CORS permits credentialed reads only for exact `ALLOWED_ORIGINS`, without wildcards, including error responses. Preflights allow only GET/POST and Content-Type and do not create sessions. Origin validation for mutations and WS handshakes remains mandatory; CORS middleware does not alter upgrade headers.

SameSite=Strict remains enabled: directly accessed frontend and backend must share the same site and scheme. Cross-site hosting requires an `/api` proxy on the frontend origin without loosening the cookie. This variable does not verify TLS, certificates or hosting configuration; this change performs no publication.

Nickname editing through POST `/api/guest` reuses the current credential after the same origin/schema checks. It changes no ID, token, expiry, existing seat or permission; only the in-memory nickname used for future joins. It adds no personal-data persistence.

`truco.locale` stores only the local tutorial language preference (`pt-BR` or `en`). It is not sent to the server and contains no personal data, cards or credentials. It persists until replaced or site data is removed, so the guide reopens in the chosen language. Blocked storage is tolerated. The tutorial creates no sessions or rooms.

## Test tools and solo bot

Under [ADR 009](adr/009-solo-training-and-development-tools.md), bot enablement is independent of environment. Editing tools require an explicitly development server, their own flag, a solo room and an authenticated owner. Production builds omit the panel; forged requests still face authoritative rejection. Never use VITE flags, query strings, localStorage or client data as authorization. The bot receives only its own projection. Internal bot-seat identifiers are not published. Rooms without connected humans expire; the bot does not prevent cleanup.

### Account cryptography foundation — M5, increment 3

The `accounts` module prepares login/password validation, a service sharing concurrency limits across hashing/verification, a configurable Argon2id adapter (default 19 MiB, two iterations, p=1) and random 256-bit tokens with SHA-256 verifiers. Passwords accept 6–128 Unicode code points without trimming, normalization, coercion or truncation; malformed UTF-16 is rejected. Login follows the database's canonical format. Accepted PHC format and verification costs are explicitly bounded; older supported costs can still verify after generation costs increase, without accepting arbitrary costs from corrupted hashes. Excess operations fail immediately without queuing passwords; operational errors contain neither input nor raw adapter errors.

Default CLI startup remains guest-only. The fourth increment below adds opt-in registration/login, repositories, per-account/peer limits and expiring/revocable account cookies; common/compromised-password checks, comprehensive enumeration defenses and account-bound gameplay remain pending. Concurrency limits alone do not demonstrate brute-force protection. Bearers must be sent only through appropriate HttpOnly cookies; persist only verifiers. Guest identity remains in memory. See [ADR 013](adr/013-account-credential-foundation.md) for the credential foundation and [ADR 014](adr/014-account-authentication-api.md) for the opt-in API.

### Pepper and typed environment configuration

`bootstrap/environment.ts` owns typed server defaults and explicit account-security parsing. `createAccountSecurity(env)` validates the configuration and returns a shared password service; the guest-only server does not invoke it. Numeric variables reject whitespace, fractions, exponent notation, trailing newlines and unsafe integers. Invalid configuration emits only `INVALID_ACCOUNT_SECURITY_ENVIRONMENT`, never environment values or validation objects containing secrets.

Account configuration defaults: `ARGON2_MEMORY_KIB=19456`, `ARGON2_ITERATIONS=2`, `ARGON2_MAX_MEMORY_KIB=65536`, `ARGON2_MAX_ITERATIONS=6`, `PASSWORD_MAX_CONCURRENCY=2`, `PASSWORD_MEMORY_BUDGET_KIB=131072`. Generation costs must not exceed verification caps; maximum verification memory multiplied by concurrency must fit the configured budget. The default verification allocation budget is 128 MiB, reserving space for the rest of a resource-constrained process. This is a configuration guard, not a measured total-RSS or Railway capacity guarantee. Hard bounds retain a 19 MiB/two-iteration floor and cap memory at 256 MiB per operation and iterations at 10. Deployment memory budget and concurrency remain bounded at 256 MiB and eight operations respectively.

`PASSWORD_PEPPER` is mandatory only when composing account security, with no default. It must be 32 securely generated random bytes encoded as 64 lowercase hex digits. Keep it in a server-side secret manager or Railway secret variable, separately from the database/backups; never commit it, print parsed configuration, or use a `VITE_` variable. The adapter computes HMAC-SHA256 of the exact password with the pepper as key, then passes that result to Argon2id, which still generates an independent random salt for each password. Standard PHC output remains compatible with the existing schema. There is no raw-password or missing-pepper fallback.

The pepper protects against database-only disclosure while it remains secret; it does not protect a simultaneously compromised application environment. Losing or replacing it makes existing hashes unverifiable. This increment does not implement multiple pepper versions, automatic rehash, rotation or password recovery: retain the secret and plan a password-reset/migration process before changing it. No deployment variables or hosted resources were changed. See [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#peppering).

### Opt-in persistent account API — M5, increment 4

Registration, login, current-session lookup and logout now exist as application use cases and HTTP routes backed by parameterized PostgreSQL adapters. Account/profile/zero-progress/session creation is atomic. Active-account checks, absolute expiry, revocation and fresh-token login rotation are authoritative; only hashed bearer verifiers are persisted. Missing accounts perform dummy password verification, and missing/wrong/disabled logins return the same error. Registration still reveals successful username creation; no claim of complete enumeration resistance is made. Account JSON contains only a nickname, never login names, hashes, IDs, XP or bearers. Cookies are HttpOnly/SameSite=Strict at `/api/accounts`, with configured Secure; mutating routes enforce Origin and auth bodies are JSON-limited to 8 KiB. Responses disable caching.

Durable counters in `app.auth_rate_limits` apply global, actual-peer and canonical-login limits before expensive password operations. Keys use domain-separated HMAC, so raw IP/login values are not stored in the limiter. Concurrent attempts and process recreation cannot reset live counters. Expired keys are reclaimed opportunistically in bounded batches; no idle-time cleanup job exists. Login limits can temporarily throttle a targeted account; behind Railway/proxies, actual-peer grouping may aggregate users because forwarding headers are deliberately ignored. Trusted-proxy support and comprehensive credential-stuffing defenses remain separate work.

`startServer({ accounts })` supports explicit composition and rejects production injection without Secure cookies. The CLI `main` remains guest-only, and account sessions do not authorize game seats. No public activation, frontend sign-in, breached-password dataset, recovery, hosted TLS/at-rest encryption verification or production database role setup is delivered. See [ADR 014](adr/014-account-authentication-api.md) for contracts, operational defaults, retention and limitations.

### Persistent player backend — M5 completion

The current backend supersedes the increment-4 limitations above: opt-in CLI composition binds persistent accounts to gameplay, supplies authoritative XP/ranking/cosmetic APIs, reauthentication, one-time recovery codes, account deletion, fixed-event audit and bounded background retention. All HTTP inputs remain unknown until validated; SQL values use Bun.SQL/Drizzle parameters, including literal SQL-looking passwords. There is no public result producer, progress setter, upload or arbitrary style URL.

Production activation requires explicit HTTPS origins, Secure cookies and certificate-verified remote SQL TLS; deployment certificates, origin encryption, database/backups encryption at rest and production roles remain unverified. The default is still guest-only. Trusted forwarding requires an explicit exact-IP proxy allowlist. Socket revocation has a configurable 1–10 second upper lease bound for external changes/storage outages; local revocations notify the process immediately. Recovery stores only a verifier, rotates on successful use and requires no additional personal data. Common-password blocking includes a minimal offline baseline plus an optional bounded local list, not a comprehensive credential-stuffing defense.

[ADR 015](adr/015-persistent-player-backend.md) defines policy versioning, eligibility, retention, ownership, privacy, account deletion and the pre-commit crash limitation. A point ranking does not prevent collusion/farming between friends or secondary accounts; no anti-collusion protection is claimed. Losing both password and recovery code has no support bypass. Keep the pepper separate from the database; recovery is available after pepper replacement only when an independent recovery code was issued and retained beforehand.

The review follow-up binds session issuance to the exact password hash verified before the asynchronous hash operation completed, rechecked under the account row lock. A concurrent password reset/change cannot mint a fresh session using the old proof. WebSocket handshakes receive bounded, single-use grants invalidated by relevant local revocations; validation/refresh deadlines start before the database read rather than after its response. Refresh batches cannot overlap. Connection release and refresh completion check lease ownership, and retired connections cannot borrow a replacement lease. Transport supplies a read-only authorization guard that is checked again inside the room's serialized command before cache lookup, timers or mutation, preventing commands queued before logout from executing afterward.

Completed solo progression uses only authority-generated summaries and versioned reward policy. The worker preserves the solo flag, assigns no competitive points and grants each participant once. A successful development hand reset clears reward account references in that match record without changing the authenticated identity; rejected edits do not affect eligibility, and a fresh match captures account eligibility again. No client command can submit XP, eligibility or policy amounts.

Personal result rewards are read-only and scoped to the current authenticated account's recorded participation. No client-provided account ID, win or expected amount is accepted. Non-owned and not-yet-persisted matches return indistinguishable pending responses, without result metadata. Finished projections expose only the viewer's reward eligibility and no stable account identifier. Received amounts come from committed grant rows; the frontend never claims an estimated reward was credited.

### Production migration boundary

Only `db:migrate` gains a production path: explicit `NODE_ENV=production`, explicit credentials/database and `sslmode=verify-full`, with Bun certificate verification enabled. Seed/test targets retain their local guards. Unexpected URL options and CLI flags are rejected before connecting; operational failures print only an allowlisted category/phase and fixed hint. The connection uses one session, bounded lock/statement timeouts and a fixed advisory lock around Drizzle history/application. Checked-in catalog SQL contains only trusted product data and preserves existing IDs. Use a separately provisioned deployment role; this implementation does not establish hosted TLS, least-privilege runtime grants or encryption at rest. See [production pre-deploy](database.md#production-pre-deploy).

Migration CLI diagnostics retain no original driver cause on the exported command error. Fixed category mappings recognize structured SQLSTATE/TLS/network codes through a bounded cause chain. Unknown messages, connection URLs, SQL, paths and credentials are not logged; invalid configuration gets a fixed remediation hint. This adds observability without permitting weaker TLS or hosted database mutations during diagnosis.
