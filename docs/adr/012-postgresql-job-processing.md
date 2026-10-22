# ADR 012 — Transactional PostgreSQL queue consumer

Date: 2026-10-22. Status: accepted for the second M5 increment.

## Context

After validating ADR 011's setup, the owner authorized further reviewable increments. This step makes the queue mechanism operational while preserving open login, XP, point and eligibility decisions. The game server must neither consume jobs through an empty handler nor depend on the database per play.

## Decision

Add a `jobs` module with a pure retry policy, port-driven application worker and Bun.SQL/PostgreSQL adapter. No additional dependency, migration or infrastructure. The adapter receives a configured SQL client and mandatory processor; the worker receives a scheduler and event sink. Module imports open no connections, install no timers and consume no jobs.

`enqueue` requires a transaction handle: authoritative results/jobs can share a commit. Repeating a type/match changes no recorded state, deadline or limit. Create no public endpoint to enqueue or confirm results.

One `runNext` selects a due job with `FOR UPDATE SKIP LOCKED` and holds the lock through a short transaction. It increments attempts, marks reservation and executes the processor in a savepoint. Success commits effects and completion together. Failure rolls back the savepoint, preserves only the attempt and records reschedule/failure with a generic code. Connection/outer transaction errors also roll back the attempt/reservation: another consumer can select the job again.

This mode is restricted to trusted processors whose effects use the same PostgreSQL through only the supplied handle. It provides no exactly-once guarantee for email, HTTP or other external effects. The SQL handle is not a sandbox: processor code requires review and must never commit/end transactions, open connections or perform external I/O. Tests change XP only as fixtures proving atomicity; they define no product rewards.

Atomic completion does not replace `match_rewards` uniqueness: the future processor must also deduplicate grants by participant/match. Manual job cleanup/recreation cannot authorize repeating an already-granted reward.

Old expired `running` reservations are recovered under lock. If their limit was reached, they become `failed` without running the processor. Since this consumer never publishes reservations separately from effects, its running reservation cannot be stolen: the row lock prevents another consumer selecting it. Do not mix this with external consumers completing by token without reviewing the fencing/idempotency protocol.

## Limits and operations

- One active job per worker instance. Multiple instances use PostgreSQL locks; no global order is guaranteed.
- Batches of up to 25 operations per wake, configurable up to 100; yield to the scheduler between batches. Simultaneous notifications coalesce. Polling defaults to 1 s, validated between 10 ms and 60 s.
- Default exponential retry from 1 s to 60 s, without jitter at this initial scale. Policy is copied/validated and changes no XP/point amounts. Jobs become due only by PostgreSQL time, never browser timestamps.
- Transaction-local statement and idle-in-transaction timeouts of 5 s. These bound individual statements/inactivity, not total JavaScript function time or permission for long work.
- LISTEN uses a dedicated Bun.SQL-managed connection; notifications/reconnection callbacks only wake the worker. It scans at startup and periodically without trusting payloads. Lost notifications do not remove jobs.
- Storage failure stops the cycle until another poll/wake; no immediate unbounded retry loop. Operational events are only `completed`, `retry`, `failed`, `queue_unavailable`, without raw data/errors.
- `stop` cancels timers, removes listeners and awaits the current operation. It is idempotent; it does not close the caller-owned SQL client. Unsubscribe failure propagates after awaiting the operation.

No CLI, flag or `startServer` integration exists: reward processing and authoritative completion persistence are missing. No job completes automatically without that processor. Cleanup/retention, queue age/size metrics and production roles/TLS are outside this increment. Demonstrated recovery starts after result/job commit; in-memory rooms remain unrecoverable after crashes.

## Required validation

Controlled-scheduler unit tests cover startup, polling, coalescing, concurrency, boundaries, failures and shutdown. PostgreSQL integration covers atomic result/jobs, duplicates, SQL-error savepoints, effect rollback, due time/attempt ceilings, concurrent consumers and real termination only of the connection created by the test. Tests must not pretend to exercise networking by calling multiple local components.
