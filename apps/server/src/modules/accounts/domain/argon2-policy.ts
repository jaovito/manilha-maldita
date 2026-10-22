export type Argon2Policy = Readonly<{
  memoryKiB: number;
  iterations: number;
  maxMemoryKiB: number;
  maxIterations: number;
}>;

/** Fixed safety bounds complement deployment-specific settings; never accept arbitrary PHC costs. */
export function validateArgon2Policy(policy: Argon2Policy): void {
  if (
    !Number.isSafeInteger(policy.memoryKiB) ||
    !Number.isSafeInteger(policy.maxMemoryKiB) ||
    !Number.isSafeInteger(policy.iterations) ||
    !Number.isSafeInteger(policy.maxIterations) ||
    policy.memoryKiB < 19_456 ||
    policy.maxMemoryKiB < policy.memoryKiB ||
    policy.maxMemoryKiB > 262_144 ||
    policy.iterations < 2 ||
    policy.maxIterations < policy.iterations ||
    policy.maxIterations > 10
  )
    throw new Error('INVALID_ARGON2_POLICY');
}

export function isPasswordPepper(value: unknown): value is string {
  return typeof value === 'string' && value.length === 64 && !/[^a-f0-9]/.test(value);
}
