# ADR 004 — Local PostgreSQL and seed infrastructure

- Status: accepted as requested by the owner.
- Date: 2026-10-18.

## Decision

Prepare PostgreSQL 18.6 Alpine through Compose, with persistent development storage and tests using a separate instance, user, database and port with tmpfs. Both use loopback and healthchecks. Use Drizzle ORM 0.45.4 and Kit 0.31.11, the current stable versions, with Bun's native SQL.

Keep local migrations/tooling in the backend without coupling the core to the database or creating product models. The first migration creates only the app namespace. Seeds receive explicit tasks, unique IDs and a transaction; tasks must use stable keys/upsert. The development registry stays empty until models are defined. Tests create and remove their own schemas with fictional fixtures.

Local tooling rejects production and targets outside the designated local databases/roles. Tests never fall back to DATABASE_URL. Do not create destructive resets or truncate the development database.

## Consequences

Full validation includes real PostgreSQL integration and minimum coverage, requiring Docker/Compose in development and CI. Engine tests remain independent. The test database can be shared through schema isolation; do not automatically stop a service that may be in use. Remote CI remains unverified until publication.
