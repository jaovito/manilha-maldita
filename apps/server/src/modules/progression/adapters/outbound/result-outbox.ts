import type { ResultWriter } from '../../../rooms';
import type { MatchRecord } from '../../domain/match-record';

export type OutboxRuntime = Readonly<{
  schedule(delayMs: number, callback: () => void): () => void;
  report(code: 'result_persisted' | 'result_unavailable'): void;
}>;

/** Reserve before entropy; a finished result survives rematch/room removal until its commit. */
export function createResultOutbox(
  policyVersion: string,
  persist: (record: MatchRecord) => Promise<void>,
  runtime: OutboxRuntime,
  maximum: number,
) {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 4096)
    throw new Error('INVALID_OUTBOX_CAPACITY');

  const pending = new Map<string, MatchRecord | null>();
  let active: Promise<void> | null = null;
  let cancel: (() => void) | null = null;
  let stopping = false;
  let closed: Promise<void> | null = null;

  const report = (code: 'result_persisted' | 'result_unavailable') => {
    try {
      runtime.report(code);
    } catch {
      /* Observability cannot change persistence. */
    }
  };
  const flush = (): Promise<void> => {
    if (active) return active;

    cancel?.();
    cancel = null;
    active = (async () => {
      for (const [id, record] of pending) {
        if (!record) continue;

        try {
          await persist(record);
          pending.delete(id);
          report('result_persisted');
        } catch {
          report('result_unavailable');
          break;
        }
      }
    })().finally(() => {
      active = null;

      if (!stopping && [...pending.values()].some((value) => value !== null))
        cancel = runtime.schedule(1000, () => {
          void flush();
        });
    });

    return active;
  };
  const writer: ResultWriter = {
    policyVersion,
    reserve(id) {
      if (stopping || pending.has(id) || pending.size >= maximum)
        throw new Error('PERSISTENCE_UNAVAILABLE');

      pending.set(id, null);
    },
    release(id) {
      pending.delete(id);
    },
    write(record) {
      if (pending.get(record.id) !== null) return;

      pending.set(record.id, structuredClone(record));
      void flush();
    },
  };

  return {
    writer,
    flush,
    size: () => pending.size,
    close() {
      closed ??= (async () => {
        stopping = true;
        cancel?.();
        cancel = null;
        await active;
        await flush();

        if ([...pending.values()].some((value) => value !== null))
          throw new Error('UNFLUSHED_RESULTS');
      })();

      return closed;
    },
  };
}
