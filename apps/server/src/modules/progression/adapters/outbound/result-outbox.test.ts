import { expect, test } from 'bun:test';
import { matchRecord } from '../../domain/tests/match-fixture';
import { createResultOutbox } from './result-outbox';

test('outbox bounds admission, copies summaries, retries failures and drains before close', async () => {
  let callback: (() => void) | undefined;
  let fail = true;
  const saved: string[] = [];
  const events: string[] = [];
  const outbox = createResultOutbox(
    'test-v1',
    async (record) => {
      if (fail) throw new Error('secret');
      saved.push(record.id);
    },
    {
      schedule(_delay, next) {
        callback = next;
        return () => {
          callback = undefined;
        };
      },
      report(code) {
        events.push(code);
      },
    },
    1,
  );
  const result = matchRecord();
  outbox.writer.reserve(result.id);
  expect(() => outbox.writer.reserve('extra')).toThrow('PERSISTENCE_UNAVAILABLE');
  outbox.writer.write(result);
  await outbox.flush();
  expect(events).toEqual(['result_unavailable']);
  expect(callback).toBeDefined();
  fail = false;
  callback?.();
  await outbox.flush();
  expect(saved).toEqual([result.id]);
  expect(outbox.size()).toBe(0);
  outbox.writer.write(result);
  await outbox.close();
  await outbox.close();
  expect(() => outbox.writer.reserve('late')).toThrow();
});

test('shutdown reports uncommitted summaries and telemetry cannot affect delivery', async () => {
  const result = matchRecord();
  const broken = createResultOutbox(
    'test-v1',
    async () => {
      throw new Error('private');
    },
    {
      schedule: () => () => {},
      report() {
        throw new Error('telemetry');
      },
    },
    2,
  );
  broken.writer.reserve('released');
  broken.writer.release('released');
  broken.writer.reserve(result.id);
  broken.writer.write(result);
  await expect(broken.close()).rejects.toThrow('UNFLUSHED_RESULTS');
  for (const size of [0, 4097, 1.5])
    expect(() =>
      createResultOutbox('v', async () => {}, { schedule: () => () => {}, report() {} }, size),
    ).toThrow();
});
