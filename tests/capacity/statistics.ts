export function distribution(samples: readonly number[]) {
  if (!samples.length || samples.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error('INVALID_CAPACITY_SAMPLES');

  const sorted = [...samples].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0;

  return { count: sorted.length, p50: at(0.5), p95: at(0.95), maximum: sorted.at(-1) ?? 0 };
}
