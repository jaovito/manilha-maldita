# ADR 013 — Optional account cryptography foundation

Date: 2026-10-22. Status: accepted for the third M5 increment.

## Context

After reviewing the PostgreSQL consumer, the owner authorized further small increments. Account/session tables already exist, but the game retains in-memory guest identity. Upcoming login integration needs explicit validation/cryptography before exposing registration/authentication.

## Decision

Create an `accounts` module with pure credential policy, hashing port, application service and cryptographic adapters. Use asynchronous `Bun.password`, standard HMAC-SHA256 from `node:crypto`, and Web Crypto APIs without new dependencies or custom algorithms. Importing the module starts no timer, connection or hash.

- Canonical logins contain 3–32 lowercase ASCII letters, digits or underscores, following the existing schema. Do not coerce types, remove quotes or block SQL words.
- Passwords contain 15–128 Unicode code points; accept spaces, punctuation and accents without trimming, normalization or truncation. Reject malformed UTF-16 so distinct inputs cannot become identical replacement bytes. Maximum length equals up to 512 UTF-8 bytes. The minimum follows current recommendations for password-only authentication without MFA; common/compromised-password blocking remains required before exposing login.
- Argon2id v19 defaults to 19,456 KiB, two iterations and parallelism 1, using Bun-generated random salts. Generation costs and verification ceilings are configurable through the typed environment parser. Accepted hashes use the supported PHC format and bounded memory/iteration counts; previously generated hashes remain valid after a cost increase if within those ceilings. There is no automatic rehash. Fixed safety floors remain 19 MiB/two iterations, with hard caps of 256 MiB and ten iterations. These are initial operational bounds, not production benchmarks.
- `PasswordService` accepts unknown inputs and shares an explicit hashing/verification limit from 1 to 8; the typed environment defaults to two operations. Composition must share one instance per process. Excess fails immediately with a fixed code, without a password-retaining queue. `finally` releases capacity; adapter failures become operational errors without credential material. This protects local resources and does not replace per-account/IP attempt limits.
- Account tokens use 32 cryptographically random bytes in hexadecimal (256 bits). SHA-256 produces the verifier for `sessions.token_hash`. The bearer returns only for future cookie issuance; it must never enter databases, logs, public DTOs or browser storage. Invalid tokens receive no coercion, trimming or normalization. Public identity stays separate from bearers.

## Typed configuration and pepper

`bootstrap/environment.ts` centralizes existing HTTP server defaults and adds `parseAccountSecurityEnvironment`. It accepts only decimal integer configuration with validated ranges and cross-field constraints. Invalid configuration produces a fixed error code without secret values. The guest server needs no account secret until account security is explicitly composed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ARGON2_MEMORY_KIB` | `19456` | Memory used for new password hashes |
| `ARGON2_ITERATIONS` | `2` | Iterations used for new password hashes |
| `ARGON2_MAX_MEMORY_KIB` | `65536` | Maximum accepted stored-hash memory cost |
| `ARGON2_MAX_ITERATIONS` | `6` | Maximum accepted stored-hash iteration count |
| `PASSWORD_MAX_CONCURRENCY` | `2` | Shared hashing/verification capacity |
| `PASSWORD_MEMORY_BUDGET_KIB` | `131072` | Maximum verification memory times concurrency |
| `PASSWORD_PEPPER` | None; required for account composition | 32 random bytes as 64 lowercase hex digits |

Generation costs must fit verification ceilings. Maximum verification memory multiplied by concurrency must fit the budget, whose hard upper bound is 256 MiB. The default allows at most 128 MiB of Argon2 memory allocations across concurrent operations, reserving room for the rest of a constrained server. This is not a total-process memory guarantee or a verified Railway capacity measurement.

Before Argon2id, the adapter computes HMAC-SHA256 of the exact password using the pepper as its key. The random salt remains independent for each Argon2 hash; the stored value remains a standard PHC string compatible with the existing schema. No unpeppered fallback is accepted. Keep the pepper outside the database and backups, in a server-side secret manager or Railway secret variable. Never put it in source, public configuration, error diagnostics, logs or `VITE_` variables.

Losing or replacing the pepper makes existing hashes unverifiable. This increment has one explicit pepper per deployment, with no key-version lookup, rotation, recovery or automatic migration. Plan a password-reset/migration process before changing it. Protection applies to database-only disclosure while the pepper remains secret; compromise of both database and runtime secrets defeats that extra protection. No hosted variables or deployment resources were modified.

## Limits

This increment creates no HTTP login/registration, user-flow account persistence, cookies, authentication repository, recovery, rotation/revocation, expiry checking, anti-enumeration, CSRF or attempt limits. It changes no existing guest sessions. An explicit bootstrap composition function exists, but `startServer` does not invoke it; implemented login protection or publication-ready authentication is therefore not claimed. The job queue never processes passwords.

The next integration must use generic responses/equivalent work for missing accounts, limit attempts before Argon2, persist only hashes, check account state/expiry/revocation and preserve origin/secure-cookie requirements. TLS, least-privilege roles and database/backup encryption require verification in the corresponding environment.

## Validation

Unit tests exercise types, boundaries, Unicode, literal SQL-like inputs, shared saturation and release after errors. Adapter tests use real Argon2id/Web Crypto; they check format/cost, independent salts, exact verification, rejection of out-of-budget costs, supported cost upgrades, pepper mismatch/missing-pepper rejection and compatible SHA-256. Configuration/composition tests verify mandatory secrets, numeric grammar, shared capacity and memory budgets. PostgreSQL integration writes hashes in a transactional fixture, rereads/verifies passwords and looks up token verifiers without persisting bearers. This is not an HTTP authentication flow.

References: [Bun.password](https://bun.sh/guides/util/hash-a-password), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [NIST SP 800-63B — Authenticators](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/).
