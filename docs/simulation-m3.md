# Initial M3 simulation

Local run: `bun run simulate 30`. Rules version: `m3-v1`. Samples/policies are synthetic without player data. Each row contains 30 independent scenarios, two seat/team arrangements and arms with/without powers: 120 matches per row, 1,440 matches total.

Shuffling/powers use independent per-hand streams; decisions use another stream. Comparison preserves dealing for the same hand number across arms. Duration is counted in decisions rather than minutes. Policies receive only their own projection and may react to exchanges, public cards and Espião information.

| Format | Preset | Policy | Mean hands | Mean decisions | Opening-player wins | Paired difference with powers (approx. 95% CI) |
|---|---|---|---:|---:|---:|---|
| 1v1 | casual | conservative | 20.3 | 163.3 | 53.3% | +16.7 pp [-2.3; +35.7] |
| 1v1 | casual | aggressive | 1.3 | 14.1 | 40.0% | +0.0 pp [-9.4; +9.4] |
| 1v1 | casual | probabilistic | 3.0 | 29.8 | 53.3% | +20.0 pp [+2.7; +37.3] |
| 1v1 | competitive | conservative | 20.0 | 159.3 | 40.0% | +3.3 pp [-8.1; +14.8] |
| 1v1 | competitive | aggressive | 1.4 | 14.7 | 40.0% | +0.0 pp [+0.0; +0.0] |
| 1v1 | competitive | probabilistic | 3.1 | 30.0 | 56.7% | +23.3 pp [+5.3; +41.4] |
| 2v2 | casual | conservative | 19.9 | 290.0 | 40.0% | -8.3 pp [-26.0; +9.3] |
| 2v2 | casual | aggressive | 1.2 | 20.0 | 53.3% | +0.0 pp [+0.0; +0.0] |
| 2v2 | casual | probabilistic | 1.9 | 30.5 | 38.3% | -3.3 pp [-21.5; +14.8] |
| 2v2 | competitive | conservative | 20.1 | 290.4 | 46.7% | -1.7 pp [-18.3; +14.9] |
| 2v2 | competitive | aggressive | 1.1 | 19.1 | 50.0% | -3.3 pp [-12.7; +6.0] |
| 2v2 | competitive | probabilistic | 2.0 | 31.4 | 43.3% | +1.7 pp [-14.9; +18.3] |

The approximate normal interval uses each paired scenario as its unit, without treating both permutations as independent samples. This is a small exploratory check: wide or degenerate intervals do not demonstrate absence of an effect. A 50% rate proves neither positional symmetry nor individual power balance.

Tool JSON includes separate assigned/used power counts per stratum. Usage is policy selection, not an individual power causal estimate. The paired difference estimates the effect of the enabled set on opening-player wins under these policies. Individual marginal power effects were not estimated. Results triggered no automatic change to costs, assignment or rules.

Human playtests, bluffing, cooperation, clarity, frustration, duration in minutes and rematch intentions remain in M4. Synthetic seeds are local reproducibility inputs; the public report contains no private state or real-match seeds.
