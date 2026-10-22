# ADR 009 — Solo training and development tools

Status: accepted by explicit user request on 2026-10-19. Extends the previous deferral of production bots only to a simple training bot without ranking or progression.

## Decision

“Jogar” creates a private solo 1v1 room and starts automatically when the owner connects. A bot occupies the other seat; third parties cannot join. It reuses game-sim's `chooseAction` through the public package entrypoint, using the conservative policy and exclusively its own seat's `projectPlayerView`. It reads no opponents' hands, draw pile, seeds or secret state to decide. All commands still use the engine and single room queue. Presentation pauses remain; the bot thinks for 1 s per decision. Without a connected human, the bot does not act and the room expires normally. Solo rematches start another match; returning to the menu leaves the room. Multiplayer retains the existing lobby flow.

`ENABLE_SOLO=true` enables creation independently of environment. Server default: disabled. `/api/features` communicates only public availability. The application checks the flag too, not just the button.

`ENABLE_DEV_TOOLS=true` requires **NODE_ENV exactly development**, a solo room and the owner's seat. Production, test or missing environments never enable these mutations, even with the flag on. The frontend additionally requires `import.meta.env.DEV`; the panel is conditionally imported and omitted from production builds. Hiding UI does not replace server validation.

`DEV_RESET_HAND` accepts three optional distinct cards, a power and energy (0–3). It uses the same context/revision envelope, authentication, message limits and idempotency cache as other commands. Rejections precede entropy consumption. The application starts a new hand without scoring, clears commitments/intel/plays, increments revision and replaces timer context. Selected cards are swapped into the new deal, including turn-up/pile/bot hand, conserving all 40 identities. This operation is unavailable to multiplayer matches. Eleven/11×11 preserve their rules and cannot force powers.

“Aplicar cenário e reiniciar mão” makes clear that editing a scenario restarts the complete hand while preserving score. It never modifies a partially resolved trick. “Reiniciar mão aleatória” redeals without forcing cards/power. The game continues while the panel is open, as stated in the UI. Future tools such as pausing simulation, editing opponents or choosing the turn-up card require new validated commands rather than direct state access.

## Verification

Tests cover complete bot matches, rematches, expiry without humans, projections, deck conservation, duplicate rejection, stale contexts, idempotency and independent flags. Real HTTP/WS integration proves production and test reject development mutations. `test:e2e:solo` separates Vite development and production builds across desktop/mobile profiles. No deployment is part of this increment.
