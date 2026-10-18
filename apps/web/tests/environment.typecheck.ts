// Browser production code must not depend on the backend runtime.
export {};

// @ts-expect-error Bun globals are intentionally unavailable in browser code.
void Bun;
// @ts-expect-error Node globals are intentionally unavailable in browser code.
void process;
