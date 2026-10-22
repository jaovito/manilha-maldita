# Manilha Maldita — Game Design Document

**Version:** 0.1 — Preproduction proposal
**Status:** Initial design, pending playtests
**Audience:** Casual players, groups of friends, and competitive Truco enthusiasts
**Platforms:** Desktop and mobile browsers


> **Consolidated MVP scope:** four powers — Espião, Segunda Chance, Impulso, and Máscara — available in both casual and competitive play. Modes differ in draw policies and timers. Public rooms, events, and experimental powers are outside the MVP. The future ideas below are not approved features.
>
> **Implementation contract:** [docs/rules.md](docs/rules.md) consolidates current conventions, including sealed preparation, stakes, special hands, timers, and reconnection. Use that document to implement and test behavior. This GDD retains the product vision and expansion proposals; new discrepancies must be resolved explicitly, without silently changing product decisions.

---

## 1. Product vision

Manilha Maldita is a multiplayer card game based on Truco Paulista. It preserves the fundamental rules of Truco while adding randomly assigned powers that change information, card strength, and strategic possibilities.

The goal is to offer quick, social, competitive matches with high replay value.

### Main goals

1. Support 1v1 or 2v2 play in private rooms.
2. Remain understandable to people who already know Truco.
3. Add depth without creating hundreds of additional rules.
4. Offer casual and competitive modes.
5. Provide random powers without paid benefits.
6. Ensure the server controls every decision and all secret information.

### Outside the initial scope

The MVP will not include global rankings, an item store, tournaments, a campaign, sophisticated bots, or native apps.

**Authorized M5 update (22/10/2026):** global rankings based on competitive wins, XP/levels, and exclusively cosmetic unlocks enter the M5 scope. Accounts remain optional for playing. Customization will have separate Avatars, Decks, and Tables tabs; avatars are predefined, without uploads, preserving the existing pixel art. Decks change card backs and suit/value styling without changing identity, readability, or rules; other players see the owner's theme while respecting authorized information. The vira uses the default theme. Stores, paid advantages, and power unlocks are not authorized. XP/point values, the level curve, account recovery, and eligibility criteria remain pending. The first M5 increment prepares only the database and result queue.

---

## 2. Base match rules

### Deck

- 40 cards, without 8s, 9s, 10s, or jokers.
- Three cards per player, dealt without replacement.
- One additional card is revealed as the vira.
- Shuffle again for every hand.

**Normal hierarchy, strongest to weakest:**

3 > 2 > A > K > J > Q > 7 > 6 > 5 > 4.

The manilha is the rank immediately following the vira in this cycle:

4 → 5 → 6 → 7 → Q → J → K → A → 2 → 3 → 4.

The four manilhas beat any normal card. Among manilhas, the order is:

Clubs > Hearts > Spades > Diamonds.

### Match

- A match ends when a team reaches 12 or more points.
- A hand contains up to three tricks.
- In each trick, every active player plays exactly one card.
- The player or team winning the hand receives the points at stake.
- Partners occupy alternating seats in 2v2.
- The hand's starting player rotates in seat order with every new hand.
- The team winning a trick starts the next one; in 2v2, the player on that team who played the winning card starts.
- When a trick ties, the player who started the tied trick starts the next one.

### Ties

To prevent differing interpretations, use these rules:

| Trick results | Hand result |
|---|---|
| A wins the first; the second ties | A wins |
| The first ties; A wins the second | A wins |
| The first and second tie; A wins the third | A wins |
| A wins the first; B wins the second; the third ties | A wins |
| All three tie | Hand voided, no points |
| The same team wins the first two | Hand ends immediately |

A tie in the first trick does not introduce an artificial suit tiebreaker for normal cards. Ties continue to follow trick precedence.

### Face-down cards

Allowed only from the second trick onward.

A face-down card has no contest strength: it loses to any face-up card and ties another face-down card when both are the strongest remaining cards in the contest.

The face-down card is consumed normally, and its value is not revealed during the hand.

### Scoring and stakes

Stakes follow this sequence:

1 → 3 → 6 → 9 → 12.

When a raise is requested, the opposing team may:

- **Accept:** the hand becomes worth the new amount.
- **Fold:** the requesting team receives the previously accepted value.
- **Raise:** propose the next value, transferring the decision to the other team.

The value does not increase while the request is pending.

Stake levels cannot be skipped, and a team cannot make two consecutive raises unless the other team has taken the intermediate raise.

Requests may be made by the player whose turn is active, before playing their card. No card may be played while a response is pending.

In 2v2, either member of the challenged team may respond; the first valid response received by the server is final for the team.

### Eleven-point hand

When a team reaches 11 points:

- The team receives its cards and sees the vira.
- In 2v2, that team's players may view their partner's cards during the decision.
- The team chooses to play for 3 points or fold and concede 1 point to the opponents.
- If it plays, no further Truco requests are allowed.
- Powers are disabled for that hand.

In 1v1, the decision is individual.

When both teams have 11 points, the **mão de ferro** occurs: the hand is worth 3 points, with no powers, raises, or face-down cards. The match ends when there is a winner.

These are conventions chosen for this game; other Truco variants may handle special situations differently.

---

## 3. Modes

### Casual — Truco Caótico

The focus is playing with friends, experimenting with powers, and creating reversals.

- Powers are drawn independently for each player.
- Opponents may receive duplicate powers.
- The MVP includes only Espião, Segunda Chance, Impulso, and Máscara, without scoring effects.
- Experimental abilities and events are future proposals, outside the MVP.
- No competitive ranking.
- Private rooms in the MVP; public rooms come later.
- The host configures timers before the match.

### Competitive — Truco Estratégico

The focus is reducing advantages created solely by power draws.

- The MVP uses the same four powers as casual, with mirrored draws; balance still depends on playtests.
- Mirrored draws between the two teams.
- Each power is known only to its owner until activation, including with respect to their partner.
- No additional random events.
- No powers that change a hand's score.
- Fixed rules and standardized timers.
- Standardized reconnection, resignation, and inactivity limits.

**Mirrored draws:**

In 1v1, the server draws one power, and both players receive it.

In 2v2, the server draws two distinct powers, A and B. Each team receives one instance of A and one of B, randomly assigned among its members.

This preserves the desired randomness while preventing one team from receiving an objectively stronger set of abilities than the other.

Mirrored draws reduce asymmetry in access to powers but do not guarantee perfect balance, because turn order, cards, and ability interactions still affect advantages. Even without exposing others' assignments, this policy allows powers to be inferred. Changing competitive play to independent draws is pending an owner decision.

### Truco Clássico (future)

A third mode could simply disable all abilities, reusing the same Truco engine.

---

## 4. Power system

### Assignment

At the beginning of each hand, after dealing cards and revealing the vira:

1. The server determines the power pool allowed for the mode.
2. It draws one power for each player, following the casual or competitive policy.
3. It delivers each power only to its owner; partners and opponents cannot see unused assignments.
4. It opens activation windows.
5. At the end of the hand, it discards assigned powers and draws new ones for the next hand.

Draws do not use levels, previous wins, money, cosmetics, or account progression.

### Energy

Each player has an individual reserve.

| Property | Rule |
|---|---|
| Initial energy | 2 |
| Regeneration | +1 per new hand, except the first |
| Maximum energy | 3 |
| Uses per hand | Maximum 1 |
| Ability cost | 1, 2, or 3 |
| Insufficient energy | Ability unavailable |

Energy may accumulate between hands but never exceeds 3.

At the beginning of a match, the first draw already has 2 energy points available. In special hands without powers, the reserve remains unchanged.

All players' energy is public. A power's identity becomes public only after an accepted activation: during sealed preparation resolution or alongside a play. Powers never used remain hidden when the hand/match ends. The result of an information power remains private to its recipient.

### Activation windows

Each power must specify one window:

- **Preparation:** after power draws and before the first play.
- **Your turn:** before placing a card, while no Truco request is pending.
- **Reaction:** only when a specific effect offers an opportunity to respond.
- **Resolution:** previously activated effects are processed automatically.

The first version should avoid nested reactions and multiple concurrent activations.

A player may pass during preparation without activating anything, retaining their power if it has a later window.

### Universal restrictions

1. No ability may create a physical manilha.
2. Strength modifiers cannot exceed manilhas.
3. No ability may prevent a team from folding to a Truco request.
4. Powers cannot modify cards whose result has already been resolved.
5. Effects cannot continue indefinitely between hands.
6. The client never decides an ability's result.
7. Targeted powers must explicitly identify their valid target.
8. If no valid target exists, activation is rejected without consuming energy.
9. Effect resolution must be deterministic after server-generated draws.
10. Private information is never included in public room updates.

---

## 5. Initial ability catalog

### MVP powers — casual and competitive

| Power | Cost | Effect | Window |
|---|---:|---|---|
| Espião | 1 | Reveals to the user one random, unplayed card belonging to an opponent | Preparation |
| Segunda Chance | 2 | Exchanges a selected card from the user's hand for a random card from the remaining deck | Preparation |
| Impulso | 2 | Increases the next normal card's effective strength by one level | Your turn |
| Máscara | 1 | Temporarily hides the next card's identity, revealing it when the trick resolves | Your turn |

**Special specifications:**

**Espião:** in 2v2, the player chooses which opponent to investigate. The revealed card is random. Information is sent exclusively to the player who activated the ability, not to their partner. The power does not change the investigated hand.

**Segunda Chance:** the discarded card goes to a zone outside the deck and does not return during this hand. The new card comes from the remaining pool, without replacement. The vira can never be drawn. The exchange occurs before the first trick.

**Impulso:** works only on a card that is not a manilha. Increases effective strength by exactly one level in the normal hierarchy, capped at the 3's level. The effect changes only comparison; the card's identifier, suit, and physical identity remain unchanged. The ability is announced before the card is chosen.

**Máscara:** the card remains hidden from opponents until all players have completed the trick. When revealed, it retains full strength. This differs from a traditional face-down card, which does not contest strength. The interface must clearly distinguish the two effects.

### Casual ideas — outside the MVP

| Power | Cost | Effect |
|---|---:|---|
| Reflexo | 2 | The played normal card ties the strongest normal card already revealed in the trick |
| Aposta Arriscada | 2 | Before the first play, predicts the team's win; adds 1 point to the winner if correct, or 1 point to the opponents if wrong |
| Tudo ou Nada | 3 | Before the first play, adds 1 point to the reward of whoever wins the hand |
| Pressão | 1 | Reduces the selected opponent's next card decision to 5 seconds, respecting accessibility settings |

These four powers are **experimental and not approved for implementation**. The rules below record the original proposal for future evaluation. If revisited, point modifiers would need to apply only to the hand's final score, without changing intermediate Truco request values.

To avoid combinations that are difficult to control, only one additional scoring modifier may be registered per team in a hand, and each team may receive at most one additional ability point in that hand. The score is capped at 12 points.

**Reflexo** requires at least one opposing normal card already revealed in the trick and does not affect manilhas.

**Pressão** does not override mandatory accessibility settings. For that reason, it will not be available in competitive matches and may be disabled by the host.

### Powers rejected for launch

- Stealing a card from another player's hand.
- Choosing a different manilha.
- Voiding an already resolved trick.
- Preventing the opponent from requesting Truco.
- Forcing an opponent to discard their best card.
- Doubling all hand points.

These abilities may be visually interesting, but they create large asymmetries, undermine Truco's identity, or make the result excessively dependent on draws.

---

## 6. Special events — outside the MVP

No events will be implemented in the MVP. The rest of this section records a future proposal, subject to approval and playtests: events restricted to casual mode and disabled by default.

When enabled, events occur every three completed hands. The event is drawn and announced before dealing the next hand.

### Initial set

- **Energia Extra:** everyone receives one additional energy, up to the limit of 3.
- **Mão Misteriosa:** the vira is revealed only after the first trick; cards played in that trick are resolved after the reveal, without changing their identities.
- **Rodada Rápida:** all players receive a shorter timer.
- **Silêncio Mágico:** no power may be activated during that hand.

Events do not occur in eleven-point hands or mão de ferro.

If the event expansion is approved, the proposal is to begin with Energia Extra and Silêncio Mágico. The others require additional gameplay validation.

---

## 7. Room flow

### Creation

The player opens the website and selects **Criar Sala**.

They enter a nickname, choose 1v1 or 2v2 and casual or competitive, and receive a short code and an invitation link.

Creating an account is not mandatory.

### Lobby

The lobby displays:

- Connected players.
- Seats and teams.
- Match settings.
- Ready indicators.
- A start control available to the host when everyone is ready.

In 2v2, players may choose partners or use random team assignment.

Players may leave and return to the lobby. Teams cannot be changed after a match begins.

### During a match

The interface shows the player's cards, vira, manilhas, score, energy, powers, current turn, Truco requests, and public play history.

Each player sees only their own cards, except for effects permitted by abilities and special rules.

### Completion

When the match ends, the result screen shows:

- Winning team.
- Final score.
- Hands played.
- Powers used.
- Major match reversals.
- A rematch option with the same teams.

Hidden information may be made available in a later replay, but not during an active match.

---

## 8. Timers and disconnections

### Proposed initial limits

| Situation | Casual | Competitive |
|---|---:|---:|
| Play a card | 30 s | 20 s |
| Respond to Truco | 20 s | 15 s |
| Hand preparation | 15 s | 10 s |
| Protected reconnection | 60 s | 30 s |

These values are design hypotheses to be adjusted during testing.

In casual play, the host may disable the card timer.

In competitive play, the timer is mandatory. If a player reaches the limit, the server records a valid automatic play. The initial policy is to play the weakest normal card, or the weakest available card when only manilhas remain.

Automatic resolution is deterministic and never activates powers.

When a Truco request is pending and time expires, the challenged team automatically folds. If the player responsible for the special eleven-point decision does not respond, the team folds.

### Reconnection

Disconnection does not erase cards or match state.

- The player returns using a resume token bound to their seat.
- The server provides a complete private snapshot and the public events needed for synchronization.
- Actions sent before disconnection are not processed twice.
- After the reconnection allowance is exceeded, the normal action timer resumes.
- The match may end by abandonment if there are insufficient participants to continue.

Mechanisms to prevent pause or reconnection abuse must be defined before ranked matches become available.

---

## 9. Cosmetic progression

All powers will be available from the start. Account levels will not grant stronger cards, and virtual currency will not buy advantages.

Players may unlock:

- Card backs and styles.
- Tables and backgrounds.
- Truco animations.
- Victory effects.
- Emotes.
- Avatars.
- Titles and frames.

Progression may use experience earned from completed matches, weekly challenges, and participation milestones.

Experience amounts should not depend exclusively on wins, so casual players do not feel compelled to compete intensely.

Accounts and progression will be optional in the MVP. Cosmetic features enter a later phase.

---

## 10. Gameplay acceptance criteria

The first playable release must satisfy the following:

1. Two or four users enter the same room and play a complete match.
2. Manilha and tiebreaking rules are resolved correctly.
3. No card can be duplicated during dealing or abilities.
4. Public state never contains other players' private cards.
5. The server rejects actions outside the player's turn.
6. A pending Truco request blocks incompatible plays.
7. Activating a power consumes energy exactly once.
8. A disconnected player can resume their position without restarting the match.
9. The match correctly determines the winner upon reaching 12 points.
10. Casual and competitive modes use distinct draw policies.
11. All relevant states are reproducible in automated tests.
12. No race condition may allow two incompatible actions in the same hand state.

---

## 11. Open playtest questions

The following choices are not considered balanced or final merely because they have been specified:

- Initial energy and regeneration.
- Power draw frequency.
- Actual strength of Impulso.
- Effectiveness of Máscara in 1v1.
- Appropriate frequency of information effects.
- Decision duration.
- Whether scoring abilities need limits.
- Impact of abilities on match duration.

These elements must be adjusted using simulated matches and real player tests.

### Authorized extension — solo training (19/10/2026)

The Jogar button may open a 1v1 match against a simple training bot, enabled by an independent flag. This does not include sophisticated bots, ranking, progression, or matchmaking. Tools to arrange hands/powers and restart hands are restricted to development and the player's own solo tables, never production. The detailed contract is in ADR 009.
