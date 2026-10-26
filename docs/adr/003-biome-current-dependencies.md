# ADR 003 — Biome and current stable dependencies

- Status: accepted as requested by the owner.
- Date: 2026-10-17.
- Updates tooling and version choices from [ADR 002](002-bun-test-bootstrap.md).

## Decision

Replace ESLint, its plugins and Prettier with Biome 2.5.15. Remove previous configuration/dependencies instead of retaining two linters/formatters. Project-specific architecture restrictions move to `tooling/architecture`, using Oxc parser 0.154.0, called by `bun run lint`. Preserve boundary regressions and add tests of the actual Biome configuration.

Use current stable direct dependencies, pinned exactly in one lockfile. Upgrade Bun to 1.4.3, TypeScript to 7.0.2, Vite to 8.3.4, the React plugin to 6.1.2 and Bun types to 1.4.3. Other direct dependencies already matched the latest stable npm releases and were checked again.

The JavaScript compiler API from earlier TypeScript versions is unavailable in the 7.0.2 package used here. The architecture analyzer uses Oxc's AST to preserve syntactic checks without pinning typechecking to old TypeScript. Oxc is only a parser, not another linter or formatter.

## Consequences and validation

Lint, formatting, typechecking, tests and build remain separate and executable. The root presentation is excluded from formatting; formats unsupported by this Biome configuration, such as Markdown/YAML, receive no automatic formatting.

A complete Playwright browser installation into an empty cache was validated under Bun 1.4.3 with TLS validation. Remove the old Node exception from installer and CI. The locally installed Bun runtime was also updated through the official upgrade tool. CI remains configured without a confirmed remote run.
