import type { RoomInputValidation } from '../ports/input-validation';
import type { RoomRepository } from '../ports/room-repository';
import type { Ports, RoomOptions } from '../ports/runtime';
import type { RoomLifecycle } from '../services/room-lifecycle';

export type RoomContext = {
  validation: RoomInputValidation;
  lifecycle: RoomLifecycle;
  ports: Ports;
  options: RoomOptions;
  rooms: RoomRepository;
};
