import type { MemberIdentity } from '../domain/room';
import type { RoomInputValidation } from './ports/input-validation';
import type { RoomPort } from './ports/room-port';
import type { RoomRepository } from './ports/room-repository';
import type { Ports, RoomOptions } from './ports/runtime';
import { executeRoomCommand } from './services/command-executor';
import { RoomLifecycle } from './services/room-lifecycle';
import type { RoomContext } from './use-cases/context';
import { connect } from './use-cases/membership/connect-member';
import { create } from './use-cases/membership/create-room';
import { disconnect } from './use-cases/membership/disconnect-member';
import { join } from './use-cases/membership/join-room';

/** Input boundary. Use cases and background work share this composed context. */
export class RoomApplication implements RoomPort {
  private readonly context: RoomContext;

  constructor(
    ports: Ports,
    options: RoomOptions,
    rooms: RoomRepository,
    validation: RoomInputValidation,
  ) {
    this.context = {
      ports,
      options,
      rooms,
      validation,
      lifecycle: new RoomLifecycle(rooms, ports),
    };
  }

  create(...args: Parameters<RoomPort['create']>) {
    return create(this.context, ...args);
  }

  join(...args: Parameters<RoomPort['join']>) {
    return join(this.context, ...args);
  }

  connect(...args: Parameters<RoomPort['connect']>) {
    return connect(this.context, ...args);
  }

  disconnect(...args: Parameters<RoomPort['disconnect']>) {
    return disconnect(this.context, ...args);
  }

  receive(...args: Parameters<RoomPort['receive']>) {
    return executeRoomCommand(this.context, ...args);
  }

  async updateIdentity(
    sessionId: string,
    identity: MemberIdentity,
    nickname?: string,
  ): Promise<void> {
    for (const room of this.context.rooms.values()) {
      if (!room.state.seats.some((member) => member?.sessionId === sessionId)) continue;

      try {
        await this.context.lifecycle.enqueue(room, () => {
          const member = room.state.seats.find((entry) => entry?.sessionId === sessionId);

          if (!member || member.identity?.accountId !== identity.accountId) return;

          member.identity = structuredClone(identity);
          if (nickname !== undefined) member.nickname = nickname;

          if (room.state.status === 'lobby') {
            room.state.revision++;
            this.context.lifecycle.publish(room);
          }
        });
      } catch (error) {
        // A room may expire while an earlier membership update waits in its own queue.
        if (!(error instanceof Error) || error.message !== 'ROOM_NOT_FOUND') throw error;
      }
    }
  }

  close(): void {
    this.context.lifecycle.close();
  }
}
