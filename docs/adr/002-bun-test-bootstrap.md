# ADR 002 — Bun Test and bootstrap without gameplay

- Status: accepted as requested by the owner.
- Date: 2026-10-17.

> Historical bootstrap record. Versions and the tooling exception below were updated by [ADR 003](003-biome-current-dependencies.md).

## Decision

Use Bun Workspaces without Turborepo and Bun Test for unit/integration tests, replacing the previous Vitest default. Keep fast-check for properties and Playwright for browser tests. React uses Happy DOM and Testing Library in a separate process from tests without DOM.

Pin Bun to 1.3.5, the version available and validated during bootstrap, and direct dependency versions in one `bun.lock`. TypeScript and ESLint use versions compatible with their peers; bootstrap does not require the latest version of every tool.

Create environment configuration, folders and tests without implementing rules, game contracts, React UI or a product server. The web build contains only the mounting HTML; test fixtures are not product endpoints. Do not create empty commands or treat missing tests as success. Add package exports and entrypoints when their implementations exist.

## Tooling exception

The Playwright browser installer under Bun 1.3.5 failed with `ERR_TLS_CERT_ALTNAME_INVALID` during a CDN redirect. Installation with Node 24 succeeded with TLS validation enabled. The installation script explicitly uses Node; development, lint, types, build and runners use Bun. Reassess the exception when upgrading Bun, without hidden fallbacks or disabled certificates.

## Consequences

Setup has executable checks from the start, with separate production and test environments. Environment coverage does not prove gameplay or multiplayer. CI is configured but was not run remotely. Safari/iOS compatibility remains for future validation.
