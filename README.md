# Manilha Maldita

## Requirements

- Bun **1.4.3**, pinned in `.bun-version`.
- Git.
- Docker with Compose v2 for optional accounts and database/integration/coverage tests.

## Install

```sh
git clone https://github.com/jaovito/manilha-maldita.git
cd manilha-maldita
bun install --frozen-lockfile
```

For a new checkout, copy the local configuration. Preserve an existing `.env`:

```sh
cp .env.example .env
```

## Run locally

```sh
bun run dev
```

- Game: <http://127.0.0.1:5173>
- Backend health: <http://127.0.0.1:3001/health>

Use the same hostname throughout a session: `localhost` and `127.0.0.1` have separate cookies. Guest and bot play do not require PostgreSQL. Development enables solo play and local hand-editing tools by default.

To disable either development feature:

```sh
ENABLE_SOLO=false bun run dev
ENABLE_DEV_TOOLS=false bun run dev
```

## Enable local accounts

Keep `DATABASE_URL` consistent with the local Compose credentials and port in `.env`:

```sh
bun run db:up
bun run db:migrate
openssl rand -hex 32
```

Save the generated value as `PASSWORD_PEPPER` in `.env`, set `ENABLE_ACCOUNTS=true`, and restart `bun run dev`. Keep the pepper stable across restarts. Migrations also create the initial avatar, deck and table catalogs; no seed command is required.

```sh
bun run db:down
```

This stops the development database while preserving its volume. See [database setup](docs/database.md) for connection settings and troubleshooting.

## Build and preview the frontend

For a frontend served through the same origin as the API:

```sh
VITE_BACKEND_URL='' bun run build
bun run --filter @truco/web preview
```

Preview runs at <http://127.0.0.1:4173> and proxies `/api` to the backend on port 3001. Start the backend separately. For a separately hosted API, set its public origin **before building**, without `/api` or a path suffix:

```sh
VITE_BACKEND_URL=https://api.example.com bun run build
```

The deployable frontend is in `apps/web/dist`. Never put secrets in `VITE_` variables.

## Run the backend in production

```sh
NODE_ENV=production HOST=0.0.0.0 bun run start:server
```

Configure the port, exact HTTPS `ALLOWED_ORIGINS` and `SECURE_COOKIES=true` in the host environment. Configure HTTPS/WSS at the hosting layer. Solo play is opt-in with `ENABLE_SOLO=true`; development tools stay disabled in production.

For accounts, also configure `ENABLE_ACCOUNTS=true`, a stable secret `PASSWORD_PEPPER`, and an explicit `DATABASE_URL` with `sslmode=verify-full` and a trusted certificate. Use migration credentials for pre-deploy and least-privilege credentials for runtime. Run from the repository root:

```sh
bun run db:migrate
```

Use that command as the Railway pre-deploy command. Do not run `db:seed` in production. See [.env.example](.env.example) and [production database setup](docs/database.md#production-pre-deploy) for the full configuration.

## Run checks and tests

```sh
bun run test:unit
bun run test:dom
bun run test:integration
bun run check
```

Integration and coverage checks require Docker/Compose. `check` includes lint, architecture boundaries, formatting, types, database-backed coverage and the frontend build.

Install Chromium, then run each standard browser project with fresh test servers:

```sh
bun run test:e2e:install
bun run test:e2e --project=chromium
bun run test:e2e --project=mobile-chromium
```

Ports 3001 and 4173 must be free; stop development servers before these commands. Additional browser suites:

```sh
bun run test:e2e:player
bun run test:e2e:solo
bun run test:e2e --config=playwright.i18n.config.ts
```

Run database-backed browser suites separately from coverage/database tests. See [test execution](docs/testing.md) for prerequisites and focused commands.
