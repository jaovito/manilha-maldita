# Manilha Maldita

A foundation for a browser Truco Paulista game with powers. The project uses Bun Workspaces, TypeScript and an authoritative modular backend.

M1, M2 and M3 are implemented: a tested pure engine and multiplayer 1v1/2v2 matches with private rooms, guests, lobby, betting, eleven, timers, reconnection and rematches. The application has responsive entrance, lobby and table views with pixel-art direction: felt, wood, gold frames, portraits and parchment cards. Energy, sealed preparation and all four powers work in both presets. M4 is in progress, with animations, audio and pauses to understand results; broad accessibility review and human playtests remain pending. The conceptual presentation remains in root `index.html`; the web application is a separate workspace.

[Generated assets and their prompts](apps/web/public/art/README.md) live in the project. Pixelify Sans is local and includes its OFL license. Images are decorative; cards, actions and scores derive from server-authorized state.

On first access without a valid nickname, a welcome screen asks what friends should call you. Confirm with Enter or “Continuar”; the nickname is saved only after confirmation. Received invitations remain prefilled for joining. A saved nickname or one recovered from a valid session skips this step; profiles allow later editing. Storage failure does not prevent continuing during this visit.

Unavailable buttons have 25% opacity without hover glow. Hover or tap for a tooltip explaining the restriction; permissions, pending players, phase and turn have specific explanations. Cards remain readable while playing is blocked.

The menu uses layered scenery: repeating felt, four wooden corners, four crest segments, independent props and animated decorative cards. The **Manilha Maldita** brand and pieces were generated from previous artwork to preserve identity. The profile is independent HTML; logo, controls and props retain their proportions as the composition adapts. Mobile navigation prioritizes reading and touch; secondary decoration yields space. “Jogar” starts bot training when enabled on the server; “Cosméticos”, “Configurações” and “Sair” remain future work. Reduced motion disables floating cards.

During matches the table fills the viewport without page scrolling. Status appears at the top beside the score, and a “Sua vez” badge follows the player's avatar only when play is possible. Right-side actions are compact; cards are played directly from the hand. Faces/backs retain a 2:3 aspect ratio in hands, seats, table and turn-up card, changing only size. Score, hand, turn-up card, players and actions reorganize by width, height and orientation; the “Sala” menu offers sound and room identity without frozen settings. Match completion has its own presentation/menu. History and room panels can scroll internally.

Dealing has a 0.9 s presentation with animated backs. Trick results stay visible for 1.8 s; hand results for 2.4 s before the next deal. The score area temporarily shows the result/explanation while resolved cards remain on the table; the winning card is highlighted. When continuing, status identifies the next trick's opener. Each new own turn also shows **SUA VEZ!** in a large central banner for 2.4 s; it disappears upon playing or losing the turn and blocks neither clicks, keyboard nor timer. Room updates and resuming the same play after betting do not repeat the announcement. The server controls result intervals and starts decision time afterward. Reconnection does not extend presentation.

Original sound effects accompany clicks, menus, cards, confirmed powers, turns, dealing and results. “Som” provides volume/muting in menu/lobby and “Sala” during matches; audio begins after page interaction. Preferences stay in the browser without cards or snapshots. Reduced motion disables dealing motion, animated candle flames and motion effects; text notifications/result-reading intervals remain. The [M4 playtest script](docs/playtest-m4.md) records what still requires human assessment.

Wins, losses and ties have different sounds for each perspective. Trick/hand resolution shows “VOCÊ VENCEU!” / “VOCÊ PERDEU” in 1v1 and “SEU TIME VENCEU!” / “SEU TIME PERDEU” in 2v2. Match completion occupies the center for 5 s before actions appear. Natural victory at 12 points highlights “VOCÊ VENCEU!!” or “SEU TIME VENCEU!!” with animated entry and square confetti in game colors. A single result menu then shows score, reason, “Revanche”, “Voltar ao lobby” and “Sair da sala”. Rematches/lobby return require the host and lead to everyone's readiness confirmation; matches never restart automatically. Settings/invitations appear only in the lobby. Reduced motion keeps static results and hides confetti; reconnection/SYNC do not repeat celebrations.

## Requirements

- Bun **1.4.3**, pinned in `.bun-version` and `packageManager`.
- Biome handles lint/formatting; `bun run check:architecture` checks project-specific boundaries.

Direct dependencies have exact versions reproduced by one `bun.lock`. They use the latest stable versions published at the 2026-10-17 review. Updates must pass the same checks. Bun 1.4.3 was also validated installing Playwright browsers into an empty cache without the former Node exception.

```sh
bun install --frozen-lockfile
bun run dev
```

`dev` starts Bun/Hono at `http://127.0.0.1:3001` and Vite at `http://127.0.0.1:5173`. Open the frontend, enter a nickname, create a room and share its link/code. The nickname is saved in this browser to prefill after reload; clearing the field removes this preference. This saves no session and cannot recover rooms after server restart. In the lobby choose format/preset, free seats and readiness; the host starts when everyone is ready and connected.

Starting requires two players in 1v1 or four in 2v2, all connected with “Estou pronto” confirmed. Only the host starts. The lobby explicitly shows pending players/confirmations and who needs to reconnect.

To test 1v1/2v2 on one machine, use distinct browser sessions/profiles. Tabs in one session control the same seat: a new connection replaces the old one. Reloading a room link resumes the seat through its cookie without tokens in URLs. At match end, the host opens a rematch; everyone confirms readiness again.

Playing does not require PostgreSQL. `bun run dev:server` and `bun run dev:web` start each side separately. `bun run start:server` runs the backend without watch mode. Vite/preview's `/api` proxy keeps HTTP/WebSocket on the frontend origin. Use `/health` on port 3001 to check the process.

## Frontend backend URL

Copy `apps/web/.env.example` to `apps/web/.env.local` and configure the public backend origin without `/api`:

```dotenv
VITE_BACKEND_URL=https://api.your-domain.com
```

The variable configures HTTP requests/WebSocket (`https` → `wss`, `http` → `ws`). Empty retains same-origin `/api` and the local proxy. Restart Vite after changes; on hosting, configure it in the **frontend service before running `bun run build`** and rebuild. `VITE_*` variables are public in the bundle: never put credentials there. Root `.env.example` configures backend/database; the file in `apps/web` configures Vite.

On the backend include the exact frontend origin in `ALLOWED_ORIGINS`; CORS allows cookies only for that list. Sessions retain `SameSite=Strict`: direct access requires both services on the same site (for example, `game.your-domain.com` and `api.your-domain.com`, both HTTPS). Across different sites, use a same-origin frontend `/api` proxy and leave `VITE_BACKEND_URL` empty. Configure `SECURE_COOKIES=true` on HTTPS backends.

## Structure

```text
apps/
  web/                 # React/Vite; lobby, DOM table and transport
  server/              # Hono/Bun; room authority, clocks and transport
packages/
  game-core/           # complete pure base-rule, betting and projection engine
  game-protocol/       # Zod command, snapshot and configuration schemas
  game-sim/            # paired simulations with limited-view policies
tooling/
  architecture/        # cross-area import rules using the Oxc parser
  tests/               # configuration and workspace-graph regressions
tests/e2e/             # smoke test of HTML served from the build
```

On the frontend, `app` contains mounting, `App/` and global styles; each feature groups `components`, `pages` and utilities as needed. `pages` contains only pages/tests; page components/styles belong in feature `components`/`styles` folders. Components use folders with `index.tsx`, tests and nearby styles; exclusive children such as `Lobby/Icon` stay within their parent component. The `app/styles/index.css` manifest preserves cascade order. See the tree/responsibilities in [architecture](docs/architecture.md#frontend-features-and-state-separation).

Each workspace declares its dependencies. `game-core` exposes `./cards`, `./deal`, `./tricks`, `./hands`, `./betting`, `./match` and `./projections` for internal engine composition; private state/physical identities are not transport DTOs. `game-protocol` exposes only public schemas/types through its root entrypoint; frontend never imports core. `game-sim` runs synthetic scenarios using the same core; PixiJS remains planned when needed.

## Backend architecture

The backend is a modular monolith with Clean Architecture. `rooms` coordinates room/match use cases; `sessions` implements guest identity issuance, lookup and changes; `matches` supplies pure timing policies; `transport` contains HTTP controllers, middleware and WebSocket handlers. Card/power rules stay in pure `game-core`.

Within modules, `domain` contains entities/policies, `application/use-cases` operations, `application/ports` contracts and `adapters` integrations. `composition.ts` files assemble dependencies; `bootstrap` starts/stops the process. There is no DI container or per-play persistence.

Room state is separate from its operational envelope. Each room retains one queue: use cases, timers and bots never write independently. The in-memory repository retains live authority without promising restart recovery. See [ADR 010](docs/adr/010-explicit-clean-architecture.md) for dependencies/migration boundaries.

`bun run check:architecture` checks imports, direct runtime calls in inner layers, local server cycles and indirect adapter access through barrels. Use-case and HTTP/WS integration tests verify behavior; the static checker does not replace that evidence.

## Development and test databases

PostgreSQL 18.6 through Docker Compose with separate local instances/credentials for development and tests. Development uses a persistent volume; tests use temporary storage.

```sh
bun run db:up
bun run db:migrate
bun run db:seed
bun run test:database
```

Commands have local defaults and `.env.example` customization. M5 setup adds 11 tables for accounts/sessions, cosmetics, progression, results and jobs without integrating them into the game server. The queue uses a durable table/transactional `NOTIFY` trigger; it needs neither Redis, `pg_partman` nor global PostgreSQL configuration. The second increment provides a transactional consumer with polling, retries and recovery, requiring an explicit processor and never starting automatically in the game. The fourth increment adds an explicitly composed registration/login/session/logout API and durable attempt limits; CLI startup stays guest-only. Frontend sign-in, account-bound gameplay, match-completion persistence and reward rules remain pending. Product seeds stay empty. See models, limits, retention and operations in [docs/database.md](docs/database.md).

Full validation (`bun run check`) now requires Docker/Compose for the real database suite. Stop services when needed using `bun run db:down` and `bun run db:test:down`; the development volume is preserved.

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | Local backend/frontend running with Bun |
| `bun run build` | React client build; backend runs TypeScript with Bun |
| `bun run lint` | Biome, hooks and import boundaries |
| `bun run format:check` | Formatting checks |
| `bun run format` | Format implementation/configuration files |
| `bun run typecheck` | Strict TypeScript per environment/tooling |
| `bun run test` | Tooling unit tests and React/DOM tests in separate processes |
| `bun run test:coverage` | Tests with an 80% minimum and uncovered-source inventory |
| `bun run test:integration` | Real HTTP/WS, authentication, matches and reconnection on an ephemeral port |
| `bun run test:e2e:install` | Install Chromium for Playwright using Bun |
| `bun run test:e2e` | 1v1/2v2 matches, reconnection and rematches in desktop/mobile Chromium |
| `bun run check` | Lint, formatting, types, coverage tests and build |

E2E is separate from `check` and requires browser installation. Mobile tests use Chromium device emulation; this does not establish Safari/iOS compatibility. Test scripts never accept missing tests.

Biome covers supported formats; Markdown/YAML receive no automatic formatting under this configuration. Root `index.html` is excluded to preserve the existing presentation artifact.

## Zed

`.zed/settings.json`, based on `~/www/betzou` setup, enables Biome for JavaScript/JSX, TypeScript/TSX, JSON/JSONC, CSS and HTML with formatting on save. ESLint is disabled; other language servers remain available for types/navigation.

The Biome extension is already installed in this environment. It finds the local version declared in `package.json` and uses root `biome.json`, required by configuration. On another computer, install Zed's Biome extension and run `bun install --frozen-lockfile`.

## Coverage

`bun run test:coverage` requires at least **80% lines/functions per measured file** across unit, DOM and integration tests. It also detects executable sources without reports rather than allowing unimported files to disappear. Text/LCOV reports live in `coverage/{server,web,database}`.

`bun run check` and CI include this requirement. The target is a minimum; every critical scenario remains mandatory. Coverage includes the base-rule engine/projections, tooling and infrastructure. See policy/exclusions in [docs/testing.md](docs/testing.md).

## Test organization

- Import `test`/`expect` from `bun:test`; fast-check is available for properties.
- Domain unit tests live beside behavior in `packages/*/src/**/*.test.ts`. Production types for pure packages exclude Bun/DOM. Their `tsconfig.test.json` includes `types: ["bun"]`, keeping production environments isolated.
- Components may have tests in `apps/web/src/**/*.test.tsx`. The web workspace configures Happy DOM/cleanup; run `bun run test:dom` to load it without contaminating server tests.
- Transport integration lives in `apps/server/tests/integration`. Alongside runtime fixtures, it exercises the product server with independent sessions/WebSockets.
- Playwright uses `*.e2e.ts` to avoid Bun discovery. Playwright starts/stops its own test server.
- `environment.typecheck.ts` files are negative type checks, not application code or runtime tests.

Domain tests exercise complete 1v1/2v2 matches, cards, betting, eleven, scoring and privacy; run `bun test packages/game-core` during this work. PostgreSQL tests exercise persistence infrastructure. Integration now completes server matches with multiple real WebSockets; Playwright completes client matches with isolated browser contexts.

## Documentation

Start with [AGENTS.md](AGENTS.md). Consult [architecture](docs/architecture.md), [rules](docs/rules.md), [security](docs/security.md), [testing](docs/testing.md) and [plan](plan.md) as needed.

## M1 engine

Internal entrypoint `@truco/game-core/match` exposes `startMatch`, `executeCommand` and `dealNextHand`. The trusted application supplies authenticated seat, expected revision, opener and shuffle choices; clients never control authoritative inputs. Each accepted transition returns state/public events without private cards. Rejections leave state unchanged; stale revisions are rejected before any effect.

A completed hand remains in `HAND_END` until the adapter deals another. `MATCH_END` blocks commands/new deals. `projectPublicView`/`projectPlayerView` are the only presentation views; never send internal state. Face-down cards remain hidden to others after hand/match end. Eleven shares cards only within the authorized team; 11×11 retains only each player's hand.

M2 uses these base rules in private rooms with a simple browser table. Powers/sealed preparation arrived in M3; no additional classic preset exists. The application coordinates room queues, sessions, ACKs, timers and reconnection. Matches cannot recover after process crashes.

## M2 local operations

`.env.example` includes `HOST`, `PORT`, `ALLOWED_ORIGINS` (comma-separated without wildcards) and `SECURE_COOKIES`. The server defaults to 127.0.0.1:3001 and allows HTTP origins `127.0.0.1`/`localhost` on ports 5173/4173/3001. Explicit `ALLOWED_ORIGINS` replaces defaults; include the browser address and restart after changes. Use the same address throughout a session: `localhost`/`127.0.0.1` cookies are independent. The cookie is HttpOnly, SameSite=Strict, valid 24 hours and restricted to `/api`; for HTTPS hosting configure `SECURE_COOKIES=true` and exact origins. No deployment/provisioning was performed.

Live state is exclusively in memory: process restart loses sessions/rooms and is a technical failure without an abandonment loss. Reconnection protects only absences during process lifetime, with 60 s cumulative in casual and 30 s competitive. If a partner can respond, team decisions continue. After protection is exhausted, remaining time resumes; untimed card decisions for unprotected absent players receive a fallback instead of blocking rooms.

Empty rooms expire after 60 s casual/30 s competitive. Current limits: 256 rooms, three rooms per session, 64 pending commands per room and 512 recent deduplication responses per room. See transport, resource and idempotency rules in [architecture](docs/architecture.md) and [ADR 006](docs/adr/006-room-authority-and-reconnection.md). Backend logs contain no payloads, cards or tokens.

## Powers and simulation (M3)

Each ordinary hand begins in sealed preparation without automatically opening a panel: powers appear as illustrated cards in a table corner. Click a power, then directly an opponent's back for Espião or your own hand card for Segunda Chance; passing is also available. Target clicks submit intent; cards/energy change once everyone responds or the deadline expires. On your turn, clicking Impulso/Máscara selects the effect; clicking again cancels. Then choose a hand card: power/play are sent together. Eligible cards are highlighted and brief guidance identifies the next click. Esc or another power click cancels selection. After server-confirmed usage, the power card disappears until the next hand; energy/private Espião results remain visible. Details open on click, close by button/Esc and show revealed powers/activations; other seats' unused powers appear as “Poder oculto”, including partners'. Only its user sees the Espião-observed face in the opponent hand; after the target plays it remains preparation memory until that card is publicly revealed or the hand empties, without tracking hidden cards. Mobile details scroll internally. Masked cards differ from face-down cards and reveal identity to others only at trick resolution.

Initial energy is 2, capped at 3, regenerating +1 per ordinary hand after the first. Each player has at most one use per hand. Eleven/deciding hands assign no powers and regenerate no energy. Casual allows preparation adjustment (default 15 s); competitive fixes 10 s. Catalog/costs are in [docs/rules.md](docs/rules.md).

```sh
bun run simulate 30        # 30 scenarios per stratum, with/without powers and swapped seats
bun run simulate 100 1234  # sample size and local synthetic reproducibility seed
```

The tool produces aggregate JSON by format, preset and conservative/aggressive/probabilistic policy with approximate uncertainty and separate assignment/usage counts. It uses neither real sessions nor omniscient bots. See the [initial report](docs/simulation-m3.md), [methodology](docs/balancing.md) and [ADR 007](docs/adr/007-sealed-powers-and-simulation.md). Results prove neither balance nor fun.

“Como jogar” opens a seven-step interactive tutorial covering card order, turn-up/manilha simulator, ties, betting, special hands, four powers and a first-match walkthrough. It includes explained questions, keyboard navigation and complete Portuguese/English catalogs. Language applies throughout the game. In **Configurações → Idioma do jogo**, select Portuguese/English; the preference is saved in this browser. The room menu can change it during a match without restarting the table. The tutorial selector shares the global preference.

## Playing against bots and building test scenarios

`bun run dev` enables the simple training bot/development tools by default. If the backend was already running before this increment, restart to load flags. Click **Jogar** to enter a 1v1 table against **Bot Treino**. Completed matches started with an account grant reduced cosmetic XP (50 completion + 25 victory by default), without ranking points. Using the development hand-reset tools makes that match ineligible for rewards. The bot bases raises/counter-raises and occasional bluffs only on its authorized view.

During a match open **Sala → Ferramentas de desenvolvimento**. Choose three cards, one of four powers and energy from 0 to 3; **Aplicar cenário e reiniciar mão** clears the current hand while preserving score. **Reiniciar mão aleatória** redeals normally. Play continues while the panel is open. Powers stay disabled in eleven/11×11 hands.

Independent backend flags:

- `ENABLE_SOLO=true`: enables bot play, including production if desired.
- `ENABLE_DEV_TOOLS=true`: enables tools **only with `NODE_ENV=development`**, in owner-controlled solo tables. It enables nothing in production/test/missing environments.
- `ENABLE_SOLO=false bun run dev` disables bots; `ENABLE_DEV_TOOLS=false bun run dev` keeps bots without tools.

`bun run start:server` leaves both disabled by default. No VITE configuration or browser parameter grants permission. Production builds exclude the panel even against a development backend. Bots decide with their own cards/public information without reading your hand. Solo rematches start immediately; returning to the menu leaves the room.

`bun run test:e2e:solo` opens isolated servers on ports 3002/5174/4174 and exercises development/production builds on desktop/mobile. Ports must be free. The command produces a test build targeting 3002; afterward run `VITE_BACKEND_URL='' bun run build` for the default build, or use your environment's backend URL.

## Frontend version and build

The menu footer displays `v<version>+<build>`, for example `v0.1.0+1792414800`. Semantic version comes from `apps/web/package.json` and must be incremented when preparing releases. Vite generates the numeric build in Unix seconds (UTC) at compilation/development-server startup; it stays fixed in that artifact and does not change on page reload. It depends on neither browser time nor exposed environment information.

## Optional persistent player backend

The default server continues to support guests. M5 adds optional account authentication/maintenance, server-authoritative cosmetic levels, curated avatar/deck/table catalogs, competitive points/ranking and durable PostgreSQL reward jobs. Enable with `ENABLE_ACCOUNTS=true` only after migrations and a securely configured `PASSWORD_PEPPER`; local startup also requires `NODE_ENV=development` or `test`. See [.env.example](.env.example), [database operation](docs/database.md#persistent-player-backend-and-operation) and [ADR 015](docs/adr/015-persistent-player-backend.md). Remote SQL requires verified TLS; public deployment security remains an environment validation step.

The [player API contract](docs/player-api.md) covers registration/login/session/logout, progression, profile/cosmetic selection, current-password recovery-code issuance, one-time recovery, password change and deletion. Public catalog/ranking reads require no account. Game HTTP/WebSocket handshakes derive identity from account cookies, while guests retain their original flow. No frontend account screens or new theme rendering is included in this backend increment. Live rooms and pre-commit results remain in memory; durable result/job storage begins at commit.

## Player customization (M5)

With `ENABLE_ACCOUNTS=true` and the persistent backend configured, the menu includes optional accounts, global competitive ranking and separate Avatars/Decks/Tables tabs. Guest play remains available. Unlock levels and equipped cosmetics are confirmed by the server. Deck fronts/backs follow each card owner; table style is local to its viewer. See [player API](docs/player-api.md), [asset provenance](apps/web/public/art/cosmetics/README.md) and `bun run test:e2e:player` for the isolated browser flow.

### Production database setup

Set `NODE_ENV=production` and an explicit certificate-verified `DATABASE_URL` ending in `?sslmode=verify-full`, then use `bun run db:migrate` as the Railway pre-deploy command. Pending schema migrations and the initial cosmetic catalog are applied together; no production seed command is needed. Use deployment credentials with migration privileges and separate least-privilege runtime credentials. See [deployment requirements](docs/database.md#production-pre-deploy). Seed and test database tools remain restricted to their local targets.
