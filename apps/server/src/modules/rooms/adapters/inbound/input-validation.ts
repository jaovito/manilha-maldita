import { clientMessageSchema, nicknameSchema, roomConfigSchema } from '@truco/game-protocol';
import type { RoomInputValidation } from '../../application/ports/input-validation';

export const protocolValidation: RoomInputValidation = {
  nickname(value) {
    nicknameSchema.parse(value);
  },
  configuration(value) {
    return roomConfigSchema.parse(value);
  },
  command(value) {
    const parsed = clientMessageSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  },
};
