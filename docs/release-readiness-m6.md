# Release-readiness evidence - M6

This records exercised paths and remaining evidence, not a declaration that the hosted deployment is secure or release-ready. Planning and acceptance remain in [M6](https://github.com/jaovito/manilha-maldita/milestone/2).

## Environment and public read-only checks

The owner confirmed that no staging environment exists. Production frontend entry is `https://manilhamaldita.com`, redirecting to `https://www.manilhamaldita.com/`. Its public bundle identified `https://api.manilhamaldita.com` as the API origin. No secrets or authenticated sessions were read to identify it.

Public checks on 2026-10-31:

| Request | Observed result | Evidence boundary |
|---|---|---|
| Frontend HTTPS | Redirect to `www`, HTTP 200, successful certificate verification | Public frontend path only |
| API `GET /health` | HTTP 200, `status: ok`, successful certificate verification | Liveness at request time |
| API `GET /ready` | HTTP 200, `status: ready`, successful certificate verification | Application readiness at request time |
| API `GET /api/features` | HTTP 200; accounts and solo advertised as enabled | Public capability flags only |
| Account-login OPTIONS, origin `https://www.manilhamaldita.com` | HTTP 204; exact `Access-Control-Allow-Origin`, credentials allowed, GET/POST and Content-Type/X-Client-Version advertised | Tested preflight for the frontend origin |
| Same OPTIONS with a foreign example origin | HTTP 204 without `Access-Control-Allow-Origin` | Browser does not receive cross-origin permission; status 204 alone is not permission |
| WebSocket upgrade path without a credential, frontend origin | HTTP 401, `UNAUTHENTICATED`, successful TLS verification | Anonymous upgrade rejected before room access; no authenticated WSS session established |
| Same upgrade path with a foreign example origin | HTTP 403, `FORBIDDEN_ORIGIN`, successful TLS verification | Exercised origin rejection only |

Certificate checks used curl's normal verification (`ssl_verify_result=0`), without insecure flags. Only fixed health bodies and selected CORS headers were retained. These requests created no account, guest session, room or database record and performed no deployment or migration.

This does not verify the entire origin allowlist, authenticated WSS, Secure cookies, proxy-to-origin transport, deployed SQL TLS, runtime/migration grants, backup encryption or restoration. Those require the actual environment and authorized isolated rehearsals. The connected Neon organization did not expose a project identifiable as Manilha/Truco; do not guess a different project's database. The owner was asked to identify the project/account. Production must not substitute for the missing staging environment in destructive/fault-injection rehearsals.

## Accessibility evidence

`player/keyboard.e2e.ts` uses keys for onboarding, account/cosmetic/ranking/settings/tutorial panels, forward/backward focus containment, Escape restoration, arrow/Home/End tabs, sound enable/disable, volume adjustment and lobby ready/unready/exit. It runs with reduced-motion preference in both Chromium projects.

`player/keyboard-game.e2e.ts` uses two independent authenticated fixture browsers and real HTTP/WebSocket/PostgreSQL gameplay. Registration is fixture setup through the real API; room creation, readiness, preparation passing, raises/counter-raises/acceptance, card plays, the result actions, rematch and lobby exit use keyboard input. It checks named card/action controls, the actual inert table surface behind the result, focus containment in both result dialogs and polite personal-reward updates. It retains complete-match assertions and captures preparation/results for both viewports.

Desktop/mobile result captures were inspected: score, explanatory text, rewards and all three actions remained readable/contained, with a visible keyboard focus outline. The review found the global Settings trigger reappearing outside the final modal. Its render condition now permits the lobby instead of every non-playing room state, preventing a second settings dialog during the result. A DOM regression reproduced the defect before the fix. The inert gameplay boundary remains `.table-surface`; the result actions keep their existing focus containment and server permissions.

After the fix, a separate `playwright-cli` session exercised an actual local solo match through its authoritative abandonment result and inspected the final actions at 1280x900 and 390x844. Both captures retained the existing pixel-art identity and contained every action, with no global Settings trigger above the modal. The session and its dedicated loopback backend/preview were closed afterward. The account match E2E separately covers natural completion/rewards. Local inspection saw only the expected missing-guest 401 and the existing favicon 404, without new application exceptions.

These are automated real-browser checks plus visual inspection of synthetic captures, not a human screen-reader evaluation or real iPhone/Safari evidence. Full guided tutorial exercises, each randomly assigned power, contrast across all assets/states, native browser zoom, touch ergonomics and auditory/screen-reader announcements still require their broader review. Do not mark #6 complete from keyboard automation alone.

## Remaining operational acceptance

- **#3:** identify the database and actual migration/runtime roles, verify the complete hosted transport/cookie configuration, and rehearse migration/restart/rollback in an authorized isolated environment.
- **#4:** record actual backup/retention and at-rest encryption evidence, then restore and validate accounts/catalogs/progress/deduplication in isolation. A local synthetic outage in #8 is not backup restoration.
- **#21:** collect the deployed commit and sanitized migration category/phase or confirmed success for the actual failing environment. Current readiness does not explain a historical deployment failure. Do not rerun production migrations simply to generate evidence.
- **#5:** the versioned workflow includes persistent browser flows in the existing required jobs, but its new Linux result requires publishing the branch and running CI. Prior runs prove only the earlier guest gate.
- **#9:** the owner's asset-reservation decision is recorded. Supplied-reference authorization and the rendering bank's applicable rights still need evidence. See the asset inventory and NOTICE; preserving first-party assets does not clear third-party rights.

The local capacity/outage rehearsal and its conservative limits are documented separately in [capacity-m6.md](capacity-m6.md). No hosted data, configuration or resource was changed by these checks.
