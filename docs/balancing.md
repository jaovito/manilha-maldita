# Balancing and simulation

Read before building simulations, interpreting balance metrics or proposing adjustments. The current contract is in [rules.md](rules.md); hypotheses do not authorize automatic product changes.

## Balancing and simulation

Simulate with the same core and bots that see only their own projection. Use conservative, aggressive and probabilistic policies, without treating them as production bots.

Compare paired scenarios with identical initial deals, separate randomness sources and swapped seats/teams. Allow policies to react to new observations; do not force illegal baseline actions after a power.

Record version, policy, sample size, uncertainty and private seeds. Distinguish the effect of an assigned power from association with selective use. A global 50% win rate under mirrored assignment does not prove balance.

Hypotheses: investigate opening-player bias above 2 percentage points or marginal effects above 5 in comparable scenarios, without automatic adjustments. Separate 1v1/2v2, mode, position and experience.

Human playtests assess bluffing, cooperation, clarity, frustration, unusable powers and desire for a rematch. Simulation cannot validate fun. Do not add extra powers to fix low utilization before measuring it.

## Initial M3 tool

Run `bun run simulate <scenarios-per-stratum> [synthetic-seed]`. `game-sim` compares both formats and presets under conservative, aggressive and probabilistic policies. Each scenario has arms with/without powers and seat/team permutations; independent streams per hand preserve identical card deals across arms even when decision counts differ. Policies may react to exchanges, public plays and Espião information through their own projection.

JSON includes version, sample size, mean hands/decisions, opening-player wins, paired differences and approximate normal confidence intervals per scenario, plus assigned/used power counts. Usage counts do not identify individual causal effects. The tool does not estimate duration in minutes, individual marginal power effects or fun. Synthetic seeds are local reproducibility parameters, separate from real-match seeds/entropy and omitted from aggregate reports. See [the initial run](simulation-m3.md).
