# Architecture and operations

Read this document when working on structure, domain, server, transport, interface, or operations. The paths below describe a target structure, not necessarily an existing implementation. Also consult [security](security.md), [rules](rules.md), and [verification](testing.md) as applicable.

## Stack and organization

Approved decision: a modular TypeScript monolith, with Bun in the workspace and backend, Clean Architecture for dependencies, and DDD for the domain. Implementation defaults:

| Area | Default |
|---|---|
| Language/workspace | Strict TypeScript, Bun workspaces, one `bun.lock` |
| Runtime | Bun, pinned for development and CI |
| Frontend | React + Vite running with Bun; PixiJS for table/effects implementation |
| Backend | Bun + Hono + Bun WebSocket adapter |
| Contracts | Runtime schemas, preferably Zod, with derived types |
| Tests | Bun Test for unit/integration tests, fast-check for properties, Playwright for E2E |
| Persistence | PostgreSQL + Drizzle; local infrastructure prepared, no database per move |
| MVP live state | Memory, one authority per room |

Use Bun for installation, scripts, and frontend/backend tooling. The shipped frontend runs in the browser; do not import Bun APIs into browser code. Run Vite explicitly with Bun (`bunx --bun vite` and `bunx --bun vite build`). Keep type checking separate: executing/transpiling TypeScript does not prove type correctness.

Preserve approved choices; future runtime, ORM, framework, or package manager changes require task-specific justification. Do not maintain two package managers/lockfiles, introduce Go without a measured need, or require Redis/database access for every move. Pin versions and scripts during bootstrap; do not invent versions or update unrelated dependencies. Tools requiring another runtime need a documented, validated exception without silent fallback.

Target structure; create modules only when needed:

```text
AGENTS.md
GDD.md                 # product vision and future proposals
apps/
  web/                 # lobby, UI, rendering, client transport
  server/              # HTTP/WS, sessions, rooms, timers, adapters
packages/
  game-core/           # domain, states, rules, powers, pure projections
  game-protocol/       # transport schemas, commands, and DTOs
  game-sim/            # simulations and bot policies
docs/
  rules.md
  architecture.md
  security.md
  testing.md
  balancing.md
  adr/                 # structural decisions, when needed
plan.md
```

The core does not import UI, frameworks, sockets, an ORM, or a global clock. Powers start as a submodule; future extraction must not create cycles. The protocol reuses safe types, never the entire authoritative state as a DTO.

Use a pure domain, application/orchestration, and adapters. Avoid generic repositories, DI containers, microservices, persistent event sourcing, and plugin engines without concrete demand.

## Backend: modules, Clean Architecture, and DDD

Organize by feature first; within each module, separate domain, application, and adapters as needed. Avoid global controller, service, and repository folders combining unrelated features.

```text
apps/server/src/
  bootstrap/                 # process configuration and composition
  modules/
    rooms/
      domain/                # room state, members, and configuration
      application/
        use-cases/           # membership, lobby, match, and solo
        services/            # queue/lifecycle; lobby, match, membership, solo, messaging
        ports/               # input, repository, publication, and runtime
        dto/                 # internal commands/projections and output mappers
        state/               # operational room envelope
      adapters/
        inbound/             # public contract validation
        outbound/            # in-memory repository and runtime
      composition.ts         # module dependency composition
    sessions/
      domain/entities/       # guest identity and validity
      application/
        use-cases/           # issue, query, and rename sessions
        ports/               # storage, clock, and credentials
      adapters/outbound/     # memory and cryptographic generation
      composition.ts
    matches/
      domain/                # pure timing/reconnection policy
    transport/
      adapters/
        inbound/http/        # controllers and security middleware
        inbound/websocket/   # connection and message handler
        outbound/            # serialization and outbound limits
      composition.ts         # Hono handler composition
```

Create only modules and layers exercised by the current increment. `matches` uses the domain in `packages/game-core`; do not duplicate it in `apps/server`. Room authority coordinates lobby and match through the same queue, including startup and rematch; do not create independent writers for the same state. [ADR 010](adr/010-explicit-clean-architecture.md) records the implemented separation and in-memory repository limits.

Within `application`, the first level expresses architectural responsibility; features group files inside `use-cases` and `services`. Do not keep `lobby`, `match`, or `solo` as siblings of those responsibilities. `services` contains shared coordination, presence queries, and preparation of entropy received through a port; `state` contains only the operational structure. `dto/mappers` builds authorized projections and translates safe output errors. The development operation that restarts a hand is a use case in `use-cases/solo`, preserving environment and authorization restrictions.

The application knows the domain and defines its external-effect contracts. Adapters implement those contracts and depend on application/domain, never the reverse. `bootstrap` connects concrete implementations through parameters or constructors without requiring a DI container. Hono and Bun APIs remain at the edges.

The match is the rules' consistency boundary: related card, energy, wager, and resolution updates happen in a single accepted transition. Use match/hand/trick terminology; aggregates and value objects may be represented by types and pure functions. DDD does not require a `Match` class containing all behavior or a class for every value.

```text
packages/game-core/src/
  cards/                     # identities, dealing, and strength
  tricks/                    # trick resolution
  betting/                   # wager negotiation
  hands/                     # completion and special hands
  powers/                    # assignment, energy, and abilities
  match/                     # phases and transition composition
  projections/               # authorized recipient views
```

Command flow: adapter validates message/session → application enters the room queue and checks context/idempotency → core executes the transition → application commits state and schedules effects → authorized projections are sent to each recipient. An in-memory commit does not imply durable persistence or crash recovery.

### Patterns and SOLID

- Single responsibility: each module/file has one cohesive concept and a clear reason to change; extract behavior, not arbitrary fragments.
- Dependency inversion: define small ports for real boundaries such as clock, entropy, scheduling, and storage. Do not create an interface for every function or repositories for cards/tricks.
- State machine: explicit phases and exhaustive handling of allowed commands.
- Domain events: accepted facts feed projections and auditing; private information retains its own recipients and channel. Events do not require persistent event sourcing.
- Strategy: use when distinct policies exist, such as independent/mirrored assignment and simulation policies. Typed functions suffice; do not anticipate plugin engines.
- Prefer composition over inheritance. Segregated interfaces describe consumer needs; alternative implementations must preserve the same contract and invariants.

## Frontend: features and state separation

```text
apps/web/src/
  app/
    main.tsx                 # application mounting
    App/                     # composition and its tests
    styles/                  # global styles and cascade order
  features/
    menu/
      index.ts               # public feature API
      pages/EntryMenu/
        index.tsx
        index.test.tsx
      components/            # Profile, Icon, and their styles
      styles/                # page styles and adaptations
    room/
      index.ts               # public feature API
      components/
        Lobby/
          index.tsx
          index.test.tsx
          Icon/
          Settings/
          Seats/
          Invite/
        Table/
          index.tsx
          index.test.tsx
          Actions/
          Card/
          History/
          Powers/
          Seats/
          styles/
      utils/                 # feature card formatting
  shared/
    preferences/             # local nickname preference
    transport/               # HTTP/WS shared by entry and room
```

Keep components, hooks, styles, and tests close to the feature using them. Components use one folder per responsibility, with `index.tsx`, `index.test.tsx` for their own tests, and `styles.css` for styles; exclusive children stay inside their parent component. Behavior tests may use specific names such as `viewport.test.tsx`. Extensive responsive styles belong in `styles/` next to the component. `pages` contains only pages and their tests; components belong in the feature's `components`, and page styles in its `styles`. Create `utils` and `services` only for concrete responsibilities, without speculative empty folders. Each feature exposes a small public API; other features must not import its internals. Feature-specific code remains inside that feature. Promote code to `shared` when reuse is concrete and responsibility stable.

Separate server-confirmed state (visible cards, turn, energy, score), local UI state (selection, panels, preferences), and animation state. Selection may be immediate; outcomes, spending, and scoring require server confirmation. Do not maintain a second authoritative match state in the client.

React coordinates interface and presentation state; PixiJS receives authorized data and emits interaction intents. Do not duplicate rules in the renderer or make the server depend on animation duration. The client imports public `game-protocol` contracts; the package does not export secret state or the ordered deck. Client imports from `game-core`, if needed, must use an explicitly safe API without loading authoritative state.

Shared transport resolves HTTP and WS from `VITE_BACKEND_URL`, an optional public HTTP(S) origin defined in the Vite build environment or `apps/web/.env.local`. Without a value, it uses `/api` and the page origin, preserving the development/preview proxy. Paths, credentials, and queries in configuration are rejected. HTTP includes cookies; CORS is limited to `ALLOWED_ORIGINS`, GET/POST, and Content-Type. WS handshakes retain explicit origin validation. Direct cross-origin access requires the same site because of the SameSite=Strict cookie; across different sites, use a proxy on the frontend origin. See the [README example](../README.md#frontend-backend-url).

## Size, navigation, and boundaries

The following limits guide handwritten production code, including components and hooks. Line counts are review signals; extraction must preserve cohesion and clear responsibility.

| Signal | Action |
|---|---|
| File over 300 lines | Review responsibilities and extraction opportunities |
| File approaching 450 lines | Extract cohesive parts before expanding behavior |
| File with 500 or more lines | Refactor before completion; exceptions need explicit review justification |
| Folder with around 15 direct files | Consider grouping by concept; do not create artificial subfolders to meet counts |
| Extensive tests | Split by behavior while staying close to the tested area |
| Generated files and lockfile | Excluded from limits; do not edit/split generated output to satisfy metrics |

Use domain names such as `resolve-trick.ts`, `accept-raise.ts`, and `project-player-view.ts`. Avoid generic `utils.ts`, `helpers.ts`, or `services.ts` files and mechanical `part-1`/`part-2` splits. Do not require one file per function or interface.

Modules/packages expose explicit public entry points; avoid barrel chains and deep imports of another module's implementations. Dependencies must be acyclic. Do not make the core depend on the transport protocol to close a cycle; translate messages into domain commands in the application.

During bootstrap, configure lint import boundaries: no runtime/framework/I/O in the domain, no server adapters in the browser, and no access to other modules' internals. Apply size rules through warnings/review with the exceptions above, without claiming checks exist before implementing them. See [testing.md](testing.md) for the increment's checks.

## State engine, commands, and randomness

Model explicit phases: `LOBBY`, `DEALING`, `ELEVEN_DECISION`, `PREPARATION`, `TURN`, `RAISE_RESPONSE`, `TRICK_RESOLUTION`, `HAND_END`, `MATCH_END`. After a wager, resume the saved turn. Use discriminated unions; avoid flags allowing contradictory states.

The core runs matches without browser, network, database, or real clock. A transition receives state, an authorized command, and trusted context, returning state, events, and effects. Time and entropy are explicit inputs; prohibit `Math.random()`, `Date.now()`, I/O, and timers in the domain. Tests use a fake clock and deterministic entropy.

In production, the adapter generates cryptographically secure, unbiased randomness; do not shuffle with a random comparator. Record reproduction data in a private trail with the rules version. Never accept client seeds/results or publish deck order.

Validate before drawing/spending. Invalid or repeated commands do not advance state, the generator, points, or energy. Preserve all 40 cards across hands, the turn-up card, stock, table, and discards without duplicate identities.

Resolution and projection are separate functions. Sharing algorithms does not authorize sharing secret data. The UI may show available actions, but the server revalidates every command.

## Multiplayer and concurrency

### One authority per room

Serialize commands, timers, and transitions per room. Do not rely solely on the event loop: asynchronous operations must not permit concurrent reads/writes of the same state. For the MVP, an in-process queue per room is sufficient; do not add a distributed lock without need.

Identity comes from the authenticated session, including guests. Client-supplied `playerId`, `teamId`, turn, and permissions do not grant authority.

The envelope must identify protocol, room, match, command, and decision context through `commandId`, `matchId`, `decisionId`, and expected version where applicable. Payload types must be specific to each command/power rather than a generic object full of optional fields.

- Parse and validate at runtime before entering the domain.
- For turn commands, validate the expected gameplay revision and context.
- For simultaneous preparation and team responses, validate `decisionId`, phase, and an open commitment/response. Do not invalidate an intent merely because another player became ready or a presence event occurred.
- Separate presence from gameplay revision. Do not conceal real conflicts by weakening all revision validation.
- Accepted decisions close their context; late commands cannot affect the next trick or a rematch.

### Idempotency and synchronization

Deduplicate by logical player identity, match, and `commandId`, with bounded size/retention. The key survives reconnection and does not depend on socket ID. Authenticate before accessing the record. Return the original result for the same ID/payload; reject an ID reused with different content. Check duplicates before rejecting an old revision because the original ACK may have been lost.

Events/snapshots require ordering and versioning. The client ignores duplicates and requests resynchronization on gaps. A stale-state rejection prompts a projection refresh; never replay an intent automatically in a new turn.

Client confirmations or animation completion do not advance server rules. Animations follow accepted events. On reconnection, discard incompatible animations and rebuild the UI from the authorized snapshot.

Complete filtered snapshots are acceptable for the MVP; diffs are a later optimization. Do not broadcast internal state and then filter it in the browser.

## Interface and gameplay experience

On the result screen, leaving is local navigation: close the socket, cancel reconnects, and clear room, URL invitation, and feedback state. When connected, the client sends `LEAVE` before closing without waiting for ACK. When disconnected, “Back to menu” and “Leave room” remain available to any player; rematch and returning to the lobby still depend on the server and host permissions. This does not change abandonment, scoring, or authoritative member removal. Leaving during an active lobby/match retains the existing confirmation flow.

On mobile (up to 600 px) and short landscape screens (up to 500 px tall), history starts collapsed in a 44 px side tab with an arrow. The button opens/closes the parchment; Escape collapses it while preserving focus on the same control. Closed content is also hidden from assistive technology. The open panel bounds its height to the screen and scrolls internally, following new actions only while the reader is at the bottom. Desktop keeps history visible.

The parchment preserves its original 614:768 ratio, `background-size: contain`, and pixelated sampling. Its size follows the viewport; empty content, new actions, long text, and expanded details do not change its frame. The inner list scrolls within margins reserved for folds without warping or slicing the artwork. The empty-history message also belongs to the inner reading area.

History combines public actions with the player's private Spy observation, labeled “Only you”. The card comes exclusively from `match.powers.intel` in the authorized projection and is associated only with that seat's activation and matching target. It remains a record of what was seen even after the play; a new hand uses only the new snapshot, without storing cards in the browser. Teammates, targets, and other players receive only public activations without this private observation.

Confirmed plays animate the authorized face from its hand origin to its table slot for 380 ms using Web Animations. Local clicks only record geometry; rejection does not start motion. Opponents start from an anonymous back without identifying a private card. Covered/masked cards preserve their authorized representation. Initial load, hand/match changes, and resume after a pause do not replay old moves; repeated SYNC does not duplicate the flight. Reduced motion disables displacement. Winner highlights and power effects begin on landing, within the existing authoritative pause.

The wager title and value occupy proportional areas inside the medallion, leaving clearance for its circular border on compact screens too.

The dealing deck and flight origins follow the played-card axis. Above 600 px, the local hand shares that horizontal axis: the arena center in 1v1 and composition axis in 2v2. Compact portrait reserves lateral space for powers.

Ordinary cards use one composition proportional to face width (cqw units), including suits, numbers, margins, and frame. Context changes only the outer size; hand, table, turn-up card, and observed faces preserve the same design.

The Truco button centers icon/text as a single block, with optical compensation for the pixel font; counter-raises share this composition. “Skip preparation” also centers its text optically without asymmetric padding.

At the table, avatar/nameplate spacing is 12 px on desktop and 8 px on compact screens. Names have intrinsic widths bounded by their column, without auto margins separating the frame from its avatar; in portrait, backs sit above identity.

“Play covered” applies to one move: it expires when the snapshot confirms a reduction in the player's hand. Rejected commands and updates without card consumption preserve the selection; a different hand/match starts unchecked.

The main menu lives in `features/menu/pages/EntryMenu`. `shared/MenuScenery` composes menu/lobby decoration: repeating felt in the shell, four corners, four central-symbol segments, candle, cup, coins, deck, and menu cards. Alpha PNGs preserve proportions; CSS defines anchors and bounded sizes without stretching a single image. The Manilha Maldita logo and other assets derive from the previous reference, with provenance/prompts in `public/art/layers/README.md`. Profile/navigation remain HTML. Decoration receives no match state, captures no pointer/focus, and is hidden from the accessibility tree. CSS card animations respect reduced motion. Secondary elements yield space in portrait and content may scroll; short landscape uses compact controls. Creation/joining and disabled future features preserve existing flows.

The lobby composes `LobbySettings`, `LobbySeats`, and `RoomInvite`: host-only settings, player-relative teams, and public-link copying only after a click. Unavailable/rejected Clipboard access offers manual-copy guidance without false success. The code remains an invitation, not a credential. Menu artwork contains no text, actions, levels, currency, or match information.

Without a valid local nickname, `Welcome` (`features/menu/components/Welcome`) requests one before the menu. The field receives focus and accepts Enter; validity/limits use the public protocol schema. `App` separates draft and confirmation: it saves the first nickname only on confirmation without creating a guest or entering a room. An invitation code remains in state and reappears in the join panel. A valid local value or recovered session skips this step. Confirmation remains valid for the visit even with blocked storage; clearing the profile field later does not interrupt the current menu.

The entered nickname is a validated local preference in `shared/preferences/nickname`, restored on first render and saved when editing the profile after confirmation. The client queries the cookie session and uses its confirmed nickname if editing has not begun; late responses do not overwrite an active field or enter an invitation automatically while another nickname is being chosen. On entry, the session response confirms the saved nickname. This preference does not authenticate, resume seats, or store tokens; storage failures are tolerated. Retention/deletion are defined in [security.md](security.md).

The room composition follows the creation reference: left column with title, icon-based setting rows, invitation link/copy, and decorative preview; right column with teams, a brief start condition, and bottom actions. Nine-slice SVG frames preserve ornaments during resizing. Columns stack on narrow screens. `Lobby/styles/scene.css`, `Lobby/Settings/styles.css`, `Lobby/Seats/styles.css`, `Lobby/styles/responsive.css`, and `Lobby/styles/desktop.css` separate composition, controls, players, and adaptations.

Mode/preset use native radios styled as segments, snapshot-confirmed selection, and preserved keyboard access; guests receive a disabled fieldset. Timers occupy an expandable section and respect the preset. Private rooms and random powers are invariants, not disabled controls. There is no public-room option or functional chat; the catalog explains the four powers. Ready is on the player's seat; leave/start/rematch sit in the footer. The public invitation link remains visible in a read-only field selected on focus, with an adjacent copy button and manual guidance on Clipboard failure.

Locked settings use desaturated gray icons, labels, and selectors plus a “Read only” indication linked to the fieldset. The current option remains distinguishable without active-control gold; text preserves contrast without reducing whole-panel opacity. This state follows current snapshot permissions and does not affect invitation copying.

Text uses ivory/light shades over opaque dark green/blue panels; gold highlights titles/codes. Captions are at least 14 px. At the owner's request, disabled action buttons are strongly attenuated (0.25 opacity) without hover glow/scale. Locked cards remain readable because faces/backs are game information. Instructions/title have their own surfaces without text directly on illustrated wood.

`shared/DisabledTooltip` preserves native `disabled` and uses `title`, `aria-description`, and `data-disabled-reason` with the same fixed reason per state. One opaque, viewport-bounded portal avoids clipping and geometry-changing wrappers. Hover, touch, and focus on inspectable powers show explanations; natively disabled controls remain outside Tab order, with descriptions available to screen readers. Reconnection takes priority over stale decision reasons. Native tooltips are suspended while custom ones show and restored only if the reason remains current. Pointer movement and scrolling inside an explanation preserve reading; Escape, external scroll, resize, reason change, and control removal close it and clean up resources without sending actions.

Seat cards have uniform heights across teams and reserve a bottom action area even without a button for that player. Controls anchor there with a minimum height in font units to support two lines without shifting with nicknames/badges.

The current UI uses React/DOM and responsive CSS for entry, lobby, and table. Authorized polish brings forward M4 visuals without changing renderer/rules: `Table` composes `CardFace`, `TableSeats`, `TableActions`, and `TableHistory`. Styles separate foundations, lobby, table, and cards. Local decoration assets and the licensed font live in `apps/web/public/`; provenance/prompts are in `art/README.md`. Backs represent only public counts, never hidden card identities. Seat positions are player-relative, including 1v1. Energy/powers come from M3 authoritative projections, not simulated layout values.

Matches use a `100dvh` surface without a page max-width. The table forms the scene background, with HUD/controls in proportional regions and `clamp`-bounded sizes. Viewport, seat, portrait, and landscape styles are separate; height also determines composition. Hand/actions remain onscreen. During play, the Room menu uses native `details` limited to room information/audio; the lobby appears only outside play, and completion has its own presentation/dialog. Only history/secondary panels scroll internally. Browser fullscreen or orientation locking is unnecessary.

The initial M4 increment keeps the React/DOM renderer and adds targeted CSS effects: anonymous-back dealing, card arrival, winner highlights, and decorative flames. This reversible technical choice avoids migrating the whole table for those effects; PixiJS remains the planned option for scenes/effects justifying another renderer. Do not maintain two complete renderers. React controls HUD, buttons, focus, and accessibility without authoritative rules.

Show the player's hand, teams, turn-up/trump cards, score, accepted/proposed wager separately, turn, energy, power, and public history. Distinguish covered cards from Mask and explain blocks due to energy, turn, phase, target, or previous use.

Offer click/touch without mandatory dragging, keyboard/focus, distinctions beyond color, optional audio, and reduced motion. Animation, sound, or reflexes must not be necessary to understand rules.

Update through events rather than rerendering all of React per frame; bound particles and clean up sockets/listeners/timers/textures. FPS never decides results. Use owned/licensed assets with provenance. Cosmetics do not affect hit areas, readability, time, or information; the domain does not import cosmetic inventory.

[ADR 008](adr/008-authoritative-presentation-pauses.md) defines authoritative dealing/trick/hand pauses. `transition` is not a reconnection pause: it keeps `decisionId/deadline` null and blocks gameplay until the server opens the next decision. Results temporarily occupy the score region to keep resolved cards visible; history retains trick explanations and only confirmed public activations. The client records received results without recalculating winners or accessing others' private information.

`TurnAnnouncement` shows “YOUR TURN!” in a central banner for 2.4 s when the local turn is actionable. Visual context uses match, seat, hand, trick, and public play count, preventing repetition on SYNC, pause/resume, or negotiation of the same card even if `decisionId` changes. A new trick led by the same seat gets a new announcement. Mounting into an open local turn announces it once. This presentation-only timer is cleared on context changes/unmount and protected against stale callbacks; it sends no commands, captures no focus, blocks no actions, and changes no deadline. Reduced motion keeps the banner static for the same interval; status/turn badge remain after it disappears.

`RoundAnnouncement` presents the received trick/hand result during authoritative transition, with seat-relative wording (“you” in 1v1, “your team” in 2v2); ties are neutral. `MatchResult` remains mounted outside the Room menu, following snapshots even in the lobby. Observing `playing -> finished` in the same match shows a central result for 5 s without buttons. Presentation state is adjusted before commit to prevent a final-menu flash. Then a compact dialog shows title, score, reason, and only Rematch, Back to lobby, and Leave room. The first two preserve authoritative `REMATCH`: only the host may clear the result and return everyone to the lobby, without marking ready or starting automatically. Leaving preserves `LEAVE` with ACK; disconnection disables controls. During play, Room contains only room information/audio, not frozen lobby/settings. Confetti celebrates only an ongoing match transitioning to a natural local win: `outcome.reason=completed`, MATCH_END, and confirmed winner score >=12. The contract still caps score at 12. Abandonment, surrender, no-winner completion, and defeat do not produce confetti.

Presentation/dialog use a `document.body` portal to avoid table clipping/transforms. The title receives focus on completion; the background table is `inert`, with Tab/Shift+Tab limited to enabled final-dialog controls. The 48-square layer is decorative; felt/gold/wine CSS colors animate falling for up to 5 s. Positions are deterministic decoration independent of domain entropy. The layer has `aria-hidden` and `pointer-events:none`, without blocking controls or moving focus. Loading an already finished match opens the final dialog directly. SYNC, reconnection during presentation, and repeated snapshots neither extend the interval nor restart confetti; rematch/unmount cancel the timer, and stale callbacks cannot hide another celebration. Reduced motion retains 5 s of reading with static title/hidden particles. The audio observer uses public winner/seat parity, prioritizing match over hand over trick for a single result sound, with distinct victory/defeat tones and neutral ties.

`shared/feedback` synthesizes original Web Audio sounds without remote dependencies/assets. `App` observes authorized snapshots and resets its observer on disconnection; repeated sequences, gaps, and first load do not replay historical sounds. Power/result sounds depend on snapshots; selection/click are local presentation. The engine unlocks after a gesture, tolerates unavailability, and cleans graph/listeners on unmount. Volume/mute live in `truco.audio`; native controls appear in menu/lobby and Room during play. Reduced motion removes extra animations/flames while retaining text results and reading intervals.

## Persistence, observability, and operations

No database query per move in the MVP. Future persistence separates accounts/cosmetics/results from live state; completion is idempotent by `matchId`. Transactions do not span human decisions.

The M5 setup (2026-10-22) materializes only persistence schemas/migrations in `apps/server/database/schema/`. `app.jobs` is a durable reward queue with a result FK and transactional empty NOTIFY trigger; no Redis, extension, or connected worker. In a later increment, result/job will be written atomically, and grants/totals/job completion will share a short idempotent transaction. The listener needs a dedicated connection, query-based recovery, and polling; NOTIFY is not durable delivery. The authoritative room queue remains in memory. See [database.md](database.md) for models, retention, and limits and [ADR 011](adr/011-m5-postgresql-foundation.md) for the decision.

Increment 2 adds `jobs`: pure retry domain, an application worker with queue/scheduler/event ports, and a PostgreSQL adapter in `adapters/outbound`. The adapter requires an explicit SQL client/transactional processor; imports start no resources. SKIP LOCKED selection keeps a row lock, applies the processor in a savepoint, and completes in the same transaction; rollback/failures and old leases have tested handling. The worker coalesces wakes, queries on startup/reconnection and through polling, bounds rounds, and shuts down awaiting active work. No HTTP/WS bootstrap integration, result producer, or real grants. [ADR 012](adr/012-postgresql-job-processing.md) records guarantees and SQL-effect limits.

Operational logs: correlation, phase, revision, command, duration, and error code without full payloads, tokens, cards, or seeds. Private audit/reproduction has separate channels, access, and retention; never use `console.log(gameState)`.

Measure rooms, latency, rejections, duplicates, disconnects, duration, abandonment, and power usage. Do not use player/room IDs as metric labels. External analytics require an explicit decision.

Bound resources, expire rooms, and isolate slow clients. Future deployment drains matches and stops accepting new rooms. Do not assume ephemeral HTTP functions preserve WS/in-memory rooms.

Horizontal scaling requires routing, a single writer per room, and recovery protected against dual authority; Redis Pub/Sub alone does not solve this. Distribute only after a measured need.

## Current bootstrap

The foundation contains five workspaces (`web`, `server`, `game-core`, `game-protocol`, `game-sim`), pinned dependencies, environment-specific TypeScript, Biome, Oxc-parser boundary checks, and smoke tests. Use Bun Workspaces without Turborepo; consider extra orchestration/caching when measured gains justify it. The module tree above remains an evolution reference: the core implements M1 base rules; M2 server/client already use authoritative rooms, transport, and projections. The structure still guides future modules.

Bun is pinned to 1.4.3. Biome 2.5.15 replaces ESLint/Prettier. TypeScript 7.0.2, Vite 8.3.4, and React plugin 6.1.2 use the current stable versions published at the time of review; other direct dependencies were also checked against stable `latest` tags and remain pinned in the lockfile. Prefer compatible current stable versions without convenience downgrades or unauthorized canary/RC releases.

Clean Playwright browser installation was validated with Bun 1.4.3, removing the earlier Node exception. Do not disable TLS validation. See the [README](../README.md) for commands/limits.

`bun run lint` runs Biome and `check:architecture`. Biome checks patterns, hooks, and forbidden globals; architecture checking uses `oxc-parser` for imports and time/entropy APIs without executing analyzed code or depending on ESLint. It is neither a sandbox nor complete proof of acyclicity; graph tests check workspace cycles. Line counts follow the review limits above.

## Decision record

Bun adoption and modular organization are recorded in [ADR 001](adr/001-bun-modular-architecture.md). This document contains current instructions; the ADR records motivation/consequences. Both describe a target structure, not completed implementation.

[ADR 002](adr/002-bun-test-bootstrap.md) records Bun Test and bootstrap limits.

[ADR 003](adr/003-biome-current-dependencies.md) records the Biome migration and dependency update.

## Local persistence infrastructure

Docker Compose provides PostgreSQL 18.6 for development and an isolated test instance. Drizzle uses Bun's native SQL driver; local migrations/seeds live in `apps/server/database`, outside core/application. The initial migration reserves only the `app` namespace without product tables. The database is neither an engine runtime requirement nor live room storage.

Read [database.md](database.md) before changing schemas, connections, seeds, or fixtures. `test:coverage` includes real database tests, so full checks/CI require Docker. Domain unit tests remain independent. See [ADR 004](adr/004-local-postgresql-seeds.md) for the decision/limits.

## Base rules engine (M1)

`game-core` exposes explicit subpaths for cards, dealing, tricks, hands, betting, match composition, and projections. Functions are pure, return new data, and reject invalid inputs with stable codes without putting cards into errors. These are typed internal APIs; transport must validate unknown payloads and never serialize this private data directly.

Shuffling receives 39 integer indices from the trusted adapter (exclusive bounds 40 down to 2) and applies Fisher–Yates to a new deck. The production adapter is responsible for cryptographic, uniform index generation; no entropy comes from the client. Dealing uses one-card rounds per seat, starting with the leader, with the turn-up card after three rounds. This internal order is deterministic/reversible, not a rule change or ID-security guarantee.

The trick resolver requires a complete clockwise trick, rejecting duplicates/the turn-up card and covered cards in the first trick. The hand resolver applies the normative table and rejects histories with plays after early completion. `match` composition validates ownership, phases, order, special-hand covered cards, wagers, and scoring. Each decision closes a revision; rejection and repeated delivery with an old revision do not mutate state. `finishHand` is an internal helper outside the exported API. The engine alone is not a playable server.

The composition API has `TURN`, `RAISE_RESPONSE`, `ELEVEN_DECISION`, `HAND_END`, and `MATCH_END` states. Dealing/resolution are synchronous atomic steps without waiting for clients/animation. `dealNextHand` requires `HAND_END`, rotates the leader, and receives new shuffle choices; dealing never occurs after 12 points. `HAND_ENDED` preserves the original reward even when the score is capped at 12.

Public/individual projections are allowlisted. Hidden hands expose only seat/count; covered cards have no card or physical reference for others, including history/completion. Eleven preserves partner visibility already granted within the hand; 11×11 does not grant it. The caller authenticates the recipient. Future network protocol must adapt these views without exporting authoritative state.

M1 shipped without power/energy fields or execution. M3 added these transitions while respecting `hand.kind`, keeping special hands free of draws/regeneration; do not derive a powerless product preset from this engine stage. Match IDs, sessions, queues, command deduplication with ACK replay, and timers belong to the M2 application. See [ADR 005](adr/005-base-match-engine.md).

## Authority and transport implemented in M2

Room entry delegates to `RoomApplication`; use cases, command executor, and lifecycle service share operational authority. `serializeRoom` keeps the queue bounded and recovers after rejections. A command received at the deadline first resolves expiration, then validates context; timer callbacks carry the decision and cannot affect later hands/rematches. Queued room identity is checked even after removal, preventing an old room callback from writing to a different room with the same code.

The room application exposes `use-cases/membership`, `use-cases/lobby`, and `use-cases/match`. `services/` coordinates execution, publication, and scheduling; `state/` describes the operational envelope separately from domain state; `ports/` declares effect/authority-access contracts. `solo/` preserves limited-view bot policy and development tools. `messaging/` builds internal projections and dispatches commands. External consumers use public module entry points. The room repository retains the live instance and queue; durable implementation requires a new consistency design, not merely replacing `Map` with SQL.

`@truco/game-protocol` contains strict envelope, action, configuration, and snapshot schemas without secret-state dependencies. Core public subpaths are declared in its manifest; architecture checks allow only those entries and prohibit the entire core in browser code. The domain remains pure. The application receives clock, entropy, and scheduling through `Ports`; `rooms/adapters/outbound/runtime.ts` implements UUIDs, unbiased cryptographic rejection sampling, and cancelable timers over monotonic epoch time.

`sequence` orders full snapshots; `roomRevision` closes lobby changes; `match.revision` and `decisionId` close gameplay decisions. Presence changes sequence without invalidating gameplay revision. Before effects or revision rejection, authenticated requests query the `sessionId/matchId/commandId` cache: identical content receives its original ACK/error; different content is rejected. The cache stores 512 recent responses per room, while context/revision protect replay after eviction. The client uses UUIDs per command, ignores repeated/old snapshots, and never automatically repeats intents after reconnection. On focus/visibility recovery it requests an authorized snapshot through `SYNC` without replaying intents; listeners are removed on connection close. Full snapshots already resynchronize gaps; `SYNC` requests them explicitly.

`DecisionClock` tracks remaining time and protection budget per seat. Only decisions requiring an absent player pause; team responses use an “any teammate” policy. Simultaneous absences consume budgets in parallel. After protection, remaining time resumes; with untimed cards and exhausted protection, decisions receive immediate fallback. Already-expired new decisions are scheduled for the next queue execution without recursion or indefinite blocking. Shared timeouts count toward eligible team seats; a valid response resets its author's sequence. On the third consecutive required timeout for the same seat, that team loses by abandonment.

Casual configuration accepts 1–120 s and may disable only the card timer. Competitive fixes card/response at 20/15 s and protection at 30 s; casual defaults to 30/20 s with 60 s protection. M3 adds configurable casual preparation (default 15 s) and fixes competitive at 10 s. A room without connections expires after preset protection, without winner or unlimited automatic plays. Other rooms/queues do not depend on this wait.

The lobby allows moving only to free seats before play; the server rejects occupied seats even if their occupant is not ready. Seat/configuration/join changes clear readiness. Hosts start only when everyone is present/ready. Leaving lobby/completion removes membership and transfers hosting; active play requires explicit surrender. Rematch returns to the lobby with the same seats/settings and fresh readiness, generating a new `matchId` on start. Leaving sends ACK before socket closure.

A React DOM client provides table, lobby, and bounded reconnect backoff through Vite `/api` proxy and session cookie; browsers do not share authoritative state. Its original green/gold appearance was provisional without generated assets or M4 polish. The backend does not query a database per move or recover matches after restart. See [ADR 006](adr/006-room-authority-and-reconnection.md) and README configuration.

## Powers and simulations implemented in M3

`powers/powers.ts` centralizes assignment, energy, and activation validation; `powers/preparation.ts` seals intents and resolves the batch. `PREPARATION` is explicit; card commands carry optional power atomically. `PowerSetup` is private, supplied by the adapter, and outside the protocol. The internal powerless entry remains for base regressions/experimental control, never a room preset. [ADR 007](adr/007-sealed-powers-and-simulation.md) details sampling, compatibility, and limits.

`TablePowers` separates local selection from server confirmation. Cards use original decorative art; cost, name, energy, and state are projection-derived HTML without private image data. History has its own panel; powers occupy `Table/Powers/Card` near the hand with energy reserve. Preparation pass sits in actions beside ready counts, preserving small-screen card space. Preparation starts collapsed. Clicking an available power selects targets directly on the table: Spy highlights opposing backs; Second Chance enables own cards for exchange; Boost/Mask highlight eligible own cards on the local turn. `Hand` holds cards/contextual guidance without selects or a card-selection panel. `Seats/Cards` holds clickable backs and private Spy observations. Details open on demand, close by button/Esc, and restore focus to the card. Opening is tied to decision context; new context discards the old panel. Turn-power selection is tied to decision ID and cleared when it changes. The server revalidates cost, window, target, and ownership independently of UI blocks.

`game-sim` depends only on public core entry points. Policies receive `PlayerView`; the private runner handles phases, entropy, and metrics. Separate per-hand sources maintain paired distributions, enabled/control arms, and seat/team permutations. The local CLI does not integrate with the server or export production seeds.

## Physical frontend organization

`app` contains only mounting, composition (`App/`), and global styles. `features/menu` keeps only the page/test in `pages/EntryMenu`, Profile/Icon in `components/`, and page styles in `styles/`, exposing entry through its public API; `features/room` exposes Lobby, Table, and CardFace. Exported component names remain unchanged while files follow the `index.tsx` directory pattern. This does not require isolated tests for every decorative component: existing composition tests remain beside the parent exercising them.

Styles belong to their page/component, including table adaptations/lobby controls. `app/styles/index.css` is the sole loading manifest: it explicitly preserves the existing cascade, including global style placement among layers. Components do not import extra CSS, avoiding JavaScript import-order dependence. Cascade order may be simplified in a separate visual review; this reorganization preserves generated CSS.

`room/utils/cards.ts` holds presentation types, suits, and card labels used by table, seats, history, and powers. It imports neither JSX nor private domain data. HTTP/WS and nickname preference remain shared because they serve entry/room; moving them into one feature would create artificial dependency.

Power illustrations use a square viewport (`aspect-ratio: 1`) to crop the 2×2 atlas without distorting axes. Frame, title, cost, and status are separate; cost anchors inside the illustration. On short mobile screens, the card becomes a miniature with name/art/cost, reserving the footer for energy; state remains in the accessible button description and selection retains its outline. Card clicks preserve details/private Spy results. The smaller card sits left of the hand. Hover/fine-pointer devices above 600 px use a sleeve clipping roughly the bottom half at rest; hover, focus, open details, or selection reveal the full card. Energy remains visible. Clipping changes neither square art geometry nor button semantics. Touch screens keep the whole card without an extra reveal tap. Portrait/landscape hand and local identity reserve lateral power space; reduced motion removes the transition.

Power projections keep `power: null` on other seats until an accepted public activation in the hand, including teammates. Only the owner receives unused assignments. Null also covers absent powers in special hands; UI distinguishes “Hidden power” from “No power” by hand type. Reconnection reapplies recipient-specific projection without a client-enriched public snapshot. The UI lists revealed powers/activations while preserving the local card.

Power selection is local, tied to match/hand/decision/assignment/readiness, and discarded on pause/context change. Esc, cancel, or clicking the power again cancels without a command; target-origin cancellation restores focus to the power. Guidance sits near the hand; short portrait/compact landscape use the existing status area to preserve table space. Covered-card controls are absent during preparation; pass controls compact in landscape. Exchange-card clicks send `PREPARE`; Boost/Mask remain atomic with `PLAY_CARD`. Authority/protocol do not change.

For Spy, backs remain anonymous: clicks choose an opponent and visual observation position without selecting a physical identity or sending a card index to the server. The server still determines the random card, revealed only after preparation resolves. Its face occupies the clicked back and remains in a remaining slot after another open card is played. If that index disappears, it moves to the last slot. After an opaque target play, the UI separately shows textual “Seen” memory warning it may already have been played. This shift depends only on public opacity, not hidden identity. Reconnection restores private-projection observation; visual position may return to the first back. No ID permits tracking masked/covered cards.

## Turn HUD and consumed power

The power card renders until the local seat has confirmed `used` in the projection. Selection, pending sealed intent, and rejection do not remove it. Energy remains in the dock, and Spy retains the private face in the opponent's hand/history memory. The next hand displays its new assignment. Server assignment, consumption, and secrecy do not change.

Match status sits at the top below the score, with hand type and estimated time where applicable. The local avatar receives “Your turn” only during its active, unpaused TURN. Actions remove the redundant “Play card” panel; Truco/decisions retain compact touch targets of at least 44 px. The hand remains the click/touch play target with existing keyboard access/blocks.

## Playing-card proportions

Faces/backs share `--playing-card-ratio: 2 / 3`, matching original back art (1024×1536). Hand, seat, table, and turn-up slots use aspect-ratio/automatic height; responsive rules change only width, bounded relative to screen height when necessary. Backs use contain to preserve art. Spy observation, including enlarged mobile faces, uses the same ratio; its independent hit target remains at least 44×44 px. Decorative back rotation does not change layout bounds or reveal identities.

Seat Spy observations disappear when authorized target plays (current/completed tricks) contain the same card, comparing seat, rank, and suit. This derives from snapshots, including reconnection, without extra tracking state. A public zero card count also removes the observation. Different cards or still-opaque plays neither remove it nor reveal private identities.

Winning-card highlights use confirmed-trick `nextLeader`, with no winner on ties: grow up to 20%, shake for 900 ms, and remain 12% larger until authoritative presentation ends. Existing result audio starts in the same snapshot, respecting volume/mute without replay on SYNC; turn audio/announcement await server release. The result banner occupies the top panel to avoid covering cards. Reduced motion retains only static outline/glow. The “Your turn” banner/title are about one-third narrower/smaller while captions remain legible.

The standalone menu candle uses one original PNG instance without crops. A local SVG filter combines noise and a gradual intensity mask: only the flame tip displaces, reaching zero above the wick. Declarative animation changes intensity while the halo pulses through CSS; there is no per-frame React state or timer. Decoration preserves 477:512. Reduced motion disables filter/animated halo. The layer remains noninteractive and hidden from assistive technology.

Menu composition restores the prior reference's dense diagonal borders using four transparent `border-*` PNGs with wood/fabric. Props reuse separate assets at corner/side anchors without returning to a monolithic background. `MenuScenery/composition.css` arranges density, symbol, and frames; breakpoints preserve control access in portrait/landscape. Logo/original candle image remain intact.

Candle rendering moved to SVG with viewBox 477×512: the original raster image remains a single instance, and filter primitives use explicit artwork coordinates. An internal feFlood/feGaussianBlur mask is bounded above the wick. Output combines the displaced tip with the original remainder on a declarative 1.6 s cycle. This replaces the feImage mask and HTML-image filter whose prior effect was imperceptible.

Power cards use four complete 2:3 artworks in `art/layers/power-card-*.png`, following gold frames, ribbons, and parchment references. Name/cost/effect remain accessible HTML over blank art areas; availability stays outside the card. Mobile miniatures hide the effect but retain the existing detail panel. The decorative menu card shares this composition.

The lobby removes the redundant invitation block while keeping the copyable link. Desktop spacing, avatars, and action areas adapt to height; time settings use three columns, and the power catalog expands over the panel with its own scroll instead of stretching the page. Mobile keeps stacking/natural scroll. Frames/team cards remain intact.

Hidden played cards use public `CardBack` variants: Mask has a purple back, mask symbol, and “Counts as strength”; covered cards use original back art without overlaid symbol/text. Hand backs stay generic. Variants depend only on projected `power`/`covered`, never hidden identity. Accessible descriptions explain the difference; authorized Mask faces retain purple outlines.

During play, `RoomMenu` provides an opaque panel with subtle felt/shared lobby frame, audio, return, and surrender confirmation. Escape/close restore trigger focus; Tab stays in panel controls. Surrender sends `SURRENDER`, never `LEAVE` during active play; after results, leaving uses the existing server-confirmed flow. Disconnection disables surrender but still permits panel closure.

POST `/api/guest` updates an existing session's validated nickname while preserving token, identity, and expiration. New joins/creations use it; occupied seats retain their snapshot. This prevents create/join from restoring the previous nickname after a menu edit.

`shared/EnergyIcon` supplies a pixelated SVG bolt for power costs, energy reserves, and decorative cards. Its shape is font-independent; accessible labels/numbers remain in source components. The decorative SVG preserves proportions across card sizes.

Menu profiles use `profile-frame.svg` as a nine-slice border and `avatars-pixel.png` as a 2×2 atlas shared with seats. The pencil button focuses/selects the existing nickname field, respects busy state, and preserves persistence flow.

The Spy face uses `power-card-spy-character.png`, featuring a hooded character, central medallion, and right-side energy capsule. `.power-spy` specializes cost/title/effect positions; text/values remain catalog-derived HTML. Menu decoration shares the face.

### Final sequence after the last card

When a live-observed match ends by points with a final resolved trick, `MatchResult` keeps the table unobstructed for 1800 ms (`reading`). The winning card remains marked by public `nextLeader` even without `transition`. Result presentation then runs for 5000 ms: confetti for natural victory and a radial 24-particle pixel-art explosion for defeat by points. Only afterward does the action dialog appear. The initial interval does not apply to surrender/abandonment or endings without a final trick; initial load of an already ended match still opens the dialog directly.

Both stages are cancelable, do not restart on SYNC/disconnection, and reject callbacks from an earlier stage/match. Focus moves to the title only after table reading. Reduced motion hides particles while preserving intervals/text. No server timer, score, or command changed. This sequence supersedes the immediate presentation described earlier.

### Tutorial and incremental internationalization

`features/menu/components/Tutorial` opens from the menu as a portal dialog with seven steps, practice questions, and turn-up/trump demonstrations. It uses only local public examples without sessions, commands, or match data. The visual rank cycle is educational, not authoritative comparison. Images reuse game assets and text remains HTML. Background is inert; Escape, close, and completion restore button focus, while navigation keeps title/footer accessible through internal scrolling.

`shared/i18n` centralizes the whole Portuguese/English UI: menu, profile, lobby, table, cards/powers, results, tooltips, transport errors, audio, development tools, and tutorial. `game.ts` aggregates interface/table/feedback catalogs; Portuguese source phrases are typed keys with positional placeholders for names/values. `tutorial` and `raises` retain their own contracts. Never translate nicknames, room codes, ranks, or protocol values. Card text is HTML over artwork and therefore follows language selection.

Global, reactive `truco.locale` (`useSyncExternalStore`) synchronizes across tabs; `App` updates `html.lang`. Settings opens language/audio in menu/entry/lobby; during play, the selector is in the room menu. Tutorial language selection also changes the whole game without losing the current step. Switching language does not remount the match, reset selections, send commands, or restart animations. Storage failure keeps selection in memory; unknown values use Portuguese. Module-level dictionaries resolve translations only on access to avoid frozen labels. New languages must preserve equivalent placeholders, IDs, costs, and answers; tests enforce these contracts.

### Raise announcements

`shared/feedback/raises` identifies only consecutive confirmed proposals in the same match/hand. `RaiseAnnouncement` shows TRUCOOOOOOO!! / SEEEIS! / NOOVE! / DOOOZE!! for 1800 ms using independent letters and a CSS impact ribbon. The layer captures neither pointer nor focus; proposed value remains explicit. Acceptance replaces the request with DEEESCE!! and the accepted value for 1800 ms; folding, pause, or context change cancels it; new raises replace old ones, and stale callbacks cannot clear the new effect. Initial load, sequence gaps, and resume do not replay announcements.

Counter-raise buttons show the next value (6/9/12); at the ceiling they show a disabled limit. The request button also follows the next level after an accepted raise. New labels live in `shared/i18n/raises.ts`, with pt-BR/en catalogs selected globally. Authoritative values/commands do not change.

Web Audio synthesizes four original raise effects and one descending acceptance motif using sawtooth waves, short envelopes, and distinct motifs without external recordings or synthetic speech. Per-note volume is reduced to compensate for harmonics/overlapping notes. All honor existing gesture unlock, volume, mute, disconnection, and cleanup. Proposal/confirmed-acceptance detectors feed the audio observer; acceptance requires settling exactly the pending value in the same hand without triggering on implicit counter-raise, fold, or resume. Acceptance audio takes priority over turn notification; reduced motion removes wobble/entry while preserving text for 1800 ms.

### Solo training and development tools

[ADR 009](adr/009-solo-training-and-development-tools.md) records the authorized extension. The room lifecycle service schedules bot/timers on the same queue; `solo/bot.ts` sends only the projection to game-sim. Bootstrap resolves independent flags and blocks tools outside development. `solo/dev-tools.ts` recreates a consistent hand preserving score; existing envelope/cache prevent replay/stale context. The frontend fetches `/api/features` to enable Play and conditionally imports the panel only in Vite dev, also requiring room authorization.

### Modular match scenery

`Table/Scenery` composes floor, repeating felt, nine-slice frame, four flourishes, and independently corner-anchored objects. It uses `art/table-layers/` assets derived from the preserved original background. `shared/ScenicCandle` reuses the same animated candle in menu/table. Scenery receives no projection or events: it stays behind the arena, inaccessible and pointer-transparent. Texture size is fixed; corners/objects have independent portrait/landscape scales. Real-card layout/authority remain in existing components.

### Match interface materials

`Table/Theme` applies team crests, wager medallion, name frames/action ribbons, history parchment, and wooden plaques. Transparent PNGs in `public/art/table-ui` contain no text/values; UI still derives everything from projections/i18n. Faces, backs, power atlas, and ratio rules remain in their original components. Ribbon colors are decorative; labels/positions still identify teams/states.

`TableHistory` starts compact: three recent entries on desktop and the last on mobile. An `aria-expanded` button expands the hand's public history with internal scroll; Escape collapses without commands. The list follows the bottom while the reader is within 2 px; scrolling up preserves position during updates, and returning to the bottom resumes following. New hands or compact/expanded toggles return to the newest action. Opaque plays remain redacted by projection. No new storage. Covered-card selection keeps its accessible native checkbox with a back miniature; Mask retains its distinct appearance.

Turn, result, raise, and completion announcements reuse table materials. Events, pauses, focus, audio, reduced motion, and server authority remain in existing feedback components.

`Table/Theme/nameplates.css` replaces name images with double-gold-border CSS frames and asymmetric corners. Height follows full nicknames, wrapping even without spaces; descriptions use a separate line. Mobile top seats reserve a full identity row. `alignment.css` preserves action-ribbon content bounds. Medallion, hand plaque, and status use viewport-coordinated dimensions to keep separation.

Parchment reserves 14% of width on each side for wood/ornaments. On desktop/expanded history, `history-frame.css` renders the same PNG as a nine-slice border-image: the lower fold occupies its own 40 px border followed by 8 px inner clearance. Only the center expands; scrolling remains inside usable bounds. Compact landscape uses a 16 px lower border. Scroll following remains unchanged.

In 1v1, `Table/Theme/tableau.css` reserves card/caption height at each central position with a 16 px gap. Both positions remain a column on every screen, local play below. Desktop places top-seat identity beside the hand, freeing height without changing card proportions.

`Table/Theme/heading.css` places status/top seat in consecutive desktop/landscape grid rows with a 12 px gap. Actual text height participates in flow. The 1v1 center starts after these rows; `vertical-plays.css` keeps plays in a column and scales to available height. On short screens captions sit beside faces without changing ratio. Name frames use `fit-content`, bounded by seat width. Spy targets center backs in the touch row without stretching them.

`Table/Theme/truco-button.css` preserves ribbon PNG ratio with background-size 100% auto. The primary button uses 4:1 ratio, bounded width, and smaller scale on short mobiles; counter-raise occupies a full response-grid row in landscape.

Clicking/tapping the Spy-observed face enlarges the same authorized card in a native dialog, preserving 2:3. The dialog traps focus, closes by button/Escape/backdrop, and restores trigger focus when it still exists. Observation changes/removal unmount enlargement; textual memory after opaque play creates no extra hand face. This local inspection sends no command and pauses no timer.

Face value 5 uses Manilha Card Numerals, a one-glyph derivative of Pixelify Sans Bold under SIL OFL 1.1. It preserves original metrics, baseline, and strokes; a straight top/continuous left stem distinguish five from S. `tooling/fonts/build-card-five.py` reproduces the asset. There is no overlaid SVG: rank remains text, inherits suit color and bottom-corner rotation. Other characters use the original font.

Power descriptions remain visible in mobile portrait/landscape. They use artwork parchment, Jersey 25, and card-proportional size; Spy reserves its own area below the medallion. Second Chance's title scales to avoid escaping the ribbon on narrow phones. Card dimensions/activation do not change.

On short mobiles, energy remains in flow below the power card rather than absolutely over artwork. Status text hidden for lack of height no longer reserves space; the card/lower badge remain intact and separated from energy.

In 2v2, played-card areas reserve a vertical gap between upper caption/lower face. Space grows by breakpoint without distorting faces. In portrait up to 600 px tall, teammate cards sit beside identity and plays use a smaller scale, preserving 2:3 and local hand clearance.

### Optional account credential foundation

`modules/accounts` separates pure credential policy (`domain`), hashing port/concurrency-limited service (`application`), and Bun.password/Web Crypto implementations (`adapters/outbound`). The application receives implementations through a port and does not access runtime, environment, or database. Account tokens are distinct from existing guest credentials. `bootstrap/environment.ts` validates typed configuration, and `bootstrap/account-security.ts` explicitly composes the credential service; the guest `startServer` does not invoke it. Share one service instance per process and validate attempts before hashing. Registration/login routes and runtime account persistence remain pending. See [ADR 013](adr/013-account-credential-foundation.md).

Account security configuration defaults to `ARGON2_MEMORY_KIB=19456`, `ARGON2_ITERATIONS=2`, accepted verification ceilings of `ARGON2_MAX_MEMORY_KIB=65536` and `ARGON2_MAX_ITERATIONS=6`, and `PASSWORD_MAX_CONCURRENCY=2` within `PASSWORD_MEMORY_BUDGET_KIB=131072`. `PASSWORD_PEPPER` is mandatory for account-security composition: 64 lowercase hexadecimal characters, with no default, held outside the database. HMAC-SHA256 with that secret prepares the password input before Argon2id adds its independent random salt. Bounded older costs remain verifiable; pepper rotation, rehash, and account recovery are not implemented. Environment validation does not establish production memory capacity; benchmark configured costs/concurrency on the target deployment.
