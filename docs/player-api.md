# Player backend API

Accounts are optional (`ENABLE_ACCOUNTS=true`); guests retain `/api/guest` and existing room routes. Configure migrations, curated seeds, pepper and deployment requirements first: [database](database.md#persistent-player-backend-and-operation), [ADR 015](adr/015-persistent-player-backend.md).

Mutating requests require an exact allowed `Origin` and at most 8 KiB. Endpoints with JSON bodies require `Content-Type: application/json` and strictly validated fields; logout needs no body. Cookies are HttpOnly/SameSite=Strict and use `/api`; production requires Secure. Account responses use `Cache-Control: no-store`. Credentials never appear in URLs or public projections. Use same-site frontend/API hosting or the existing same-origin `/api` proxy.

## Account endpoints

All paths below start with `/api/accounts`. An account cookie authenticates the current account; callers never supply an account ID.

| Method/path | Body | Successful response |
|---|---|---|
| `POST /register` | `{login, password, nickname}` | 201 `{nickname}` and a session cookie |
| `POST /login` | `{login, password}` | 200 `{nickname}` and a rotated session cookie |
| `GET /session` | None | 200 `{nickname}` |
| `POST /logout` | None required | 204, revokes the presented token and clears cookies |
| `GET /progression` | None; no query parameters | Current progress/appearance |
| `POST /profile` | `{nickname}` | Updated progress/appearance |
| `POST /cosmetics` | `{avatarId, deckThemeId, tableThemeId}` | Updated progress/appearance |
| `POST /recovery-code` | `{password}` | `{recoveryCode}` once; replaces the previous code |
| `POST /recover` | `{login, recoveryCode, newPassword}` | `{recoveryCode}` once; no session cookie is issued |
| `POST /password` | `{currentPassword, newPassword}` | `{}`, revokes all sessions and clears cookies |
| `POST /delete` | `{password}` | `{}`, deletes the authenticated account and clears cookies |

Registration/login/recovery do not require an existing session. Other endpoints require the authenticated account, except logout which is safe without one. Login names use 3–32 lowercase ASCII letters/digits/underscores. Nicknames are trimmed, 1–24 characters, with letters/digits/spaces/underscore/dot/hyphen. Passwords use 6–128 Unicode code points, without trimming, normalization or truncation. New passwords also pass the configured offline blocklist. SQL keywords are not a password blacklist: parameter binding protects SQL while preserving the exact secret.

Password changes invalidate recovery codes. Recovery codes are random 256-bit lowercase hex strings, are replaced atomically on successful recovery and must be saved by the player. Concurrent reuse permits one success. If both the password and code are lost, there is no email or support bypass. Keep recovery responses out of logs/analytics. Reauthentication and recovery share the account/IP/global attempt budgets and process-wide password concurrency limit.

Cosmetic selection requires all three fields; `null` selects the default. IDs must come from the corresponding catalog. A client-supplied level, XP, points, URL or additional property is rejected. Availability and required level are checked against locked database progress. Selection has no effect on powers, card identity or advantage. A match retains the appearance captured at start; the next lobby/match reflects updates.

Example progress response (all accumulated numeric values are decimal strings):

```json
{
  "nickname": "Player",
  "xp": "500",
  "competitivePoints": "10",
  "level": "2",
  "appearance": {
    "avatar": {"id": "avatar-2", "avatarUrl": "/art/avatars-pixel.png", "spriteIndex": 1},
    "deck": {"id": "ember", "assetKey": "ember"},
    "table": {"id": "classic", "assetKey": "classic"}
  }
}
```

## Public reads and game integration

`GET /api/catalog` returns independent `avatars`, `decks` and `tables` arrays. Each item includes its ID, game-facing name, required level and trusted presentation metadata. Deck manifests specify back/rank/suit style tokens for frontend rendering; no arbitrary CSS or uploads are accepted. Unknown query fields are rejected.

`GET /api/ranking?page=1` returns `{entries, nextPage}`. Entries contain `rank`, `nickname`, decimal-string `competitivePoints` and an avatar. Pages contain at most 50 entries, with page range 1–1,000. Zero-point and disabled accounts are excluded. Ranking orders points descending, then uses an internal stable account-ID tie break. Account IDs, logins and session information are omitted. Unknown/invalid query fields are rejected.

Existing room HTTP/WebSocket routes authenticate account cookies directly and derive the stable private seat identity on the server. Invalid account cookies do not fall back to a guest. Snapshots expose each occupied seat's curated avatar/deck and the viewer's own table theme, without account IDs or hidden card information. Guests remain eligible to play but do not accumulate account rewards retroactively. The server alone creates result summaries; no player-facing grant/result submission endpoint exists.

`GET /health` reports process liveness. `GET /ready` reports cached persistent-backend availability (200 or 503), without querying SQL for each probe. Neither endpoint exposes secrets or certifies hosting/TLS configuration.

## Failures and durability

Authentication uses fixed codes such as `INVALID_ACCOUNT_INPUT`/`INVALID_PASSWORD` (400), `INVALID_CREDENTIALS`/`UNAUTHENTICATED` (401), `AUTH_RATE_LIMITED` (429) and `AUTH_UNAVAILABLE` (503). Missing/disabled/wrong-password login shares `INVALID_CREDENTIALS`; registration may reveal username availability. Player routes use `INVALID_PAGE`, `INVALID_SELECTION`, `INVALID_NICKNAME`, `COSMETIC_LOCKED` or `COSMETIC_UNAVAILABLE` (400), and `SERVICE_UNAVAILABLE` (503). Invalid JSON/content types on player routes use `INVALID_MESSAGE` (400). Common transport errors include forbidden origin (403), excessive body size (413) and request limits (429). Raw database/library exceptions are never returned.

A saturated result buffer rejects `START_MATCH` with `PERSISTENCE_UNAVAILABLE` before drawing cards. Rewards are asynchronous after result/job commit; the client can read progression again. Local credential revocation closes affected sockets immediately; external revocation/storage failure has the configured 1–10 second lease bound. Live rooms and pre-commit result summaries remain process-local. See ADR 015 for retention, crash behavior and the provisional completion-only interpretation for interrupted matches.

## Browser integration

The browser discovers the optional backend through `/api/features.accounts`. Without the complete account backend, the guest experience stays available and account controls stay hidden. With it enabled, personalization opens from the menu, while account management and the public ranking open independently from the profile. Personalization has independent Avatars, Decks and Tables tabs, keyboard navigation, locked-item previews and server-confirmed equipment. XP per level comes from the catalog; decimal strings are displayed with `BigInt` rather than lossy JavaScript arithmetic.

Credentials are submitted through the existing credentialed transport. The browser never reads or stores the account cookie, password or recovery code in local/session storage. Recovery codes remain in component memory, with explicit copy and reauthentication for rotation. Nickname is the existing local preference. Logout accepts a real 204 response. Mutations are serialized and stale profile reads cannot restore an account after logout. Focus and bounded post-match retries refresh progression after asynchronous rewards.

Every seat renders its authorized avatar and deck on concealed/revealed cards and private authorized observations. Concealed markup carries no rank or suit. The shared vira keeps the default design; the root table theme affects only its viewer. Themes change presentation, never the engine or available powers. Existing avatar art is preserved. Independent generated back/material assets and their exact prompts are documented in `apps/web/public/art/cosmetics/README.md`.

Account authentication opens contextually when a guest attempts to equip a cosmetic. The collection stays mounted, preserving the selected tab and preview on cancellation or successful authentication; equipment still requires an explicit, server-validated confirmation. Account management and the public ranking are independent profile actions. The collection contains only Avatars, Decks and Tables tabs.

## Personal match rewards

`GET /api/accounts/matches/:matchId/rewards` requires the current account cookie and accepts no query parameters. Match IDs use the bounded authoritative identifier format; an account identifier cannot be supplied. Responses are `{ status: 'pending' }`, `{ status: 'none' }` or `{ status: 'granted', xp, competitivePoints }`, with integer amounts encoded as decimal strings. Granted values come from committed reward rows, never a client estimate or a later policy configuration. Unknown/non-owned matches return the same pending response, preventing match/participant enumeration while allowing outbox delivery to finish. A completed job without a grant returns none. Existing account middleware marks these responses no-store.

Finished room snapshots include only the viewer's reward eligibility (`eligible`, `guest` or `development`) when persistence is enabled. They contain no account IDs or other participants' reward details. Eligibility comes from identities frozen at match start; successful development edits remove eligibility. The result screen explains interrupted/noneligible results and polls eligible completed matches at most six times, 1.5 seconds apart. Delayed processing or failures retain an explicit manual refresh; no amount is labeled as received before confirmation.
