// Asserts the production TypeScript environment stays independent of runtime globals.
export {};

// @ts-expect-error Browser APIs must not be ambient in pure packages.
void document;
// @ts-expect-error Bun APIs must not be ambient in pure packages.
void Bun;
// @ts-expect-error Node globals must not be ambient in pure packages.
void process;
