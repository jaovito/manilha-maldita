import type { ClientMessage, CommandReply, RoomConfig, ServerMessage } from '@truco/game-protocol';
export interface RoomPort {
  create(
    sessionId: string,
    nickname: string,
    config: RoomConfig,
    solo?: boolean,
  ): Promise<{ code: string }>;
  join(code: string, sessionId: string, nickname: string): Promise<void>;
  connect(
    code: string,
    sessionId: string,
    sink: { send(message: ServerMessage): void; close(): void },
  ): Promise<string>;
  disconnect(code: string, sessionId: string, connectionId: string): Promise<void>;
  receive(
    code: string,
    sessionId: string,
    connectionId: string,
    message: ClientMessage,
  ): Promise<CommandReply>;
}
