# ADR 007 — M3 sealed powers and simulation

Status: implemented. Date: 2026-10-18.

## Decision

Powers are a pure core submodule. `PowerSetup` receives bounded integer samples from the trusted adapter: assignment, team permutation and Espião index use separate samples. The server uses its existing uniform cryptographic generator. Espião's private index is sampled at hand start and applied only after exchanges; final hands contain three cards, so it stays uniform and independent of command arrival. The already-shuffled pile supplies replacements without replacement. No player command requests additional entropy.

During preparation, `PREPARE` seals a valid commitment or pass. Revision advances, but the application accepts other commitments for the same match/decision and still-pending seat without requiring the prior revision. Commitments do not reset deadline or ID. Projections show only readiness, with energy and usage unchanged. When the batch closes, the core removes selected cards, replaces them starting from the opener, resolves Espião and commits spending/usage atomically. Timeout seals passes only for pending seats. Disconnections of players who already responded do not pause preparation.

`PLAY_CARD` carries Impulso/Máscara with the card. Validation precedes removal and spending. Impulso changes comparison while preserving identity and ordinary-card class; Máscara has a cardless representation until a complete trick resolves. Resolved history reveals Máscara, while folding/termination without resolution keeps its value hidden. Espião's private result observes the final hand during preparation; it is not a reused tracking identifier.

After the owner-requested visibility change, snapshots include an allowlist of energy, readiness, usage and public activations. Power assignment stays private to its owner; other seats, including partners, receive `power: null` until an accepted public activation in that hand. Hand/match end and reconnection never reveal unused powers; only the recipient receives their Espião result. Commitments, samples, discards and draw piles never enter the protocol. Complete snapshots place activations before play representations without depending on animation or browser ACKs.

`game-sim` runs the same core and delivers only `PlayerView` to its three policies. Shuffling, assignment and decisions use independent reproducible sources; each hand has its own dealing stream to preserve paired comparisons despite divergent trajectories. Each scenario runs with/without powers and swaps seats/teams. Results aggregate uncertainty by pair and distinguish assignment from selective usage. This is neither a production bot nor proof of balance.

## Compatibility and limits

The internal core API without `PowerSetup` remains available for base-rule regressions and simulation control arms. This is not a product mode: all server rooms start with powers in both presets. Enabled matches require a fresh setup for each ordinary hand; special hands request no assignment and regenerate no energy.

Casual configuration adds preparation from 1–120 seconds, defaulting to 15; competitive normalizes to 10. Older inputs missing the field receive the schema default. The UI offers playtest values of 10/15/30 seconds. No cost, cap, catalog or gameplay rule was changed.

State, commitments and private traces remain only in memory under the same room queue. Restart is unrecoverable and records no loss. This milestone introduces no persistence, deployment or external analytics. Synthetic simulation data contains no player sessions; real server seeds are neither exported nor reused.
