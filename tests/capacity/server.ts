import { SQL } from 'bun';
import { connectLocalDatabase } from '../../apps/server/database/connect';
import { migrateLocalDatabase } from '../../apps/server/database/migrate';
import { localDatabaseUrl } from '../../apps/server/database/target';
import { main } from '../../apps/server/src/bootstrap/main';
import { origin } from './client';

const emit = (value: unknown) => console.log(JSON.stringify(value));

async function serve() {
  const url = localDatabaseUrl('test');
  const connection = connectLocalDatabase('test');
  try {
    await migrateLocalDatabase(connection.db);
  } finally {
    await connection.close();
  }

  const runtime = await main({
    NODE_ENV: 'test',
    PORT: '0',
    HOST: '127.0.0.1',
    ALLOWED_ORIGINS: origin,
    ENABLE_ACCOUNTS: 'true',
    DATABASE_URL: url,
    PASSWORD_PEPPER: 'ab'.repeat(32),
  });
  const observer = new SQL(url, { max: 1 });
  const initialCpu = process.cpuUsage();
  const started = performance.now();
  let probing = false;
  let peakRss = 0;
  const sample = async () => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    if (probing) return;
    probing = true;
    try {
      const [row] = await observer<{ connections: number; pending: number; lag: number }[]>`
        SELECT (SELECT count(*)::int FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid()) AS connections,
          count(*) FILTER (WHERE status IN ('pending', 'running'))::int AS pending,
          coalesce(max(extract(epoch FROM clock_timestamp() - created_at) * 1000)
            FILTER (WHERE status IN ('pending', 'running')), 0)::float8 AS lag FROM app.jobs`;
      const cpu = process.cpuUsage(initialCpu);
      emit({
        type: 'sample',
        rss: peakRss,
        cpuUs: cpu.user + cpu.system,
        elapsedMs: performance.now() - started,
        ...row,
      });
    } catch {
      emit({ type: 'database_unavailable' });
    } finally {
      probing = false;
    }
  };
  const timer = setInterval(() => {
    void sample();
  }, 100);
  emit({ type: 'ready', address: runtime.server.url.origin });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    await sample();
    await runtime.stop();
    await observer.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => {
    void stop();
  });
  process.once('SIGINT', () => {
    void stop();
  });
}

await serve().catch(() => {
  console.error('CAPACITY_SERVER_FAILED');
  process.exitCode = 1;
});
