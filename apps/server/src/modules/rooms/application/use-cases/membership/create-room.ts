import type { MemberIdentity, RoomConfig } from '../../../domain/room';
import { createRoom } from '../../services/lobby/creation';
import type { RoomContext } from '../context';

export async function create(
  context: RoomContext,
  sessionId: string,
  nickname: string,
  input: RoomConfig,
  solo = false,
  identity?: MemberIdentity,
): Promise<{ code: string }> {
  const room = createRoom(
    { sessionId, nickname, config: input, solo, ...(identity ? { identity } : {}) },
    context.rooms,
    context.ports,
    context.options,
    context.validation,
  );
  const { code } = room.state;

  context.rooms.set(code, room);
  context.lifecycle.schedule(room);

  return { code };
}
