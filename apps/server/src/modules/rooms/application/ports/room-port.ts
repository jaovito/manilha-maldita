import type { MemberIdentity, RoomConfig } from '../../domain/room';
import type { CommandReply } from '../dto/commands';
import type { Sink } from './room-publisher';

export interface RoomPort {
  create(
    sessionId: string,
    nickname: string,
    config: RoomConfig,
    solo?: boolean,
    identity?: MemberIdentity,
  ): Promise<{ code: string }>;

  join(code: string, sessionId: string, nickname: string, identity?: MemberIdentity): Promise<void>;

  connect(code: string, sessionId: string, sink: Sink): Promise<string>;

  disconnect(code: string, sessionId: string, connectionId: string): Promise<void>;

  receive(
    code: string,
    sessionId: string,
    connectionId: string,
    message: unknown,
    authorized?: () => boolean,
  ): Promise<CommandReply>;
}
