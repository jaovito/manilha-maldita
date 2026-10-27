# GitHub governance and planning

## Planning source of truth

Use [GitHub issues](https://github.com/jaovito/manilha-maldita/issues) for work, acceptance criteria, dependencies and validation evidence. Use [milestones](https://github.com/jaovito/manilha-maldita/milestones) for scope and sequencing. `plan.md` remains a historical implementation/verification record, not a parallel backlog.

- [M5 - Accounts and cosmetic progression](https://github.com/jaovito/manilha-maldita/milestone/1)
- [M6 - Release readiness](https://github.com/jaovito/manilha-maldita/milestone/2)
- [M7 - Playtesting and balance](https://github.com/jaovito/manilha-maldita/milestone/3)
- [M8 - Public matchmaking](https://github.com/jaovito/manilha-maldita/milestone/4)
- [M9 - Competitive seasons](https://github.com/jaovito/manilha-maldita/milestone/5)

M5 records the implementation merged in PR #1. Release verification belongs to M6. Accessibility and human playtest work left from M4 is tracked in M6/M7. M8/M9 issues are marked `status:proposal`; creating them does not approve a queue architecture, rating formula, season reset, new data collection or gameplay rule change.

Before implementation, agree on focused acceptance criteria and link blockers. Use one reviewable PR per coherent task. Link `Closes #...` only when the acceptance criteria are met; otherwise reference the issue without closing it. Update issue state and milestone progress as work lands. Do not invent deadlines or close tasks because code exists without the required validation.

## Main branch protections

Two active rulesets keep the owner's approval exception separate from integrity checks:

| Ruleset | Requirements | Bypass |
|---|---|---|
| [Main integrity and required CI](https://github.com/jaovito/manilha-maldita/rules/25922111) | Passing `verify`, `browser (chromium)` and `browser (mobile-chromium)` from GitHub Actions; up-to-date branch; PR and resolved conversations; no branch deletion or force-push | None, including the owner |
| [CODEOWNER review with owner exception](https://github.com/jaovito/manilha-maldita/rules/25922113) | One approving CODEOWNER review; new reviewable commits invalidate approvals | Only GitHub user `jaovito` (ID `61637710`), and only through a PR |

`.github/CODEOWNERS` assigns every path to @jaovito, including changes to the ownership file, workflows and ruleset definitions. GitHub evaluates CODEOWNERS from the PR's base branch: the file must be merged into `main` before that ownership requirement is effective for subsequent PRs. Until then, the active ruleset still requires a review, but cannot infer file ownership from an unmerged file.

The exception lets the owner merge their own PR without an impossible self-approval. It does not bypass the separate integrity ruleset, required CI or conversation resolution. External contributors can open PRs from forks; approval alone does not grant write/merge access.

Versioned desired configurations live in `.github/rulesets/`. Editing those JSON files does not automatically change GitHub settings. An authorized maintainer applies reviewed configuration through GitHub's UI/API and verifies the effective rules on `main`. Do not run an elevated workflow using code from an untrusted fork or bypass protections to make CI pass.

## Repository settings

- The repository is public and forks/issues are enabled.
- Merged PR branches are deleted automatically; active branches are not deleted by this setup.
- [Private vulnerability reporting](https://github.com/jaovito/manilha-maldita/security/advisories/new) is enabled; follow [SECURITY.md](../SECURITY.md).
- CI runs on PRs and pushes to `main`, avoiding duplicate branch-push and PR jobs. Tokens are read-only and `pull_request_target` is not used.
- No administrator or collaborator access is granted by this configuration.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for submission/review requirements and [NOTICE.md](../NOTICE.md) for license scope.
