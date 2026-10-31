import { expect, test } from 'bun:test';
import { distribution } from '../../tests/capacity/statistics';

test('capacity percentiles retain slow samples and do not mutate observations', () => {
  const samples = [100, 1, 4, 2];
  expect(distribution(samples)).toEqual({ count: 4, p50: 2, p95: 100, maximum: 100 });
  expect(samples).toEqual([100, 1, 4, 2]);
  expect(distribution([0])).toEqual({ count: 1, p50: 0, p95: 0, maximum: 0 });
});

test('capacity summaries reject missing, invalid or negative measurements', () => {
  for (const samples of [[], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])
    expect(() => distribution(samples)).toThrow('INVALID_CAPACITY_SAMPLES');
});

test('capacity CLI refuses arbitrary targets before allocating local infrastructure', async () => {
  const command = Bun.spawn(['bun', 'tests/capacity/run.ts', '--database=production'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(command.stdout).text(),
    new Response(command.stderr).text(),
    command.exited,
  ]);

  expect(status).toBe(1);
  expect(stdout).toBe('');
  expect(stderr.trim()).toBe('CAPACITY_ARGUMENTS_NOT_ALLOWED');
});
