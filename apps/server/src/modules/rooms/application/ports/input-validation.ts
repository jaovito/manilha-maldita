import type { RoomConfig } from '../../domain/room';
import type { RoomCommand } from '../dto/commands';

/** Edge validation is deferred until the command owns its room's serial position. */
export interface RoomInputValidation {
  nickname(value: string): void;
  configuration(value: RoomConfig): RoomConfig;
  command(value: unknown): RoomCommand | null;
}
