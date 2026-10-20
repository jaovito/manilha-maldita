import type { ServerMessage } from '../dto/room-snapshot';

export type Sink = { send(message: ServerMessage): void; close(): void };
