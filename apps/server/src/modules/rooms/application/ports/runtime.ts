export type Clock = { now(): number };
export type Identifiers = { id(): string };
export type Entropy = { randomInt(exclusiveMax: number): number };
export type Scheduler = { schedule(at: number, callback: () => void): () => void };

/** Injected capabilities; the application does not read global time or random sources. */
export type Ports = Clock & Identifiers & Entropy & Scheduler;
export type RoomOptions = { soloEnabled?: boolean; devTools?: boolean };
