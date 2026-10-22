# ADR 014 — Persistent account authentication API

Date: 2026-10-22. Status: accepted for the fourth M5 increment.

## Context

The reviewed credential foundation is recorded in local commit `1a95e13`. The owner authorized the next reviewable increment. Accounts need registration, authentication and durable sessions without allowing clients to write XP, points or cosmetic authorization. Guest gameplay must remain available.

## Decision

Add application use cases, PostgreSQL adapters and actual HTTP routes. `startServer({ accounts })` can mount an explicitly composed account application; `main` remains guest-only and does not open a database connection or enable accounts from environment variables. Production-mode injection requires Secure cookies. This guard does not install or verify TLS. The supplied SQL client belongs to the composition root and must be configured with bounded pooling, validated TLS and appropriate privileges before deployment.

| Route | Behavior |
| --- | --- |
| `POST /api/accounts/register` | Strict `{ login, password, nickname }`; create account, profile, zeroed progress and session in one transaction |
| `POST /api/accounts/login` | Strict `{ login, password }`; verify credentials and issue a fresh session |
| `GET /api/accounts/session` | Return only the current nickname for an active, unexpired, non-revoked session and active account |
| `POST /api/accounts/logout` | Revoke the presented session and clear its cookie; invalid/already-revoked tokens remain idempotent |

Login names are canonical; passwords remain exact; nicknames follow the existing game's character/length contract and are trimmed. Unknown properties, account IDs, XP and reward fields are rejected. Inputs are runtime-validated; SQL uses parameterized Bun.SQL tags with static identifiers. No password, hash, account status, internal ID or token appears in response JSON or error details. The bearer is issued only as the HttpOnly, SameSite=Strict, host-only `truco_account` cookie scoped to `/api/accounts`. Auth responses use `Cache-Control: no-store`; mutating requests require an allowed Origin, and credential requests require JSON. Request bodies are limited to 8 KiB. Forwarding headers are not trusted for peer identity.

Missing accounts use a real dummy hash generated with the same configured password service at composition time. Missing users, wrong passwords and disabled accounts receive the same `INVALID_CREDENTIALS` response after one password verification. This equalizes the verification count, not end-to-end latency or costs of different historical hash parameters. Duplicate registration receives a generic registration failure; successful creation still exposes username availability through registration behavior. Database/crypto failures produce fixed unavailable errors, with no raw exception messages. Login issues a fresh random bearer and atomically revokes the presented previous session only when it belongs to the same account. Other devices are unaffected. Disabling an account immediately invalidates session reads and prevents session issuance under an account row lock.

## Durable throttling

Migration `0004_account-rate-limits.sql` adds `app.auth_rate_limits`: HMAC key, bounded attempt count and expiration, with an expiration index. Keys are domain-separated HMAC-SHA256 of global scope, actual peer address or canonical attempted login, using the server-side secret; no raw IP/login is stored in this table.

Before password work, consume a global budget, then a peer budget, then a canonical-login budget when input is valid. Counters include successful attempts and registration; success does not reset them. PostgreSQL atomic upserts serialize concurrent checks and adapter/process recreation does not reset live windows. Denial commits consumed earlier budgets without consuming later ones. The global budget bounds newly introduced peer/login keys. These operational defaults are reversible and centralized by `parseAuthenticationPolicy`:

| Variable | Default |
| --- | --- |
| `AUTH_SESSION_TTL_MS` | `86400000` |
| `AUTH_ATTEMPT_WINDOW_MS` | `300000` |
| `AUTH_LOGIN_ATTEMPTS` | `5` |
| `AUTH_IP_ATTEMPTS` | `20` |
| `AUTH_GLOBAL_ATTEMPTS` | `200` |

Policy bounds are absolute sessions of 1 minute–24 hours, rate windows of 1 second–15 minutes and 1–1,000 attempts per scope. Registration and login share limits. This intentionally allows temporary account throttling by repeated hostile attempts; it is not permanent account lockout or comprehensive credential-stuffing/DDoS protection. Behind a proxy, actual-peer grouping can aggregate users; trusted proxy identification needs a separate reviewed configuration before deployment.

Expired rate records are eligible for deletion immediately; each admission deletes at most 100 expired rows using SKIP LOCKED. Upserts reset expired rows even if cleanup cannot reach them in that batch. There is no background cleanup while idle, so physical deletion is opportunistic. Only the backend may access these pseudonymous keys; they must not be exposed through product APIs or telemetry. Account/session retention and deletion policies otherwise remain as documented in `database.md`. No real player records were collected in this increment.

## Scope limits

Account cookies do not authorize guest room seats. The frontend, account-to-guest binding, progression grants, cosmetic selection and ranking remain unchanged. No recovery, breached-password dataset, reauthentication flow, automatic pepper rotation/rehash, session-retention worker, audit sink or production connection provisioning is delivered. The API remains opt-in through explicit composition; public activation requires those remaining policy/configuration checks, validated HTTPS/WSS, database/backup encryption at rest and runtime privileges. No hosted environment variables, deploy or push are authorized by this increment.

## Validation

Unit tests cover strict input, generic failures, dummy verification, policy bounds, admission-before-hashing, session operations, cookie/origin/body guards and opt-in mounting beside guest routes. Real HTTP→PostgreSQL tests mount the production account controller with the real application, crypto and repositories in an isolated socket server, without service mocks or a synthetic test endpoint. They cover registration/rotation/logout, expiry/disabled accounts, injection/forged progression fields, concurrent registration rollback/deduplication, durable concurrent budgets and expired-window reset beyond a cleanup batch. This proves the account slice, not frontend sign-in or account-bound multiplayer.

References: [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
