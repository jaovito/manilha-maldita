export type JobOutcome = 'idle' | 'completed' | 'retry' | 'failed';

export type JobQueue = Readonly<{
  runNext(): Promise<JobOutcome>;
  subscribe(wake: () => void): Promise<() => Promise<void>>;
}>;

export type WorkerEvent = Exclude<JobOutcome, 'idle'> | 'queue_unavailable';

export type WorkerRuntime = Readonly<{
  schedule(delayMs: number, callback: () => void): () => void;
  report(event: WorkerEvent): void;
}>;

export type WorkerOptions = Readonly<{ pollIntervalMs?: number; maxJobsPerWake?: number }>;
