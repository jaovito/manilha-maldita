# ADR 009 — Solo training and development tools

Status: accepted by explicit user request on 2026-10-19. Extends the previous deferral of production bots to a simple training bot. The 26/10/2026 follow-up authorizes reduced cosmetic XP, never ranking points.

## Decision

“Jogar” creates a private solo room in the selected format (1v1 by default or 2v2) and starts automatically when the owner connects. Bots occupy all remaining seats; third parties cannot join. It reuses game-sim's `chooseAction` through the public package entrypoint, using the training policy and exclusively its own seat's `projectPlayerView`. It reads no opponents' hands, draw pile, seeds or secret state to decide. All commands still use the engine and single room queue. Presentation pauses remain; the bot thinks for 1 s per decision. Without a connected human, the bot does not act and the room expires normally. Solo rematches start another match; returning to the menu leaves the room. Multiplayer retains the existing lobby flow.

`ENABLE_SOLO=true` enables creation independently of environment. Server default: disabled. `/api/features` communicates only public availability. The application checks the flag too, not just the button.

`ENABLE_DEV_TOOLS=true` requires **NODE_ENV exactly development**, a solo room and the owner's seat. Production, test or missing environments never enable these mutations, even with the flag on. The frontend additionally requires `import.meta.env.DEV`; the panel is conditionally imported and omitted from production builds. Hiding UI does not replace server validation.

`DEV_RESET_HAND` accepts three optional distinct cards, a power and energy (0–3). It uses the same context/revision envelope, authentication, message limits and idempotency cache as other commands. Rejections precede entropy consumption. The application starts a new hand without scoring, clears commitments/intel/plays, increments revision and replaces timer context. Selected cards are swapped into the new deal, including turn-up/pile/bot hand, conserving all 40 identities. This operation is unavailable to multiplayer matches. Eleven/11×11 preserve their rules and cannot force powers.

“Aplicar cenário e reiniciar mão” makes clear that editing a scenario restarts the complete hand while preserving score. It never modifies a partially resolved trick. “Reiniciar mão aleatória” redeals without forcing cards/power. The game continues while the panel is open, as stated in the UI. Future tools such as pausing simulation, editing opponents or choosing the turn-up card require new validated commands rather than direct state access.

## Verification

Tests cover complete bot matches, rematches, expiry without humans, projections, deck conservation, duplicate rejection, stale contexts, idempotency and independent flags. Real HTTP/WS integration proves production and test reject development mutations. `test:e2e:solo` separates Vite development and production builds across desktop/mobile profiles. No deployment is part of this increment.

## Follow-up — reduced progression and wager decisions (26/10/2026)

The training policy evaluates its two strongest remaining cards, public trick wins and exposed opposing plays. Strong hands raise with an 80% decision probability; weak hands may bluff at 4% below six and 1% above it. Higher stakes require higher confidence. It can initiate and counter through 3/6/9/12, preserving engine turn, team rights, special-hand restrictions and the ceiling. These probabilities are initial playtest hypotheses, not measured difficulty. Existing simulation policies remain unchanged.

Completed solo matches may grant reduced account XP under the versioned M5 policy (default 50% of total XP), without ranked points. Guests, interrupted matches and matches manipulated with development hand-reset tools receive no rewards. Enabling development tools alone does not remove eligibility.

## Follow-up — optional 2v2 training (2026-11-02)

Authorized by the owner and tracked in [#28](https://github.com/jaovito/manilha-maldita/issues/28), under M7. Following owner feedback on 2026-11-02, Play opens a native modal asking for 1v1 or 2v2. Each option explains its human/bot composition and immediately starts the selected format. No guest session or room is created merely by opening or dismissing the modal. Initial focus selects the 1v1 control; Escape, backdrop and Back dismiss without starting, restoring Play focus. The native modal blocks the menu; explicit Tab/Shift+Tab wrapping keeps focus on its controls. The full-width Play button retains the existing menu composition. Solo creation validates the requested configuration without overriding its format. The human remains at seat 0; seat 2 is their bot partner and seats 1/3 are bot opponents, with distinct display names. Both presets use the existing engine and training policy without balance changes.

The existing room scheduler advances one pending bot decision at a time with its own seat projection and a one-second thinking interval. Team responses use the existing first-valid-response rule, including the human's bot partner. Preparation, private powers, special-hand visibility, disconnection protection and empty-room expiry retain their authoritative contracts. Rematches retain the chosen format. All bot participants have no account identity; reduced solo XP and zero ranking points remain unchanged.


## Follow-up — multiplayer bot fill (2026-11-06)

The owner authorized host-controlled lobby fill/removal in [#29](https://github.com/jaovito/manilha-maldita/issues/29). `ENABLE_SOLO` remains the existing bot availability gate for both entry points. Mixed rooms preserve the multiplayer lobby, invitations, readiness and rematch flow; they do not become private solo rooms or gain development tools. Vacancy fill never replaces a human. Join may replace a bot only before the match; all bots share the existing authority/projection-only scheduler and have no account identity.

When asked, the owner explicitly chose normal multiplayer rewards for mixed rooms, including normal competitive victory points, rather than the reduced solo policy. The room/result solo flag remains false; existing eligibility, grant idempotency and bot null-account handling remain authoritative. Multiplayer fill and start require two human seats so a single human seat cannot use a lobby to bypass the solo reward policy. This is a seat-count check, not a defense against multiple-session farming or collusion.
