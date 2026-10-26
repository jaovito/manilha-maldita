# Implementable rules for Truco Caótico

Normative source for MVP game behavior. Read before changing rules, powers, scoring, turns, timers, or reconnection. The product vision is in [GDD.md](../GDD.md); future intentions described there do not expand this contract. Costs and timings remain subject to playtests, without silent adjustments.

## Base rules: implementation contract

Terminology: a **match** ends at 12 points; a **hand** deals three cards; a **trick** receives one card from each participant.

### Deck, seats, and comparison

40 cards, four suits, ranks in ascending normal strength: `4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3`. Shuffle every hand; deal three cards per player and one vira, without replacement.

The manilha is the vira's successor in this cycle, including `3 -> 4`. Every manilha beats every normal card; among manilhas: `diamonds < spades < hearts < clubs`. Suits do not break ties between normal cards. Physical identity and effective strength are distinct.

Clockwise seats: A0/B0 in 1v1; A0/B0/A1/B1 in 2v2. Randomly choose the match's starting player and advance one seat per new hand, including after a voided hand. Every player plays one card per trick; partners do not add strengths together.

The greatest strength determines the result: maxima on both teams produce a tie; maxima on only one team make that team win. The player who played the winning card starts the next trick; for equal maxima among partners, the first to play it starts. A tie between teams preserves the tied trick's starting player.

### Completion and ties

End the hand as soon as its result is determined, in both formats. The table is symmetric for A/B:

| Trick results | Hand winner |
|---|---|
| A, A | A, immediately |
| A, tie | A, immediately |
| tie, A | A, immediately |
| A, B, A | A |
| A, B, B | B |
| A, B, tie | A, winner of the first |
| tie, tie, A | A |
| tie, tie, tie | Voided, zero points |

Three ties awarding no points are a product convention, not a universal Truco rule.

### Face-down cards

Allowed from the second trick onward. They consume a card and lose to any face-up card or revealed masked card; all face-down cards produce a tie. Do not reveal their identity to others. Do not combine a face-down play with a card power.

### Stakes

Scale: `1 -> 3 -> 6 -> 9 -> 12`. Only the current player initiates a request before playing. Pending negotiation blocks cards/powers.

Keep `acceptedStake`, `pendingStake`, `lastRaisingTeam`, and `resumeTurnSeat` separate:

- Accepting confirms the proposed value and resumes the saved turn.
- Folding awards the requester the already accepted value, not the pending one.
- Counter-raising **implicitly accepts the previous proposal**, proposes the next level, and transfers the response.
- Do not skip levels or raise your own proposal. After acceptance, only the other team may initiate another raise, during an allowed turn.
- In 2v2, either challenged partner may respond; the first valid serialized response is final. Responding does not change the turn.
- At 12, only accept/fold. Folding outside a pending stake or eleven-point decision does not exist in the MVP; match resignation is separate.

Regressions: A requests 3, B proposes 6, A folds: **B gains 3**. With 6 accepted and 9 pending, folding awards 6.

Score exactly once, cap the score at 12, and record the original reward in the event. At 12, end without dealing again. Abandonment/technical failure use their own reasons.

### Eleven points and the deciding hand

Only one team at 11: it sees cards/vira and chooses to play for 3 or fold, conceding 1. In 2v2, it sees partner cards during the decision; revealed information cannot be treated as forgotten. The team's first valid response prevails.

At 11×11: **a deciding hand visible to each card's owner**. Everyone sees only their own cards, not their partner's. It is worth 3, without a fold decision or face-down cards. Do not implement blind play because of an association with the name “mão de ferro”. Three ties repeat the hand with the starting player rotated.

Both special hands prohibit raises, powers, and future events; they do not draw powers or change energy, including regeneration. These conventions override ordinary effects.

## Power assignment and lifecycle

### Draws and energy

For each ordinary hand: deal cards, reveal the vira, regenerate energy when applicable, draw powers, and deliver each power only to its owner; energy remains public. The power expires at the end of the hand; it cannot be saved or traded.

- Individual energy: initial 2, maximum 3, regeneration +1 per new eligible hand, except the match's first.
- One successful activation per player/hand, including in 2v2; this is not a team limit.
- Casual: one uniform, independent power per player; duplicates allowed.
- Competitive 1v1: one uniform power, identical for both.
- Competitive 2v2: two distinct powers drawn uniformly; one copy of each per team, randomly assigned to partners.
- Both presets use the same four powers in the MVP. Do not add experiments just to differentiate them.
- Do not adapt draws to accounts, scores, cards, energy, or history. Insufficient energy disables activation, without a compensating reroll.
- The assigned power is private to its owner, including with respect to their partner. Other players and the public projection receive its identity only after an accepted activation.
- Energy, readiness, resolved activation, and target are public; information results and exchanges respect privacy. Readiness does not reveal sealed intent.
- Espião/Segunda Chance reveal their power only when the preparation batch closes; Impulso/Máscara do so alongside the accepted play. Revealing Máscara does not reveal card identity before resolution.
- Rejection, passing, expiry, hand/match completion, and reconnection do not reveal unused powers. Every new hand hides its new assignments again.

The mirrored competitive policy still allows powers to be inferred from one's own assignment; hiding the snapshot does not eliminate this inference. Replacing it with independent draws is pending an owner decision. Mirroring provides symmetric access, not guaranteed positional balance. Do not eliminate the randomness chosen by the owner.

### Sealed preparation and resolution order

Before the first trick, each player sends one final intent: a preparation power with valid parameters or a pass. Turn powers remain available after passing. Timeout passes. The public ready indicator does not distinguish passing from activation.

Do not publish choices, costs, targets, or results until everyone responds or the deadline expires. Validate energy, use, and target when accepting each intent. Resolve the batch atomically:

1. Remove all cards selected for Segunda Chance.
2. Deal replacements without replacement, in seat order from the starting player.
3. Resolve Espião against the **already updated** hands.
4. Apply costs/uses, publish activations, and send private results to their recipients.
5. Open the first turn.

Discards do not return to the deck during the hand. Do not interleave plays or allow intent to be revised after observing others. Resolution is independent of packet arrival order.

### MVP catalog

| Power | Cost | Window | Contract |
|---|---:|---|---|
| Espião | 1 | Preparation | Choose an opponent and discover one uniformly selected card from their final hand. |
| Segunda Chance | 2 | Preparation | Discard one selected card of your own and draw from the remaining deck. |
| Impulso | 2 | Your play | A normal card gains one normal strength level for this trick, capped at 3. |
| Máscara | 1 | Your play | Card hidden from everyone except its owner until resolution; contests at full strength. |

**Espião:** sends the result only to its user, not automatically to their partner. It does not allow choosing a card's physical identity, change hands, or reveal the deck. In the interface, clicking an anonymous card back selects the opponent; the random observation appears on that back after resolution. After another face-up card is played, the observed face continues to occupy one remaining slot, never an extra slot. If the target has a play that is still opaque, the observation becomes a textual memory note outside the slots, because it cannot be confirmed to remain in hand. This memory does not track cards still in hand or hidden plays. When a visible play by that target, current or in a completed trick, reveals the same rank and suit, the observation leaves the seat; it also disappears when the hand count reaches zero. A face-down card or still-hidden Máscara does not reveal whether the observed card has left. Two spies may discover the same card, without compensation.

**Segunda Chance:** cannot draw the vira, dealt cards, or discarded cards, including the returned card. Discard/replacement are private; the hand still contains three cards.

**Impulso:** reject manilhas, face-down cards, and normal 3s without spending energy. Gaining the normal strength level of a rank that coincides with the manilha does not create a manilha: the class remains normal. Do not change physical identity.

**Máscara:** accepts normal cards/manilhas, never face-down cards. Show an unambiguous marker; do not send the real value early merely to hide it with CSS. If a fold ends the hand before reveal, the card remains hidden from others during the match. Hand completion does not automatically reveal remaining hands/discards.

Impulso/Máscara accompany `PLAY_CARD` atomically. The UI selects the power before the card; the server validates both together and publishes the effect before the play representation. Do not create orphan buffs or allow an interleaved stake request. Rejection consumes no card, energy, use, or randomness.

### Limits and expansions

No nested reactions, counterspells, retroactive changes, or infinite chains. A power cannot create/copy a manilha, beat a manilha with normal strength, force acceptance of Truco, change points, or undo a trick.

Do not implement now: Pressão, Reflexo, Tudo ou Nada, Aposta Arriscada, Escudo, Conexão, or events. Draft scoring powers were redundant proposals, not approved features. Expansions require target, window, cost, duration, visibility, order, interactions, failures, and tests. Balance configuration is versioned and frozen per match.

## Time, reconnection, and abnormal completion

Playtest defaults; casual configures them before the match, competitive uses a fixed preset:

| Decision | Casual | Competitive |
|---|---:|---:|
| Preparation | 15 s | 10 s |
| Card | 30 s | 20 s |
| Stake/eleven points | 20 s | 15 s |
| Cumulative reconnection protection per seat/match | 60 s | 30 s |

The server controls deadlines; timers identify match/phase/decision and ignore stale context. A command received at or after the deadline has expired. The UI only estimates remaining time.

Timeout: preparation passes; stake/eleven points folds; card decisions play the weakest effective card face-up, without a power, breaking ties by deterministic internal identity. Fallback does not depend on others' hidden cards.

Reconnection preserves the seat. Protected pauses consume a cumulative budget without refill, only when a decision depends on the absent player. A connected partner can still answer team decisions. Resume remaining time, not the full duration; simultaneous pauses do not add up artificially.

After protection, apply fallbacks. Three consecutive required decisions by the same player timing out cause abandonment; their valid action resets the sequence. In 2v2, abandonment defeats the team. If both teams are entirely absent, expire without a winner and without unlimited automatic plays.

Casual may disable the card clock, not expiration of empty/disconnected rooms. Distinguish resignation, abandonment, and technical failure. A process crash with state in memory is a technical failure, not a defeat: document that the MVP does not recover matches after restart without implemented persistence.

## Solo training and development scenarios

As authorized on 19/10/2026, “Jogar” may start 1v1 training against a simple bot, without changing rules, powers, or scoring. The bot uses only information authorized for its seat. Creation depends on an independent flag. Solo rematch is immediate; it does not require confirmation from a second human.

Only in development and on the owner's solo table, a tooling command restarts the hand with selected cards/power/energy. It preserves score, card uniqueness, and eleven-point/11×11 restrictions. This is a test tool, unavailable in multiplayer matches and production. See [ADR 009](adr/009-solo-training-and-development-tools.md).

## M5 account progression extension

The owner approved optional persistent accounts, cosmetic unlocks and a global accumulated-points ranking for M5. This extends the original guest MVP scope; it does not change cards, powers, energy, winners or competitive gameplay rules. All powers remain available from the first match and progression grants no gameplay advantage.

Initial policy: a completed non-training match grants 100 XP to each eligible account and 50 additional XP to winners; a competitive win also grants 10 ranking points. Casual grants no ranking points. As authorized on 26/10/2026, completed solo matches grant 50% of the same total XP (50 XP for completion, plus 25 XP for a win by default), rounded down using integer arithmetic, without ranking points in any preset. Abandonment grants no rewards. Using a development hand-reset tool removes all account reward eligibility for that match; a fresh rematch captures eligibility again. The conservative completion-only interpretation also excludes surrender, expiry and technical endings; this provisional classification is documented in ADR 015. Only active accounts captured at match start are eligible; guests are not retroactively linked. Level is `1 + floor(XP / 500)`. The server validates unlocks from persisted XP. Ranking sorts points descending and uses a stable internal account-ID tie break without exposing the ID. These values are versioned configuration; [ADR 015](adr/015-persistent-player-backend.md) records the policy and limits, including the absence of anti-collusion enforcement.
