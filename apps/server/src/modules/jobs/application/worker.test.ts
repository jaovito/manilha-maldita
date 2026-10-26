import { expect, test } from 'bun:test';
import { startJobWorker } from '../index';
import { workerFixture } from './tests/worker-fixture';

test('worker scans at startup, polls without notifications, coalesces wakes and stops timers', async () => {
  const fixture = workerFixture();
  const worker = await startJobWorker(fixture.queue, fixture.runtime);
  expect(fixture.state.calls).toBe(0);
  fixture.advance(0);
  await fixture.flush();
  expect(fixture.state.calls).toBe(1);

  for (let index = 0; index < 100; index++) fixture.wake();
  fixture.advance(0);
  await fixture.flush();
  expect(fixture.state.calls).toBe(2);
  fixture.advance(1_000);
  fixture.advance(0);
  await fixture.flush();
  expect(fixture.state.calls).toBe(3);

  await worker.stop();
  await worker.stop();
  fixture.wake();
  fixture.advance(10_000);
  expect(fixture.state.calls).toBe(3);
  expect(fixture.state.unsubscribed).toBe(1);
  expect(fixture.timers.size).toBe(0);
});

test('bounded batches yield and concurrent notifications never overlap processing', async () => {
  const fixture = workerFixture();
  const gate = Promise.withResolvers<'completed'>();
  fixture.setOperation(() => gate.promise);
  const worker = await startJobWorker(fixture.queue, fixture.runtime, { maxJobsPerWake: 1 });
  fixture.advance(0);
  fixture.wake();
  fixture.wake();
  fixture.advance(1_000);
  fixture.advance(0);
  expect(fixture.state.calls).toBe(1);
  gate.resolve('completed');
  await fixture.flush();
  expect(fixture.events).toEqual(['completed']);

  fixture.setOperation(async () => 'idle');
  fixture.advance(0);
  await fixture.flush();
  expect(fixture.state.calls).toBe(2);
  expect(fixture.state.maxActive).toBe(1);
  await worker.stop();
});

test('shutdown waits for the in-flight transaction and does not start the next job', async () => {
  const fixture = workerFixture();
  const gate = Promise.withResolvers<'completed'>();
  fixture.setOperation(() => gate.promise);
  const worker = await startJobWorker(fixture.queue, fixture.runtime);
  fixture.advance(0);
  let stopped = false;
  const closing = worker.stop().then(() => {
    stopped = true;
  });
  await fixture.flush();
  expect(stopped).toBe(false);
  gate.resolve('completed');
  await closing;
  expect(fixture.state.calls).toBe(1);
  expect(fixture.timers.size).toBe(0);
});

test('storage and telemetry failures do not leak errors, spin or permanently stop polling', async () => {
  const fixture = workerFixture();
  fixture.setOperation(async () => {
    throw new Error('private database URL and token');
  });
  const worker = await startJobWorker(fixture.queue, fixture.runtime);
  fixture.advance(0);
  await fixture.flush();
  expect(fixture.events).toEqual(['queue_unavailable']);
  fixture.advance(0);
  expect(fixture.state.calls).toBe(1);

  let count = 0;
  fixture.setOperation(async () => (++count === 1 ? 'retry' : count === 2 ? 'failed' : 'idle'));
  fixture.advance(1_000);
  fixture.advance(0);
  await fixture.flush();
  expect(fixture.events).toEqual(['queue_unavailable', 'retry', 'failed']);
  await worker.stop();

  const throwing = workerFixture();
  let pending = true;
  throwing.setOperation(async () => {
    if (!pending) return 'idle';
    pending = false;
    return 'completed';
  });
  const resilient = await startJobWorker(throwing.queue, {
    ...throwing.runtime,
    report() {
      throw new Error('telemetry failure');
    },
  });
  throwing.advance(0);
  await throwing.flush();
  expect(throwing.state.calls).toBe(2);
  await resilient.stop();
});

test('startup failure cancels early wakes and shutdown still drains if unsubscribe fails', async () => {
  const fixture = workerFixture();
  await expect(
    startJobWorker(
      {
        ...fixture.queue,
        async subscribe(wake) {
          wake();
          throw new Error('LISTEN_FAILED');
        },
      },
      fixture.runtime,
    ),
  ).rejects.toThrow('LISTEN_FAILED');
  expect(fixture.timers.size).toBe(0);

  const failing = workerFixture();
  failing.setUnsubscribe(async () => {
    throw new Error('UNLISTEN_FAILED');
  });
  const worker = await startJobWorker(failing.queue, failing.runtime);
  await expect(worker.stop()).rejects.toThrow('UNLISTEN_FAILED');
  expect(failing.timers.size).toBe(0);
});

test('worker preserves the default batch size and accepts custom limits at both boundaries', async () => {
  const defaults = workerFixture();
  defaults.setOperation(async () => 'completed');

  const worker = await startJobWorker(defaults.queue, defaults.runtime);
  defaults.advance(0);
  await defaults.flush(100);
  expect(defaults.state.calls).toBe(25);
  await worker.stop();

  for (const options of [
    { pollIntervalMs: 10, maxJobsPerWake: 1 },
    { pollIntervalMs: 60_000, maxJobsPerWake: 100 },
  ]) {
    const fixture = workerFixture();
    fixture.setOperation(async () => 'completed');

    const configured = await startJobWorker(fixture.queue, fixture.runtime, options);
    fixture.advance(0);
    await fixture.flush(400);
    expect(fixture.state.calls).toBe(options.maxJobsPerWake);

    fixture.setOperation(async () => 'idle');
    fixture.advance(0);
    await fixture.flush();
    const callsBeforePoll = fixture.state.calls;

    fixture.advance(options.pollIntervalMs - 1);
    fixture.advance(0);
    await fixture.flush();
    expect(fixture.state.calls).toBe(callsBeforePoll);

    fixture.advance(1);
    fixture.advance(0);
    await fixture.flush();
    expect(fixture.state.calls).toBe(callsBeforePoll + 1);
    await configured.stop();
  }
});

test('worker rejects invalid operational limits before subscribing', async () => {
  for (const options of [
    { pollIntervalMs: 0 },
    { pollIntervalMs: 60_001 },
    { maxJobsPerWake: 0 },
    { maxJobsPerWake: 101 },
    { maxJobsPerWake: 1.5 },
  ]) {
    const fixture = workerFixture();
    await expect(startJobWorker(fixture.queue, fixture.runtime, options)).rejects.toThrow(
      'INVALID_WORKER_OPTIONS',
    );
    expect(fixture.timers.size).toBe(0);
  }
});
