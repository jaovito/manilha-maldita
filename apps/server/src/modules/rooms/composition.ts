import { protocolValidation } from './adapters/inbound/input-validation';
import { InMemoryRoomRepository } from './adapters/outbound/memory/room-repository';
import type { Ports, RoomOptions } from './application/ports/runtime';
import { RoomApplication } from './application/room-application';

/** Compose concrete capabilities once; all entry points share the same room authority. */
export function createRoomService(ports: Ports, options: RoomOptions = {}): RoomApplication {
  return new RoomApplication(ports, options, new InMemoryRoomRepository(), protocolValidation);
}
