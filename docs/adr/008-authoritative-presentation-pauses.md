# ADR 008 — Server-controlled presentation pauses

Status: accepted for the initial M4 increment, authorized by the request for animations and readable intervals between results and the next turn.

## Context

The server published the next decision immediately after each trick and dealt another hand in the command ending the previous hand. Players had no stable interval to observe results, scores or why someone would open again. Waiting for client animation or ACKs would allow extending matches and create different clocks between players.

## Decision

Room authority introduces fixed presentation pauses: dealing **900 ms**, trick results **1,800 ms** and hand results **2,400 ms**. These are reversible operational playtest defaults; they change no strength, points, assignment, reconnection budget or decision time. Clients cannot change or acknowledge their duration.

`RoomView.transition` is optional and contains only `{ id, kind: 'deal' | 'trick' | 'hand', until }`. Its ID is opaque and `until` is a server-clock timestamp in milliseconds. Absence means no presentation pause. While present, `decisionId` and `deadline` are null; `paused` remains reserved for reconnection protection. The UI must block gameplay actions during this interval and may present animation, text and audio derived from authorized projections. SYNC, reconnection and resignation remain available; leaving a match without resigning remains prohibited.

The resolved trick remains in `completedTricks`; the phase indicates the next turn but no decision is open yet. In `HAND_END`, the completed hand, its authorized cards and result remain projected; only after the interval does the next hand get assigned with a fresh `deal` pause. At twelve points, `MATCH_END` remains visible and no further hand is dealt. These pauses reveal no face-down/remaining cards or Máscara without a resolved trick.

Commands, callbacks and presence use the same room queue. Scheduling identifies both decision and transition, rejecting callbacks from replaced contexts. No protection is consumed during presentation; absences start consuming budget only when the next decision opens. Reconnecting does not change the pause end. A delayed callback opens the decision with its full time at processing time: it does not apply a retroactive timeout to a player who has not received an actionable decision. Resignation, abnormal termination and rematches remove transitions.

## Validation and limits

Fake-clock tests cover boundaries, delayed/stale callbacks, idempotency, rejections, deferred entropy, stable scores, reconnection without early budget consumption and resignation during each pause. Real HTTP/WS integration waits for transitions while preserving independent sessions and complete matches. These values require human playtests; delivery does not prove balance, final match duration, restart recovery or production infrastructure.
