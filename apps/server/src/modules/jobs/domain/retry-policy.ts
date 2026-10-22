export type RetryPolicy = Readonly<{ baseDelayMs: number; maxDelayMs: number }>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = { baseDelayMs: 1_000, maxDelayMs: 60_000 };

export function validateRetryPolicy(policy: RetryPolicy) {
  if (
    !Number.isSafeInteger(policy.baseDelayMs) ||
    !Number.isSafeInteger(policy.maxDelayMs) ||
    policy.baseDelayMs < 1 ||
    policy.maxDelayMs < policy.baseDelayMs ||
    policy.maxDelayMs > 86_400_000
  )
    throw new Error('INVALID_RETRY_POLICY');
}

export function retryDelay(attempt: number, policy: RetryPolicy): number {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 100)
    throw new Error('INVALID_JOB_ATTEMPT');

  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
}
