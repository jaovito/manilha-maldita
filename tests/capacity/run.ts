import { SQL } from 'bun';
import { localDatabaseUrl } from '../../apps/server/database/target';
import { password, post, room, until } from './client';
import { recover } from './recovery';
import { distribution } from './statistics';

async function run() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--recovery-only'))
    throw new Error('CAPACITY_ARGUMENTS_NOT_ALLOWED');
  const recoveryOnly = args[0] === '--recovery-only';

  const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
  const port = probe.port;
  await probe.stop(true);
  const project = `truco-capacity-${crypto.randomUUID().slice(0, 8)}`;
  const databaseUrl = localDatabaseUrl('test', {
    NODE_ENV: 'test',
    TEST_DATABASE_URL: `postgresql://truco_test:capacity_fixture_only@127.0.0.1:${port}/truco_test`,
  });
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    POSTGRES_TEST_PORT: String(port),
    POSTGRES_TEST_PASSWORD: 'capacity_fixture_only',
    TEST_DATABASE_URL: databaseUrl,
  };
  const compose = async (...args: string[]) => {
    const command = Bun.spawn(['docker', 'compose', '-p', project, '--profile', 'test', ...args], {
      env,
      stdout: 'ignore',
      stderr: 'inherit',
    });
    if ((await command.exited) !== 0) throw new Error('CAPACITY_DATABASE_LIFECYCLE_FAILED');
  };
  let child: ReturnType<typeof Bun.spawn> | undefined;
  let drain: Promise<void> | undefined;
  const samples: Record<string, number[]> = {
    rss: [],
    cpuUs: [],
    elapsedMs: [],
    connections: [],
    pending: [],
    lag: [],
  };
  let address = '';
  const stopChild = async () => {
    if (!child || child.exitCode !== null) return;

    child.kill('SIGTERM');
    const deadline = setTimeout(() => child?.kill('SIGKILL'), 10_000);
    try {
      await child.exited;
    } finally {
      clearTimeout(deadline);
    }
  };

  try {
    await compose('up', '-d', '--wait', 'postgres-test');
    child = Bun.spawn(['bun', 'tests/capacity/server.ts'], {
      env,
      stdout: 'pipe',
      stderr: 'inherit',
    });
    const output = child.stdout;
    if (!output || typeof output === 'number') throw new Error('CAPACITY_OUTPUT_MISSING');
    drain = (async () => {
      let pending = '';
      for await (const chunk of output) {
        pending += new TextDecoder().decode(chunk);
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const value: unknown = JSON.parse(line);
          if (!value || typeof value !== 'object' || !('type' in value))
            throw new Error('CAPACITY_OUTPUT_INVALID');
          if (value.type === 'ready' && 'address' in value && typeof value.address === 'string') {
            const url = new URL(value.address);
            if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:')
              throw new Error('CAPACITY_REMOTE_SERVER_REFUSED');
            address = url.origin;
          }
          if (value.type === 'sample')
            for (const key of Object.keys(samples)) {
              const field = Reflect.get(value, key);
              if (typeof field !== 'number' || !Number.isFinite(field) || field < 0)
                throw new Error('CAPACITY_METRIC_INVALID');
              samples[key]?.push(field);
            }
        }
      }
    })();
    // Observe reader failure immediately rather than leaving a rejected promise unhandled.
    let readerFailed = false;
    void drain.catch(() => {
      readerFailed = true;
    });
    await until(() => {
      if (readerFailed || child?.exitCode !== null) throw new Error('CAPACITY_CHILD_FAILED');
      return Boolean(address);
    }, 30_000);
    const cohorts = [];

    let admissionWindow = 0;
    for (const concurrency of recoveryOnly ? [] : [2, 4, 8]) {
      if (admissionWindow)
        await Bun.sleep(Math.max(0, 61_000 - (performance.now() - admissionWindow)));
      admissionWindow = performance.now();
      console.log(JSON.stringify({ stage: 'network_cohort', concurrentRooms: concurrency }));
      const latency: number[] = [];
      const games = await Promise.all(
        Array.from({ length: concurrency }, (_, index) =>
          room(address, index % 2 ? 4 : 2, latency),
        ),
      );
      const started = performance.now();
      try {
        await Promise.all(games.map((game) => game.complete()));
        cohorts.push({
          concurrentRooms: concurrency,
          concurrentSockets: concurrency * 3,
          elapsedMs: performance.now() - started,
          commandAckMs: distribution(latency),
        });
      } finally {
        for (const game of games) game.close();
      }
    }

    const cookies: string[] = [];
    const logins: string[] = [];
    for (let index = 0; index < 2; index++) {
      const login = `capacity_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
      const response = await post(address, '/api/accounts/register', {
        login,
        password,
        nickname: 'Capacity Account',
      });
      const cookie = response.headers.get('Set-Cookie')?.split(';')[0];
      if (!response.ok || !cookie) throw new Error('CAPACITY_REGISTRATION_FAILED');
      logins.push(login);
      cookies.push(cookie);
    }
    const loginMs = await Promise.all(
      logins.map(async (login) => {
        const started = performance.now();
        const response = await post(address, '/api/accounts/login', { login, password });
        const cookie = response.headers.get('Set-Cookie')?.split(';')[0];
        if (!response.ok || !cookie) throw new Error('CAPACITY_LOGIN_FAILED');
        cookies[logins.indexOf(login)] = cookie;
        return performance.now() - started;
      }),
    );
    const accountGame = await room(address, 2, [], cookies);
    let source: string;
    try {
      const result = await accountGame.complete();
      if (!result.matchId) throw new Error('CAPACITY_RESULT_MISSING');
      source = result.matchId;
    } finally {
      accountGame.close();
    }
    const client = new SQL(databaseUrl, { max: 1 });
    try {
      await until(async () => {
        const [row] = await client<
          { xp: string }[]
        >`SELECT coalesce(sum(xp), 0)::text AS xp FROM app.player_progress`;
        return row?.xp === '250';
      });
    } finally {
      await client.close();
    }

    const recovery = await recover(
      databaseUrl,
      source,
      () => compose('pause', 'postgres-test'),
      () => compose('unpause', 'postgres-test'),
    );
    await stopChild();
    if (child.exitCode !== 0) throw new Error('CAPACITY_CHILD_SHUTDOWN_FAILED');
    await drain;
    const summarize = (name: string) => distribution(samples[name] ?? []);
    const elapsedMs = summarize('elapsedMs').maximum;
    const report = {
      mode: recoveryOnly ? 'recovery-only' : 'complete',
      measuredAt: new Date().toISOString(),
      bun: Bun.version,
      platform: process.platform,
      architecture: process.arch,
      cohorts,
      cohortAdmissionSpacingMs: 61_000,
      concurrentLogins: 2,
      loginMs: distribution(loginMs),
      serverPeakRssBytes: summarize('rss').maximum,
      serverCpuUs: summarize('cpuUs').maximum,
      averageCpuCores: summarize('cpuUs').maximum / (elapsedMs * 1000),
      databaseConnectionsExcludingSampler: summarize('connections').maximum,
      queuePendingPeak: summarize('pending').maximum,
      queueOldestMsPeak: summarize('lag').maximum,
      recovery,
    };
    const destination = `/tmp/truco-capacity-${process.pid}.json`;
    await Bun.write(destination, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    console.log(`Report: ${destination}`);
  } finally {
    await stopChild();
    await drain?.catch(() => {});
    await compose('down');
  }
}

await run().catch((cause: unknown) => {
  const code =
    cause instanceof Error && /^CAPACITY_[A-Z_]{1,80}$/.test(cause.message)
      ? cause.message
      : 'CAPACITY_RUN_FAILED';
  console.error(code);
  process.exitCode = 1;
});
