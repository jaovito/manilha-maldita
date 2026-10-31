# Local capacity and recovery rehearsal - M6

Tracked in [#8](https://github.com/jaovito/manilha-maldita/issues/8). This is a synthetic local measurement, not a hosted capacity guarantee or a production outage test.

## Reproduce

From the repository root with Bun 1.4.3, Docker/Compose and the pinned dependencies installed:

```sh
bun install --frozen-lockfile
bun run test:capacity
# Repeat only the account-match and storage-outage fixture:
bun run test:capacity --recovery-only
```

The only optional flag is `--recovery-only`; arbitrary target/URL arguments are refused. It generates a unique Compose project and a free loopback port, starts only that project's PostgreSQL 18.6 test service, applies migrations and starts the actual persistent backend in a child process. Credentials and accounts are public synthetic fixtures. It never reads production database credentials or contacts a hosted database. Its `finally` cleanup resumes the paused test service and removes only its own Compose project, with a bounded shutdown deadline for its child server. Existing development/test projects and volumes are preserved.

Reports contain aggregates only and are written to `/tmp/truco-capacity-<pid>.json`. Do not commit raw traces, cards, cookies, account/match/room identifiers, passwords or connection URLs. The normal database/coverage suites are separate; this command does not replace their correctness checks.

## Workload and observations

- Cohorts contain 2, 4 and 8 concurrently active rooms, half 1v1 and half 2v2: 6, 12 and 24 live sockets respectively. Each cohort uses fresh guest identities; finished rooms remain in the same server process.
- Real HTTP creates/joins rooms, real WebSockets submit ready/start/preparation/betting/card commands, and the actual authority completes every match. The driver passes preparation and plays only a card from the active player's authorized hand. It does not inspect the draw pile, replace server entropy/timers or invent a network result.
- Cohort admission windows start at least 61 seconds apart to preserve the existing per-peer HTTP/WS budgets. Limits, hash policy, connection pool and production defaults are not weakened. Games retain real presentation delays.
- Two accounts register and perform two concurrent successful logins through the actual Argon2id path. They complete an additional real network match; committed PostgreSQL progress must total exactly 250 XP before recovery starts.
- Command latency runs from send through the matching ACK event, before the additional all-client snapshot barrier. It includes client serialization/parsing and loopback transport, not browser rendering or internet latency. Only command ACKs enter this distribution. Room setup must succeed but is outside the timed cohort; any unexpected rejection or incomplete match fails the run.
- Only the child server's RSS and process CPU are sampled. A separate observer queries aggregate SQL connection count, pending/running jobs and oldest pending age every 100 ms, with no overlapping query while storage stalls. Short peaks may fall between samples. SQL connection counts exclude that observer but include the fixture's control/writer and listener connections.

## Measured local baseline - 2026-10-31

Environment: macOS 26.6.2, ARM64, Bun 1.4.3, local Docker PostgreSQL 18.6. Source base was `2eddda5`, plus the working M6 instrumentation. The report deliberately contains no machine serial number, private seeds or player identifiers. Do not generalize this host's measurements to Railway, mobile browsers or long-lived busy matches.

The direct-ACK run recorded:

| Active rooms | Live sockets | ACK samples | ACK p50 | ACK p95 | Maximum ACK | Cohort duration |
|---|---|---|---|---|---|---|
| 2 | 6 | 40 | 1.76 ms | 4.23 ms | 5.40 ms | 4.58 s |
| 4 | 12 | 74 | 1.36 ms | 2.94 ms | 3.23 ms | 4.56 s |
| 8 | 24 | 152 | 1.50 ms | 3.54 ms | 5.39 ms | 4.57 s |

The server's sampled peak RSS was 84,378,368 bytes (80.5 MiB). CPU accumulated 2.62 seconds over the approximately 133-second measurement window, averaging 0.020 CPU cores **including idle admission windows**; this is not busy-period peak utilization. Two login samples took 35.82/37.05 ms, which is too small a sample to infer authentication throughput. Aggregate connections peaked at seven, sampled pending jobs at one and sampled oldest pending age at 18.07 ms.

An earlier end-to-end rehearsal also passed all three cohorts and recovery. Its ACK timing included a 10 ms polling floor, so those latency values were discarded rather than compared with the event-driven measurements above. The subsequent direct-ACK repetition passed with p95 values 4.81/3.37/2.78 ms for 2/4/8 rooms, sampled peak RSS 65.3 MiB, 2.56 seconds of process CPU, six SQL connections and sampled queue age 3.21 ms. Its outage lasted 1.12 s and recovery took 142.68 ms, with the same no-mutation/no-duplicate assertions. These variations are another reason to retain headroom rather than declare saturation.

## Actual local database interruption

This is a separate adapter fixture, not an invented HTTP completion: it submits a synthetic trusted result through the real result outbox/PostgreSQL writer and uses the real reward worker. The fixture uses the two account identities from the naturally completed match and a new result identity.

1. Create a real guest lobby using an outbox of capacity **one**. This deliberately small fixture bound exercises saturation without allocating thousands of matches; it does not change the production default of 1,024.
2. Pause only the owned PostgreSQL container. A fresh writer connection has a one-second connection timeout to obtain a real driver failure promptly; the persistent backend retains its production connection policy.
3. Reserve/write the fixture result, observe persistence unavailability and require outbox size to remain one. Send `START_MATCH` over the real lobby WebSocket; rejection must preserve the complete authorized lobby snapshot and consume zero entropy draws.
4. Resume the database and flush through the existing retry path. Exactly two grants and 250 additional XP must commit. Persist the same result again and verify zero additional XP and still exactly two grants. A new real `START_MATCH` must then succeed, proving admission recovered.

The direct-ACK run measured approximately 1.13 s of paused-database time and 154.69 ms from beginning resume through confirmed reward recovery. No duplicate grants or mutation on rejected admission occurred. This does **not** test a whole-host crash, a long outage, account-lease behavior during an outage or recovery of a result lost before its first durable commit. Those limitations remain part of the architecture; the existing transaction/connection-loss integration tests complement this short outage rehearsal.

## Conservative operational guardrails

The measured local ceiling is the exercised **eight mixed rooms / 24 sockets**, not a discovered saturation point. No extra infrastructure is justified by this sample.

For an isolated hosted rehearsal, begin with two rooms and consider four active rooms (at most 16 players) as a provisional launch ceiling until the actual deployment is measured. This is an operator hypothesis, not a newly enforced game limit. Retain hash concurrency two, pool size four and outbox capacity 1,024 while measuring the deployed build. Budget memory above the measured baseline and the configured maximum concurrent hash allocation; the sampled 80.5 MiB alone is not a sufficient memory limit.

Stop a ramp if there are unexpected rejections/disconnections, steadily growing queue age, resource exhaustion or loss of readiness. Candidate investigation thresholds are command p95 above 100 ms, queue age above five seconds or RSS above 70% of the assigned memory; they are provisional operational thresholds requiring host validation, not product SLOs established by this local run. Database/listener/observer connections need their own headroom. Production activation, TLS, least-privilege roles, backups and staging/rollback evidence remain in #3/#4/#21.
