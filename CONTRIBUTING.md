# Contributing to Manilha Maldita

## Plan work on GitHub

Use [issues](https://github.com/jaovito/manilha-maldita/issues) for bugs, tasks and feature proposals, and [milestones](https://github.com/jaovito/manilha-maldita/milestones) for the roadmap. Search existing issues before opening one. Include the problem, scope, acceptance criteria and relevant evidence. Link dependencies explicitly.

A milestone records planning, not automatic implementation approval. Discuss new gameplay rules, data collection, infrastructure and large changes with the maintainer before coding. Public matchmaking and competitive seasons are future proposals until their scope is approved. Never publish a security vulnerability, credential or private player data in an issue; follow [SECURITY.md](SECURITY.md).

## Prepare a contribution

1. Fork the repository and follow the installation/run instructions in [README.md](README.md).
2. Read [AGENTS.md](AGENTS.md) and the task-specific documents it references.
3. Create a focused branch from the latest `main`. Keep unrelated changes in separate PRs.
4. Link the corresponding issue in the PR. Use `Closes #123` only when all acceptance criteria are met.

Keep repository documentation, comments, identifiers, issue descriptions and PR descriptions in English. Game-facing Portuguese text and translations are allowed. Preserve the current pixel-art identity and licensed asset notices.

## Engineering requirements

- The server owns rules, rewards, timing and randomness. Never trust browser-supplied levels, XP, outcomes or private card data.
- Keep the core pure and preserve module boundaries, room serialization, idempotency and authorized projections.
- Use runtime input validation and parameterized SQL. Never commit secrets or real `.env` files, weaken rate limits, bypass authorization or expose private data in logs/tests.
- Add meaningful regressions for behavior, including failure and boundary cases. Maintain at least 80% line/function coverage per measured executable file; do not exclude files or remove assertions to make checks pass.
- Preserve blank lines between logical blocks. Run the existing formatter and inspect the result.
- Update affected contracts and documentation. New data/schema changes require new reviewed migrations; never rewrite applied migrations or reset a shared database.

Run `bun run check` and the affected integration/browser suites. UI changes need desktop/mobile visual inspection and screenshots following [docs/testing.md](docs/testing.md). Clearly report commands, outcomes and anything not verified. Documentation-only changes still need correct links and commands; explain checks that do not apply.

## Pull requests and review

Use a title such as `FEAT: Add ...`, `FIX: Correct ...`, `DOCS: Explain ...`, `TEST: Cover ...` or `CHORE: Configure ...`. Fill in the PR template with the issue, resulting behavior, validation and operational impact. Keep changes small enough to review; avoid generated reports, dependencies, builds and personal editor settings.

All files are owned by **@jaovito** through `.github/CODEOWNERS`. Contributions from others require at least one approving CODEOWNER review. New reviewable commits invalidate prior approvals. Required CI checks and conversations must be resolved before merging; force-pushes and deletion of `main` are blocked.

The repository owner **@jaovito** has an explicit review-requirement bypass for their own work, because GitHub does not allow authors to approve their own PRs. This exception does not remove required CI checks. Contributors must not request or configure a bypass for themselves.

See [governance](docs/governance.md) for the active rulesets and milestone links. Only maintainers assign milestones, approve feature scope and merge PRs. Approval does not transfer merge permission to an external contributor. Please follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License and attribution

Project source code and documentation use the [MIT license](LICENSE). Contributions must be compatible with that license and retain attribution. Third-party fonts and other materials keep their own licenses and notices; see [NOTICE.md](NOTICE.md). Do not add assets without documenting their origin and redistribution terms. No CLA or transfer of copyright is required.
