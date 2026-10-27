# Testing, quality, and verification

Read this document when changing behavior, adding tests, or configuring tooling/CI. Select regressions relevant to the change; the commands below exist in the bootstrap. Current tests validate the environment and complete M1 base rules engine (cards, dealing, tricks, ties, wagers, eleven, scoring, and projections); M2 adds real multiplayer, sessions, timers, and reconnection; M3 adds powers and simulations.

## E2E test organization

All scenarios live in `tests/e2e/`, organized by feature for IDE navigation. `*.e2e.ts` files are executable tests; `support/` contains only shared helpers.

| Folder | Coverage |
|---|---|
| `profile/` | First visit, nickname validation/persistence/editing; guest session and invitation |
| `menu/` | Visual composition, assets, profile, and menu responsiveness |
| `lobby/` | Room layout, seats, readiness, and settings |
| `match/` | Multiplayer matches, powers, reconnection, rematch, raises, audiovisual feedback |
| `tutorial/` | How to play, practice, navigation, and lesson layout |
| `settings/` | Global language and preference persistence |
| `solo/` | Bot training, development tools, and panel absence from production builds |
| `accessibility/` | Disabled controls, tooltips, and mouse/touch interaction |
| `infrastructure/` | Production HTML and localhost-origin access |
| `support/` | Entry, multiplayer synchronization, powers, results, geometry/contrast checks |

The browser currently uses guest identity flows in `profile/`; the opt-in account backend is tested through real HTTP/WebSocket/PostgreSQL scenarios. Add scenarios to their corresponding area without a separate tree per environment. Playwright configurations select environments:

```sh
bun run test:e2e profile                  # entry and nickname only
bun run test:e2e lobby                    # lobby only
bun run test:e2e menu --project=chromium  # desktop menu
bun run test:e2e --list                   # default inventory
bun run test:e2e:solo                     # solo in development and production
bun run test:e2e --config=playwright.i18n.config.ts  # language and tutorial
```

The default configuration excludes `solo/` and `settings/i18n.e2e.ts` because they require isolated development servers. Dedicated configurations remove that exclusion and explicitly select their files. The language suite also runs the tutorial; this overlap is intentional. All three `--list` commands must preserve the inventory when reorganizing files.

## Required tests

`apps/server/tests/integration/sql-injection.test.ts` starts the real `startServer` on an ephemeral port, uses two real sessions/players, and sends HTTP/WebSocket payloads without mocking services. It exercises nicknames, cookies, room codes in paths, settings, command IDs/context/revision, cards, extra fields, and invalid types. It checks exact responses without echo/stacks, preserved profile/room state, and a valid action after an attack. SYNC with a new snapshot acts as a protocol barrier for authoritative-state checks without sleeps or reliance on client caches alone.

These are backend E2E scenarios through the in-memory authority. The guest game has no persistent queue/result endpoint, so these guest scenarios do not prove HTTP → PostgreSQL behavior. The separate opt-in account API has its own real HTTP→PostgreSQL tests described below. `queue-injection.test.ts` separately covers the adapter/backend against real PostgreSQL, including second-order injection. When adding persistent producers/routes, add the complete path with test-database fixtures and control-row checks; do not create a test route/mock implying that integration already exists.

Use deterministic tests and fake clocks; do not write tests based on waiting real seconds. Do not replace rule cases with extensive object snapshots.

| Area | Minimum regression cases |
|---|---|
| Deck | 40 unique identities, 1v1/2v2 dealing, every turn-up card, 3->4 cycle, all trump suits |
| Tricks | Ordinary tie, two highest cards from one team, cross-team tie, all covered, leader order |
| Hands | Every tie-table row, early completion, folding, single score application, no turn after victory |
| Wagers | Accept/fold/counter-raise, implicit value, limit 12, team without raise rights, turn resumption |
| Special hands | Unilateral eleven, 11×11, partner visibility, no powers/regeneration, replay after three ties |
| Powers | Costs, energy cap, single use, invalid targets, expiration, Mask with trump, Boost at ceiling |
| Preparation | Sealed commitments, timeout, two exchanges, Spy after exchange, arrival-order-independent resolution |
| Privacy | Each seat's projection, covered/masked cards, opaque IDs, errors, logs, reconnect snapshots |
| Concurrency | Two teammates responding, duplicate after lost ACK, same ID/different payload, late command, stale timer |
| Reconnection | Resume, invalid token, previous connection, cumulative pause limit, abandonment, room expiration |

Add property tests: card conservation, energy between 0 and 3, scoring exactly once, no mutation on illegal actions, one card per player/trick, no out-of-turn play, and no private-card leaks in generated states.

Integration tests must exercise the authoritative server with multiple real transport clients. E2E must complete 1v1/2v2 matches in isolated browser contexts and cover invitation, ready, wager, power, reconnection, and rematch. Include mobile scenarios. Four local components sharing state are not a multiplayer test.

## Code quality and verification

Use specific types and discriminated unions with exhaustive handling. Inputs remain `unknown` until validated; do not hide failures with `any`, double casts, or non-null assertions. Expected errors have stable codes without client-visible stacks/secrets. Code, comments, and repository documentation use English; game-visible text and translations may use Portuguese. Responses to the user follow their language. Comments explain decisions and invariants.

Use Bun to manage/run scripts as defined in [architecture.md](architecture.md). Use Bun Test for unit/integration, fast-check for properties, Happy DOM/React Testing Library for components, and Playwright for browsers. Do not install Vitest alongside them. Validate tooling under Bun during bootstrap and document concrete incompatibilities.

Use the actual root scripts:

```sh
bun install --frozen-lockfile  # with an existing bun.lock; generate the first with bun install
bun run lint
bun run typecheck
bun run test
bun run test:coverage
bun run test:integration
bun run test:e2e
bun run build
```

Do not assume scripts already exist; create them with the relevant infrastructure, without empty scripts, ignored tests, or `--if-present` to imply coverage. Run affected suites and feasible general checks; report preexisting failures, unavailable commands, and environment restrictions.

CI checks lockfile, types, lint, minimum test coverage, and implemented builds. Dependency changes require lockfile review and API verification in official documentation for the used version. Do not duplicate equivalent tools.

## Bootstrap coverage

`bun run test` keeps tooling/domain and DOM in separate processes. Current regressions cover import boundaries, workspace acyclicity, type environments, and a test component's rendering/interaction/cleanup. `bun run test:integration` checks the Hono/Bun fixture and product server using real HTTP/WS clients, isolated cookies, matches, and reconnection. Implemented rules also have colocated domain tests.

The current build includes the React client. `bun run test:e2e` starts backend/preview, checks HTML, and completes 1v1/2v2 matches with invitation, ready, wagers, reload/reconnect, rematch, surrender, and leave in desktop Chromium/mobile viewport. M3 E2E includes preparation/power activations. `bun run check` excludes E2E; run it separately after `bun run test:e2e:install`. Playwright installer/runner use Bun 1.4.3; clean installation was validated after the runtime update. CI declares these steps, but remote execution can only be confirmed after repository publication.

## Lint and updates

Use Biome for lint/formatting. `bun run lint` also includes `bun run check:architecture`, preserving import/purity rules through Oxc parsing. Regressions exercise the analyzer and actual Biome configuration (forbidden globals/conditional hooks). Do not reintroduce ESLint or Prettier for these responsibilities.

Keep direct dependencies exactly pinned to compatible current stable versions. Check peers, regenerate `bun.lock`, and run affected checks/E2E when runtime, build, or browser behavior changes. Reproducible pinned versions do not justify deliberately outdated dependencies.

## Mandatory minimum coverage

Ignore rules exclude reports at root/workspaces but preserve `tooling/coverage/`, which contains runner/inventory code. A real Git regression verifies those scripts and `.env.example` are tracked while reports, dependencies, builds, and actual environment files are excluded. A local run with untracked files does not replace validating a clean copy of staged content.

Every implemented/changed behavior needs outcome assertions for valid inputs, rejection, and relevant boundaries. The gameplay matrix remains mandatory: percentages do not replace rules, privacy, concurrency, or reconnection.

The minimum is **80% lines and 80% functions per measured executable file**, configured in root/frontend `bunfig.toml`. Bun does not provide an equivalent branch/statement guarantee here; those metrics are not claimed as verified. Decision cases remain required by the matrix/review.

`bun run test:coverage` starts the dedicated local test database, then groups tooling/core/server unit tests, HTTP/WS integration and PostgreSQL scenarios in one Bun backend run, with DOM in a separate process, producing `text`/`lcov`. Full persistent backend E2E imports the real transport, account and database composition; joint execution measures behavior across the complete suite without duplicate partial file measurements or source exclusions. Every run measuring files must meet the native per-file threshold; high coverage in one module cannot offset low coverage elsewhere. Reports live in `coverage/server` and `coverage/web`. Standalone `bun run test:database` still writes `coverage/database` for focused adapter work; it does not replace the complete coverage command. The directory is cleared before execution to prevent stale reports.

The command also inventories executable files in `apps/*/src`, `packages/*/src`, and the implemented architecture analyzer, failing if any appear in no report. This keeps unimported code visible. Integration may extend behavioral verification but does not waive the minimum for each run measuring a file. Playwright runs separately and does not contribute to this percentage.

Tests/fixtures in test directories, declarations, type-only files, configurations, and coverage-runner infrastructure do not enter the denominator. Do not move product code into these categories or add exclusions to meet thresholds. New exclusions require explicit justification/review; never add assertion-free imports solely to increase coverage.

The domain contains executable base rules, composition, and projections measured in unit tests. Pure-command tests complete 1v1/2v2 matches, including eleven/11×11; this does not prove browser multiplayer. Suites without measurable sources are not 100% coverage; do not create dummy code to populate empty reports.

`bun run check` and CI run `test:coverage` instead of repeating uninstrumented unit/integration tests. Policy tests confirm failure below 80% and detection of unreported sources. `bun run test` without instrumentation is useful during development but does not replace final coverage verification.

## Database tests

`queue-injection.test.ts` adds malformed `unknown` inputs, boundaries, and payloads with quotes/comments/separators. One regression accepts valid IDs matching SQL words without a blacklist; another deliberately stores a malicious reference as literal fixture data to prove second-order parameterization during processing/UPDATE. It also compares control results/exact increments and producer rejection. Do not execute destructive SQL or infer security solely from the absence of errors.

M5 increment 2 adds `queue-processing.test.ts` and `queue-concurrency.test.ts`, exercising the real adapter: enqueue with results, deduplication without attempt reset, SQL errors in savepoints, effect rollback, backoff/ceiling, future due dates, expired leases, concurrent consumers, and `pg_terminate_backend` exclusively on the fixture-created connection. The last scenario proves rollback after actual connection loss and another consumer's success without duplicate credit. XP changes are atomicity fixtures, not product policy. Setup deletion tests now filter their own account, allowing other fixtures to coexist in the test database.

`src/modules/jobs` unit tests use a controlled scheduler for initialization, polling without notifications, coalescing, round bounds, concurrency, storage/telemetry failures, and shutdown awaiting active work. Database tests synchronize concurrency through promises/barriers without sleeps to infer absence of effects; no user connection/instance is terminated. The suite does not claim reward producers/handlers or workers are enabled in the game.

The M5 setup adds real regressions in `apps/server/tests/database/{accounts,cosmetic-catalogs,match-results,schema,queue-schema}.test.ts`: hash format, uniqueness/FKs, deletion/anonymization, nonnegative bigint totals, local catalogs, reward context, job uniqueness, states/attempts/leases, and error codes. Fixtures are transactional/rolled back; notification/concurrency cases use independent connections, real commits, and cleanup limited to their own results.

NOTIFY delivery is synchronized using a separate barrier channel: absence before commit/after rollback is not inferred from sleeps. Tests verify jobs remain queryable without listeners and two PostgreSQL SKIP LOCKED consumers do not select the same locked row; rollback releases it. These setup tests do not claim implemented workers, automatic retries, login, or unlocks. Metadata tests verify credential/profile/progress separation and no private payload in summaries; they also exercise schema callbacks without excluding files from coverage.

Follow [database.md](database.md): `test:database` and full coverage start only the PostgreSQL test service. Never reuse development databases. The real suite checks repeated migration, target selection, idempotent seeds, and rollback using dedicated schemas removed afterward. CI requires Docker/Compose; missing databases do not become skipped tests or success.

Coverage also inventories connection, target selection, migration, and seed-runner modules. CLI, namespace declaration, and task registry are configuration/infrastructure; behavior modules are not excluded. Local tools do not accept production configuration/secrets.

## M1 verification

`bun test packages/game-core` exercises the engine without database/network. Regressions include counter-raise implicit values, first teammate response, old revisions, card ownership, early completion, score caps with original rewards, eleven decisions, and 11×11 replay after three ties. fast-check properties verify conservation of 40 cards, immutability, and out-of-turn rejection; generated projections verify changing hidden information does not change unauthorized views.

Projection tests cover every seat, covered-card history, completion, and partner visibility, including extra secret fields to test allowlisting. Pure M1 tests are not described as authentication/socket-concurrency tests; those have M2 regressions. The base suite does not exercise powers; M3-specific regressions cover energy/powers. Engine tests do not use production bots or inspect others' cards to choose moves.

## M2 verification

Application tests use `Ports` with fake clock/scheduling: exact deadlines, stale callbacks, cumulative pause, remaining-time resumption, team decisions, weakest-card auto-play, wager/eleven folds, three consecutive timeouts, valid-action resets, and rooms emptied by leaving/disconnection. They do not wait real seconds. Capacity/queue/erroring-sink tests protect authority against client failures.

Integration uses real bootstrap on ephemeral ports with separate sessions/cookies. It confirms seat privacy, original responses after lost ACK/reconnection, ID reuse with different payload, first teammate response, replaced sockets, rematch contexts, and leave ACK before close. Transport tests also check origin, expired sessions, payloads, queues, rate limits, and slow clients. Playwright uses independent contexts rather than shared-state components. Desktop/mobile captures were inspected; layout is functional and polish continues in M4.

Lobby regressions verify joins appear in the first browser without reload, occupied-seat selection is absent from UI/rejected without authoritative mutation, free-seat movement, and resynchronization when returning to a stale tab. Focus/visibility recovery requests only `SYNC`, without replaying ready/play/wager; closure removes listeners. E2E tracks the first client's load event to prove updates do not depend on refresh.

Authorized visual work includes DOM tests for open/covered cards, relative seats, public history, blocks, and special decisions. E2E requires no horizontal overflow in entry/lobby/table; 1v1/2v2 require a centered top player above plays and no seat over turn-up/trump. Captures include desktop, 390 px mobile, and cards after a trick. Geometry complements visual inspection, not playtests or a full accessibility audit.

Full-viewport regressions also require no vertical overflow during matches and all hand/cards/action controls onscreen before/after a trick. The same match is resized across mobile portrait/landscape and desktop resolutions. DOM tests verify closed room panels during play, celebration before compact final menu, no settings during play/completion, rematch, and leave awaiting ACK.

Menu/lobby regressions cover disabled future buttons, guest profiles, code validation, join-panel open/return, initial invitations, and link copying (success/rejection/unavailable API). E2E joins one guest by code and others by invitation, preserving independent clients. Menu/lobby desktop/portrait/landscape captures and geometry keep navigation from crossing profile/footer. Tests do not simulate nonexistent chat, currency, levels, or powers.

Menu composition is visually compared at 1567×882 and 1920×1080; E2E checks proportional logo/profile/navigation/footer regions and a single landscape column. Decorative icons stay outside the accessibility tree; profiles do not announce fictitious progress/balances. Geometry is not a pixel-for-pixel comparison with generated artwork.

All six navigation buttons must have equal width/height in each viewport. E2E checks modest hover growth and return to original size on active controls; stars appear only for highlighted active options. Disabled options remain attenuated without growth/stars and explain their reason in tooltips. Reduced motion keeps active stars without button scaling.

Real HTTP integration checks guest/room creation with authorized `localhost`/`127.0.0.1` defaults, rejecting missing origins, unauthorized ports, and lookalike domains, plus explicit replacement of defaults. E2E opens `localhost` and requires room creation/WebSocket lobby connection. Client tests verify specific recognized-error messages and unknown/malformed responses without echoing arbitrary server data.

Lobby E2E measures computed colors of main text, captions, fields, teams, active buttons, and guest views. It requires at least 4.5:1 contrast, 14 px fonts, and no text-opacity reduction there; opaque gradients are assessed at extreme colors. Disabled actions, including Start match, check owner-requested 0.25 opacity and an explanation; tooltip explanations retain opaque backgrounds/4.5:1 contrast. Text panels need opaque backgrounds to prevent artwork interference. Desktop/portrait/landscape captures complement checks without implying a full accessibility audit or pixel-perfect comparison.

Pixel-art control composition has DOM tests for mode/preset selection, normalization, fixed-switch state, and invitation copying with manual fallback. E2E awaits server-confirmed radio selection after click/keyboard, verifies guest locks and fixed competitive timers. Textless graphics are outside text-contrast measurement; visible labels/options are included. A 1567×882 capture supports approved-composition inspection.

Nickname-preference tests cover validated reads/writes, deletion on empty/invalid values, blocked storage, confirmed sessions, malformed responses, and late-response/edit races. DOM clears storage between tests. E2E reloads before creating a room, then removes the cookie, requiring the nickname to remain populated and HTTP 401 without session; only fresh entry obtains valid identity. This flow stores only the nickname locally.

Seat E2E verifies equal card heights/action positioning with long names, badges, readiness confirmation/cancellation, and empty seats. Complete 2v2 rooms have no buttons for others' occupied seats and require minimum touch areas/unclipped button text. Resolutions: 1567×882, 1024×768, 390×844, 320×568, and 844×390.

The lobby shows the full link instead of an isolated invitation code. DOM checks origin-based value, read-only field, focus selection, and continuity after copy success/failure. E2E identifies rooms through this link while preserving code/invitation joins, contrast, and no overflow on desktop/mobile.

Guest-view DOM tests check the read-only indication linked to the disabled fieldset. E2E compares selected-option appearance with the host view, confirms radio locks, and preserves invitation copying. Contrast includes the extra indication; captures distinguish permissions without reducing whole-panel readability.

## M3 verification

Pure tests cover independent/mirrored assignment, energy/caps, special-hand blocks, sealed commitments, arrival-order variation, two exchanges, Spy after exchanges, conservation of 40 cards, and leak-free projections. Boost preserves identity/ordinary class, rejects trump/3/covered cards and reuse; Mask remains hidden until resolution and after folding. Generated properties check conservation/energy bounds across preparation batches.

The application uses fake time for preparation-specific deadlines, passing only pending seats, stable ID/deadline, stale context, reconnection, original ACK, and protection only for still-required seats. Real HTTP/WS integration uses four independent sessions in both presets, commitments in the same revision, secrecy before closure, private results, reconnection, and complete matches. Chromium E2E completes matches and sends intents through UI; numerical coverage remains separate.

`game-sim` repeatedly runs/tests the same scenarios with powers enabled/control and swapped seats/teams. Tests verify termination, reproduction, bounds, aggregate results, and authorized-observation policies. `bun run simulate 30` is synthetic experimentation, not load testing, production timing, definitive balance, or human playtesting. The [report](simulation-m3.md) states sample size/uncertainty.

Power-card regressions verify initially collapsed preparation, explicit opening, turn-power selection/deselection, direct table targets, pass without activation, insufficient energy, prior use, pause, completion, wrong window, and special hands. Button/Esc close details with focus restoration; new contexts close the panel/invalidate selection. E2E activates through UI and requires revealed cards to remain fully onscreen without overlapping the hand at tested resolutions.

Layout changes require final `playwright-cli` validation of the real flow with visually inspected desktop/mobile captures. Power-card E2E requires square art, cost inside illustration, no title overflow, and no overlaps with hand, seats, turn-up card, or actions. Inspection includes long titles/landscape; measurements do not replace review.

The collapsed left card has E2E regressions for partial sleeves on fine pointers, complete reveal on hover/focus without activation/details, full touch display, and position left of the hand. Geometry is measured with the card revealed, including energy, local identity, room menu, and connection, so clipping cannot conceal collisions. Final `playwright-cli` inspection compares rest, hover, and mobile versions.

Power secrecy regressions cover 1v1/2v2, owner/teammate/opponent/public projections, noninterference when swapping hidden assignments, still-sealed preparation, all four activations, rejection, hand/match end, and next-assignment concealment. HTTP/WS integration checks individualized snapshots in both presets, including reconnection before/after preparation. DOM distinguishes hidden from absent powers and reveals only received activations.

Direct-power-flow DOM regressions cover power/own-hand clicks, Boost-ineligible cards, no selects/panels in selection paths, cancellation/focus, pause, and new context. Spy accepts only opponent backs, awaits server results, shows the face at the selected back, and retains historical observation after a masked play without updating remaining backs by identity. Reconnection restores authorized faces; projections without intel render none. E2E activates preparation by table clicks, measures opponent targets at least 44×44 px, and confirms only Spy clients receive private observations. `playwright-cli` desktop, normal/short portrait, and landscape inspection complements geometry.

Selection geometry is tested separately from rest: hand/actions must not overlap, guidance must stay onscreen, and Spy targets must not cover turn-up cards/nicknames. The helper switches mobile clients across normal portrait, 320×568, and landscape while preserving selection and checking 44×44 px minimum hitboxes.

## M4 audiovisual increment verification

Fake clocks verify dealing/trick/hand boundaries, no decision time during presentation, full-deadline resumption even with late callbacks, reconnection without premature protection spending, rejection/duplicates, surrender cancellation, and stale callbacks. Real HTTP/WS integration observes `transition` in separate sessions, preserves privacy, and waits actual deadlines.

DOM covers card/preparation/power blocks during presentation, available surrender, authorized-projection results/highlights, tie/trump/Boost/Mask/fold explanations, and next turns including the same seat. Decorative dealing backs never inspect other players' cards. Audio tests use a fake Web Audio port for scheduled notes, unlock, mute/volume, device/storage failure, cleanup, and silence on initial load/SYNC/reconnection; this is not human listening evaluation.

Audiovisual E2E uses two real browser contexts, resolves a trick through UI, requires presentation/blocks in both, observes authorized-leader resumption, and ends a hand by folding. Reduced motion disables computed animations; audio preference survives reload. Final `playwright-cli` captures/inspection complement desktop, normal/short portrait, and landscape checks. The [human script](playtest-m4.md) records pending clarity, pacing, and enjoyment assessment.

Central “YOUR TURN!” DOM regressions use controlled scheduling: 2.4 s, expiration, first local decision, same-seat new trick, new hand/rematch, SYNC without restart, negotiation/pause without repeat, opposing turn, completion, stale callbacks, and cleanup including React effect replay. Table integration confirms cards can be sent immediately during the announcement. E2E/visual inspection must check desktop/mobile dimensions, no click interception, and static reduced-motion presentation.

Relative-result audio tests cover all four seats, 1v1/2v2, victory/defeat/tie, and match > hand > trick priority in one command; distinct ascending/descending tones respect volume/mute. DOM covers trick/hand title/caption, winner/loser, natural 12-point endings, 5 s before menus without button flashes, three final actions without lobby/settings, host permissions, connection loss, focus/Tab/Shift+Tab, React effect replay, no celebration on abandonment/surrender/insufficient score, neutral results, 48 particles, 5 s expiration, no reconnect replay, rematch, unmount, and stale callbacks. E2E requires correct independent-client results, celebration without Room menu/buttons followed by compact dialog, mandatory readiness after Rematch/Back to lobby, winner-only confetti, no animated reduced-motion particles, expiration, and reload without replay. Real desktop/mobile end/round captures complement validation; tested synthesis is not human auditory evaluation.

## Configurable backend URL

Transport regressions check local-proxy fallback, HTTP/WS and HTTPS/WSS, trailing-slash removal, and rejection of protocols, paths, and credentials in configured origins. HTTP preserves credentials=include. Integration exercises sessionless preflight, cookies/error responses with authorized-origin CORS, no permission for foreign origins, and preserved WS-handshake rejection. To verify a separate-backend build, run `local-origin.e2e.ts` with `VITE_BACKEND_URL=http://localhost:3002`, frontend localhost:4273, and backend allowing that origin; the default proxy points elsewhere and cannot mask configuration failures.

## HUD and consumed-card removal

DOM checks all four powers: selection/rejection/pending preparation retain the card; confirmed `used` removes card/details; energy remains; the next hand restores its new assignment. Private Spy observation remains on the table after removal. “Your turn” requires an active local turn and disappears on pause, opposing turn, preparation, negotiation, or completion. E2E requires top status, an onscreen badge, no “Play card” panel, and existing target/geometry regressions. Final `playwright-cli` inspection covers desktop, 390×844/320×568 portrait, and 844×390 landscape before/after real consumption.

## Card proportions

E2E helper `card-proportions.ts` compares computed face/back width/height to 2:3 with 0.01 tolerance for subpixel rounding. Measurements ignore decorative seat rotation and require positive dimensions. It runs during preparation, active table play, and direct power selection, including Spy observation. Existing checks preserve viewport bounds, no collisions, and minimum touch targets; `playwright-cli` adds desktop, normal/short portrait, and landscape inspection.

Spy visual-discard regression reproduces the king of spades in 1v1/2v2: it leaves the seat when played openly, remains on the table, and does not reappear after trick resolution/reconnection. Different rank/suit/seat do not remove observation; still-opaque covered/Mask plays retain behavior, while later Mask revelation removes memory. Empty hands show no observed card.

## First visit and disabled reasons

DOM checks welcome without valid nicknames, initial focus, schema validation (empty, spaces, invalid characters, limits), form confirmation, trimming, and saving only after confirmation. Saved nicknames/valid sessions skip the step; later edits/preference deletion preserve the menu. Late responses do not overwrite drafts or enter invitations with old nicknames; invitation codes remain available after confirmation. Blocked storage permits continued visits without local authentication. Nickname confirmation does not POST guests: identity remains server-owned.

Entry E2E uses real confirmation with reload, cookie loss/recovery, and invitations across contexts. Unavailable action buttons require reduced opacity without glow/growth; opaque tooltips preserve contrast and explain current reasons without commands. Out-of-turn cards remain readable. Intentional disabled opacity does not waive contrast for normal text, active controls, or tooltips. `playwright-cli` inspection includes first visit, menu, and tooltips on desktop/mobile.

## Layered scenery and Manilha Maldita branding

DOM checks `MenuScenery` creates no actions, accessible images, or game state, and the lobby omits decorative cards. `menu-layers.e2e.ts` verifies actual PNG loading, readable button text, no horizontal overflow, code entry/return, and reduced motion at 1440×900, 390×844, 320×568, and 844×390. Table helpers require a compact logo left of score; menu helpers check a bounded central column rather than old fixed-background proportions. Match completion closes the counter-raise-ceiling tooltip with Escape before Accept; it neither force-clicks nor mutates server state.

`playwright-cli` complements these tests: desktop/portrait/landscape menu, desktop/mobile lobby, and a real table power card. Inspect alpha crops, image loading, HUD logo, and text inside buttons; geometry alone misses artwork issues.

### Reading the winning card

Feedback regression retains the winning face in the same node during SYNC and releases “Your turn” only after authoritative transition. The observer plays results once, stays silent on intermediate snapshots, and emits turn audio only after release. Feedback E2E checks 900 ms animation, no reduced-motion movement, turn banners bounded to 507 px, and results above cards on desktop/mobile. Ties mark no winner.

Layered-candle DOM tests check original-asset reuse, one unsliced image, displacement filter/halo, and no accessible controls. Menu E2E checks loaded images, no clip-path, active filter/animated halo, four-viewports responsiveness, and static reduced-motion restoration. `playwright-cli` includes paused frames at different instants and desktop/mobile captures to inspect seams/wick stability.

Flame regression compares captures at two fixed SVG-timeline instants with CSS animations paused: tip pixels must change while wax pixels stay identical. CSS-resolution screenshots avoid device-scale resampling differences. Merely checking filter/animate presence does not prove visible motion.

Multiplayer power E2E requires 2:3, cost inside the card, no title overflow, and a dock clear of controls. Full-art revisions must inspect all four enlarged powers and in-match miniatures on desktop/mobile.

`lobby-layout.e2e.ts` checks 1v1/2v2 without horizontal/vertical scrolling at 1280×640, 1280×720, 1024×768, 1440×900, and 1920×1080, including expanded timers/catalog. It confirms fixed switches are absent and copy/ready/leave remain available on mobile.

`Table/Card/hidden.test.tsx` requires distinct Mask/covered backs, no hidden masked rank/suit, preserved strength descriptions, and return to faces when projections authorize. Visual changes do not modify server resolution/projections.

Guided tutorial DOM regressions cover all 17 lessons, required exercise actions, powers, energy, exchange, comparison, restart, translations and focus containment. `tutorial/guided.e2e.ts` traverses exercises on desktop/mobile without creating a room, checks real table composition and card proportions, and requires callouts to remain visible without covering their target. Checks include power expansion, ten actual rank faces in ascending order, iPhone SE, 320×568 and landscape. Visual inspection uses playwright-cli.

Nickname regressions check renaming without changing cookie/identity or extending expiration, rejecting invalid values, and not reviving expired sessions; E2E covers existing-cookie editing, room creation, and reload. Room-menu tests cover surrender cancellation/confirmation, disconnection, Escape, and focus cycling on desktop/mobile Chromium.

Completion DOM tests check 1800 ms reading before effects, loser-only explosions, no buttons until completion, focus after reading, no restart on SYNC/disconnection, and stale duplicate callbacks. Table tests highlight the final trick in final snapshots without transition but not surrender. Full-match E2E checks perspective-specific effects before rematch actions.

Nickname E2E uses an existing session: create/leave a room with the old name, click the profile pencil, check focus, edit, and immediately click Create room. It requires the new nickname and absence of the old in the lobby, after reload/menu return too, on desktop/mobile Chromium without session/transport mocks.

Tutorial DOM regressions cover every step, correct/incorrect explained answers, all four costs, catalog parity, 3→4 cycle, translation, blocked storage, focus, Escape, and menu restoration without entry. Real-menu E2E practices, changes turn-up cards, selects English, visits powers, and reopens after reload without room creation. Geometry covers 1440×900, 390×844, 320×568, and 844×390, complemented by playwright-cli inspection.

Raises: DOM covers replacement of all four announcements, no SYNC restart, silent restored snapshots, pause/acceptance/gap/rematch, and stale callbacks. Audio tests distinguish four motifs/envelopes. `raises.e2e.ts` negotiates 3→6→9→12 between real clients, checking synthesized audio through instrumentation retaining real AudioContext, reduced motion, onscreen text, ceiling, and acceptance without animation blocks; reload does not replay audio. playwright-cli complements desktop/mobile tests.

DEEESCE!! has acceptance regressions for all four values, request replacement, expiration, SYNC/reconnect, folds, and counter-raises without false acceptance. Raise E2E checks text, accepted points, and the fifth audio motif in both clients.

Menu-composition E2E also checks profile contents stay inside the frame and currency rows do not overlap guest captions across five tested resolutions.

## Solo training and development tools

`bun run test:e2e:solo` uses `playwright.solo.config.ts`, isolated ports 3002/5174/4174, and `tests/e2e/solo`. It exercises Play, a real bot, all three cards/four powers, reconnection, and rematch on desktop/mobile Chromium. Production builds run against a backend advertising devTools to prove the UI omits the panel; separate HTTP/WS integration starts production/test backends and proves forged-command rejection. Hidden UI is not authoritative security.

Application regressions verify complete point-based matches, retired clocks/timers, bot pauses without humans, expiration, third-party rejection, idempotency, 40 unique cards, preserved score, and eleven rules. Bot policy still receives only PlayerView. Default multiplayer-room E2E remains separate; solo configuration starts/stops its own servers.

### Global language

`bun run test:e2e --config=playwright.i18n.config.ts` starts isolated development backend/Vite (3002/5174). Desktop/mobile checks persisted language, switching in lobby/live bot matches, no translation-caused commands, preserved in-progress state, results, errors, and tutorial. DOM checks catalogs/placeholders, subscriber/tab synchronization, panel focus, and blocked storage. Preference is browser-local and independent of room rules.

### Table layers

`Table/Scenery/index.test.tsx` requires every decorative category, no match controls/text, and candle reuse across renders. `match/scenery.e2e.ts` starts two real clients and checks loaded images, fixed-scale textures, four corners, no overflow, and candle ratio at 1440×900, 1920×1080, 390×844, 320×568, and 844×390. Reduced motion disables filter/halo; scenery cannot prevent preparation pass. Feedback E2E checks the new candle filter; menu E2E retains moving-flame/static-wax comparisons. playwright-cli visual inspection complements geometry.

### Hand count and Spy

`Seats/Cards/observed-play.test.tsx` regressions check observation removal when public, retained uncertainty after hidden plays, and textual memory without extra cards in one-/two-card hands, including reconnect. They also check another open card preserves the face in a real slot, adjusting indices as hands shrink and after reconnect. Covered cards use symbol-free backs; Mask preserves its symbol/description. After each 1v1/2v2 play, multiplayer helpers confirm every client's visual slots match public hand count and memory contains no card face.

### Table crests and ribbons

History DOM tests cover expand/collapse, `aria-controls`, Escape, and covered-card preservation. `match/scenery.e2e.ts` checks all six loadable materials and keyboard expansion. Complete-match E2E keeps 2:3 ratio, atlas dimensions, no collisions, and 1v1/2v2 flows. Feedback/raise tests retain event/timing contracts with new materials; playwright-cli inspects desktop, portrait, and landscape.

Mobile raise regression also opens the limit-12 explanation and plays while the tooltip remains visible, proving it cannot intercept taps.

History DOM tests cover following the bottom, manual reading, resumption within 2 px, and hand/expansion resets. `match/history.e2e.ts` exercises real new plays/trick grouping on desktop/mobile with a bounded reading window to guarantee overflow.

Scenery regression checks vertical separation between hand plaque/status and centered names/line heights on ribbons at five resolutions.

Scenery E2E also requires at least 13% side margins between list/parchment bounds across five resolutions, preserving usable artwork.

Multiplayer helpers require at least 8 px vertical separation between 1v1 plays and horizontally aligned faces; captions sit beside faces on short screens. 1v1/2v2 matches retain proportion/separation checks between top hand, center, and local player on desktop/mobile.

Scenery uses long nicknames, including 24 unspaced characters, and checks local/opponent names have no horizontal/vertical overflow at five resolutions. playwright-cli visually verifies CSS frames.

Scenery also requires at least 8 px between status/top seat across tested resolutions. Multiplayer geometry follows desktop/landscape heading flow while retaining play separation and Spy-back ratios.

Expanded-history regression requires 48 px between the scrollable list bottom/frame boundary (40 px border plus 8 px clearance) on desktop/mobile while preserving bottom-following/manual reading.

Raise E2E checks a maximum primary-button ratio of 4.1:1 and minimum height of 58 px on standard desktop/mobile viewports, plus automatic background height. Multiplayer scenarios retain checks that actions do not cover hands during small-mobile power selection.

Enlarged Spy observation has DOM regressions for opening, focus, button/Escape/backdrop closure, intel changes/removal, and face removal after opaque plays. Solo E2E uses real Spy preparation to check dialog, 2:3 ratio, and focus restoration on desktop/mobile.

## Clean Architecture regressions

`tooling/tests/architecture.test.ts` checks domain/application dependencies and forbidden runtime effects. `architecture-graph.test.ts` checks indirect barrel dependencies/server cycles; `bun run check:architecture` runs the checker on actual files. `tooling/architecture/graph.ts` participates in mandatory coverage inventory.

Session use cases have fake repository/clock/credential tests. Room tests preserve idempotency, context, privacy, and timer regressions, adding validation order and an alternative decoder independent of network envelopes. Integration exercises the same HTTP/WS contracts after controller/handler/composition separation. Do not reduce coverage or replace real integration with mocks to pass reorganization.

Persistence tests are named by context rather than milestone number. `account-fixtures.ts` prepares accounts/fictitious password hashes; `match-fixtures.ts` prepares results/participants; `database-fixtures.ts` centralizes migration, rollback, and constraint assertions. `queue-fixtures.ts` isolates connections/cleanup for real-commit scenarios.

## Optional account credentials

`modules/accounts` has input-policy tests and service tests using a controlled port for concurrency/errors; adapter tests execute real Argon2id/Web Crypto. They check inclusive limits, Unicode code points, isolated-surrogate rejection, no trimming/normalization, literal SQL-like text, independent random salts, configurable password-hashing costs, verification of bounded older costs, rejection of tampered/excessive costs, and concurrent-operation bounds. Pepper tests check HMAC-SHA256 preparation and rejection when the secret changes. Token tests compare digests with standard-library SHA-256 and reject malicious types/formats, including trailing newlines. Typed-environment tests cover defaults, strict numeric bounds, required secret format, and memory-budget/concurrency consistency; account-security composition is exercised separately from the guest server.

`tests/database/account-credentials.test.ts` checks compatibility with real migrations in rolled-back fixtures: only Argon2id hashes/token verifiers are written; literal passwords/bearers never enter rows. Reading back permits password verification/verifier lookup, while raw bearer lookup finds no session. These credential-only tests do not claim HTTP registration/login; the separate account API tests below exercise those routes and persistence.

## Persistent account API

Account application unit tests cover strict payloads, dummy verification, missing/disabled/wrong credentials, registration failure, policy bounds and admission before password work. HTTP unit tests cover origin, content type/body limits, cookies, fixed unavailable errors and no caching. Runtime regressions mount account routes explicitly beside guest routes and reject insecure production injection.

`tests/database/authentication.test.ts` uses real HTTP sockets, the production account controller, actual Argon2/pepper hashing and PostgreSQL adapters, without mocked services or artificial endpoints. It verifies HTTP→database registration, login rotation, logout, expiry/disabled accounts, SQL injection and forged XP fields, hash-only persistence and initial zero progress. Additional real database cases cover transactional rollback, concurrent duplicate registration, concurrent/durable rate budgets and expiry reset when a key falls beyond a bounded cleanup batch. Fixtures namespace limiter keys and remove only their own records. The socket fixture exercises the account slice; it does not prove frontend login or binding to multiplayer seats.

## Persistent player backend

`integration/match-progression.test.ts`, `account-security.test.ts`, `player-profile.test.ts` and `persistence-startup.test.ts` start the real composed server against the dedicated PostgreSQL database. Two authenticated WebSocket players complete a match with a controlled game clock, and a worker completion event acts as a commit barrier before exact XP/point assertions. There are no reward test routes or mocked game/account services. The suite also exercises recovery-code races, session revocation, password change, ownership, strict bodies, forged levels, profile updates, public catalogs/ranking, startup failure and resource cleanup. Existing multiplayer tests still cover complete 1v1/2v2 matches and privacy.

`database/progression.test.ts` covers delayed/repeated grants, casual/competitive/training/non-completed outcomes, alternating teams, guests/deleted/disabled accounts, rollback, immutable policy versions, replay receipts after result deletion, bigint precision, authoritative unlock checks and deterministic ranking. `retention.test.ts` checks actual cleanup with an injected scheduler and verifies that unfinished jobs/results and replay receipts remain. Security-schema tests exercise constraints/FK behavior. Unit tests cover outbox admission before entropy, immutable match appearance, permission lease failure, malformed credential maintenance, proxy-header spoofing and offline password blocking. None of these checks certifies hosted TLS or encryption at rest.

`bun run test:integration` starts the dedicated Compose test database before backend E2E. The complete coverage command performs this setup itself and does not rerun uninstrumented integration tests.

Review regressions suspend a real Argon2 login after verification, change the password through PostgreSQL, then resume issuance and require a generic 401 with no surviving session. Deterministic lease tests cover delayed lookup, revocation during handshake, single-use grants, unrelated-token isolation, refresh coalescing, late close/failure from a retired connection and non-revival through replacement leases. Room tests revoke authorization between enqueue and execution and saturate an unrelated room while updating a profile. These checks preserve the native coverage thresholds and do not replace the real transport/database suite.

### Account frontend E2E

Run `bun run test:e2e:player` with the designated local test database running. `playwright.player.config.ts` starts the real optional account backend and a production web preview, then exercises signup, persistence across reload, separate cosmetic tabs, forged locked selection, ranking, logout/login and deletion on desktop/mobile. An independent login flow checks invalid credentials (an actual HTTP 401), visible error feedback, session persistence after reload, logout and denied access afterward. The progression flow completes eight competitive matches per viewport using two real browsers and waits for exactly 2000 total XP from the worker. It equips an earned avatar, deck and level-3 table, reloads to verify persistence, switches each category back to its default and restores the earned appearance. The level-5 table remains locked. A new match checks owner-themed backs and avatar, private-card concealment, a viewer-specific table and the unchanged vira. Commands are paced to obey the existing WebSocket rate limit. DOM regressions separately exercise nondefault viewer-specific table themes. It migrates/seeds only `truco_test` via the guarded local database target. The bootstrap pepper is a public test fixture. Never run this live worker concurrently with database/coverage tests against the same test database: competing consumers intentionally claim the same jobs. Stop inspection servers on 3001/4173 before the isolated E2E bootstrap. The global teardown removes known browser fixture accounts through authenticated login/deletion APIs while the server remains running; its SQL is read-only discovery in the guarded test database. After a forced process kill, start the dedicated test bootstrap and run `bun tests/e2e/player-cleanup.ts` before database tests. Never use SQL to grant progress for browser unlock tests.

Frontend DOM regressions cover strict API response parsing, exact selection payloads, recovery/password/delete confirmation, error retry, pagination, focus trapping/restoration, tab keyboard navigation, BigInt display and stale-response/session races. Layout changes also require separate `playwright-cli` desktop/mobile screenshot inspection.

For the affected guest menu/profile/scenery regression subset, run desktop and mobile in separate server invocations with `ENABLE_ACCOUNTS=false`. The 16-test combined rapid batch can reach the existing 120 HTTP requests/minute budget; do not disable the protection to make tests pass. The verified subset was `tests/e2e/profile tests/e2e/menu tests/e2e/match/scenery.e2e.ts`, using `--project=chromium` and `--project=mobile-chromium` separately with two workers.

Authentication feedback regressions submit empty required fields through the real browser, reject short passwords with an explicit message, and verify that an actual invalid-login 401 appears inside the form and receives focus. The form runs explicit validation instead of relying on native constraint bubbles, which could prevent submission without game-visible feedback. Server-side validation and admission controls remain authoritative.

The player browser suite is split into `account.e2e.ts` (contextual registration, validation and server locks), `login.e2e.ts` (independent authentication/session lifecycle) and `progression.e2e.ts` (earned cosmetics, persistence and multiplayer rendering). Use `bun run test:e2e:player --grep "login|optional account"` for the short authentication subset; run the complete command for actual earned-equipment coverage. The progression test derives its origin from Playwright baseURL so local validation can target an already-running development server without stopping it. Isolated runs still use the designated test bootstrap and database.

The earned-cosmetics flow leaves one 60-second admission window after its final UI assertions and account cleanup. Desktop and mobile share the same local peer budget; this prevents their dense reload/equipment checks from exhausting the existing 120 HTTP requests/minute limit across project boundaries. This deliberately paces the suite without changing server limits.

Credential boundary regressions reject five Unicode code points and accept six. Browser account fixtures use exactly six characters to exercise signup and login end to end; account-maintenance DOM tests and real HTTP recovery also exercise the new minimum. Repeated validation against the active development stack can exhaust its default persistent authentication peer budget (20 attempts per five minutes), independently of the HTTP budget; wait for natural expiration or use the dedicated isolated test bootstrap. Do not reset limiter rows or weaken development/production policies to force a pass.

Password visibility DOM regressions cover independent toggles in registration and account maintenance, preserved values, no implicit submit, disabled controls and masking after a mode change. The account Playwright flow toggles visibility with Enter, checks the revealed value and independent masked confirmation, and hides the password before submitting to the real backend.

`player/cosmetics-layout.e2e.ts` checks each table preview stays centered and inside its collection item at 320, 390, 680 and 1440 pixels, without requiring an account or mocking APIs. The regression reproduced the original overflow before the CSS fix. Separate playwright-cli captures cover 320px/390px mobile and desktop visual inspection.

The table-preview layout regression also requires at least 24px between desktop table artwork and its caption, while retaining mobile containment checks.

The cosmetics desktop-fit E2E visits all three tabs at 1024×600, 1280×720, 1366×768, 1440×900 and 1920×1080. It verifies the content has no vertical scroll range, every collection item is inside the visible body and the menu-return control remains in the viewport. This checks actual content fitting rather than hiding overflow. Separate CLI visual inspection remains required.

Browser navigation regressions cover public route parsing, same-route deduplication, safe handling of malformed/external history state, native Back/Forward and listener cleanup. Room-history unit tests verify connection closure without gameplay commands, authenticated restoration, invalid room IDs, and obsolete failure suppression. DOM history is initialized to the document URL and tests await actual popstate navigation when closing panels.

`player/navigation.e2e.ts` exercises menu screens and close/Forward behavior, Back from a real solo game followed by reconnection to the same match, and a delayed real join response that cannot overwrite a newer room. The latency case fetches the real response before holding delivery; it does not substitute a mocked API result. Runs cover desktop/mobile. The isolated player bootstrap explicitly enables solo for this browser flow. Training cleanup uses the normal surrender/result/leave UI and grants no rewards.

Cosmetics regressions require exactly one cosmetic-only disclaimer, located in the modal footer. The table layout scenario also visits 320×568 and requires the footer text to remain visible on short mobile screens.

Deck-preview layout coverage checks all three rotated cards against their preview bounds at 320, 375 (iPhone SE viewport), 390 and 680px, including the showcase and collection items. Visual inspection also covers desktop.

Solo progression tests cover reduced completion/victory XP, no bot-account grants, zero ranking points even in the competitive preset, historical zero-XP policies, configuration/version conflicts and duplicate-job delivery. Development hand-reset tests require eligibility to survive rejected edits but be removed after a successful edit. Training-policy regressions cover every raise level, team rights, the 12-point ceiling, special hands, public threats and hidden-state independence; a complete runtime match requires the bot to request a raise.

Match-result reward tests verify the authenticated route rejects missing sessions, invalid IDs and additional query parameters; PostgreSQL reads return pending before persistence/processing, actual committed amounts afterward, none for excluded historical policies, and no grant details for other accounts. DOM tests cover zero ranking points, pending retry bounds, failures/manual refresh, late response suppression and noneligible/interrupted explanations. The browser reward scenario completes a real competitive match, verifies each player's committed amounts and captures desktop/mobile results.

Arcane corner-spacing browser coverage checks both corner orientations in the selected deck showcase at 320, 375 and 1280px, while deck containment remains covered. CLI visual inspection uses the actual CardFace component with all four three-card suits and the real card CSS, including the three of diamonds at desktop/mobile sizes.

The match-reward browser regression also requires the confirmed-state heading and a readable non-pixel numeric font. Desktop/mobile captures must verify numeral clarity, panel spacing and control visibility.

The font-comparison prototype has DOM coverage for the 240 default pixel samples and 400 samples across all candidates, all forty cards after filtering, all three theme/size changes and its independent entry. Its development route is visually checked with playwright-cli on desktop/mobile, including local font loading and horizontal scrolling confined to the labeled region. It is not part of the standard production browser suite because the prototype entry is not included in the gameplay build.

Deck browser regressions additionally verify every visible rank in all three cosmetic theme previews uses Jersey 10, weight 400 and no synthetic shadow. CLI inspection of actual CardFace fixtures covers 5/6/3/A across the three themes at desktop/mobile sizes, independently of the font-comparison overrides.

Result-music unit/DOM tests cover single preload, distinct win/loss buffers, the four-second duration bound, gesture gating, mute/zero/suspension, live volume, asset/device failures, late decode after close and cleanup. A shared-clock scheduler test verifies the title reading delay and cancellation on a different room/match. Hook tests verify pending cues are cancelled by mute, hidden tabs, room reset and unmount. The real-match browser reward scenario observes native AudioBufferSource starts without substituting playback: each player gets exactly one 3.7–4-second clip after the reading interval, and restoring the finished room after reload starts none.

Deployment database regressions in `database/deployment.test.ts` reject missing/invalid production credentials, weak/ambiguous TLS options, redirecting URL parameters, production seeds/test targets and unknown CLI flags. Real local PostgreSQL checks execute the migration command repeatedly, exercise connection failures with a sanitized error, and apply the checked-in data migration to empty catalogs in a rolled-back fixture. They compare initial product rows with runtime definitions and verify curated existing rows survive repeated application. No test contacts a hosted production database or certifies its TLS configuration.

Solo rematch admission regression captures the finished snapshot, saturates persistence and requires a rejected request plus SYNC to preserve the complete snapshot without consuming gameplay entropy. Replaying that rejected command remains deduplicated after recovery. A match-construction failure releases its reservation and preserves the previous result; a new request then starts a playable rematch.

CI runs general verification once, then executes the complete standard browser suite in a separate job for each project (`chromium` and `mobile-chromium`). Each job starts fresh real servers, so the two viewport suites do not share rooms or an IP rate-limit window. Guest runs explicitly disable accounts. Application rate limits and retries remain unchanged. Failure artifacts retain Playwright traces, screenshots and reports for seven days. The shared multiplayer helper waits for connected clients to render the same snapshot sequence before sending the next UI command, then still requires every client to advance.

The feedback browser regression installs a native MutationObserver before starting the match and captures the rendered deal frame (caption visibility, disabled hand, absent turn badge, deck alignment and animation/reduced-motion styles). Assertions read that actual frame after synchronization instead of racing the short animation over browser RPC. The corresponding authoritative deal snapshot is retained by the authorized snapshot observer. No fixture substitutes server state, animation APIs or elapsed time.

The real account-progression integration flow also awaits delivery of the cosmetic-selection lobby snapshot to all clients after HTTP success and before readiness. HTTP completion alone is not a WebSocket delivery barrier. Setup assertions retain full ACK/error replies for actionable CI diagnostics.

The 2v2 mobile geometry flow checks a minimum 8px vertical gap between the side player and power stack at 320×568 before preparation can consume a randomly assigned power, then repeats the gap checks during the existing small-phone sequence. This remains a real four-browser game. Compact side-seat rules are visually inspected at 320×568, 375×667 and desktop with playwright-cli.

`database/migration-diagnostics.test.ts` covers recognized SQLSTATE/TLS/network codes, nested Drizzle causes, bounded cycles, throwing getters, unknown/secret-bearing fields and phase validation. A real refused loopback connection checks the Bun driver category and connection phase. A production-mode CLI subprocess with a synthetic invalid URL must exit nonzero with the fixed configuration hint and omit the URL, hostname and password. No hosted database is contacted by these tests.

Desktop four-player browser checks require at least 8px clearance between the history parchment and the right opponent before powers are prepared, independently of the random deal. Power-target checks also hit-test the center of every anonymous Spy button at each tested viewport, detecting sibling overlays that bounding-box visibility alone misses. The complete real-client flow retains its 90-second timeout, natural completion, reconnection and rematch assertions.
