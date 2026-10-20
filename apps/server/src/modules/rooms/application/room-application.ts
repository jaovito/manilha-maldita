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

  close(): void {
    this.context.lifecycle.close();
  }
}
