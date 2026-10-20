import type { RoomConfig } from './room';

/** Preset policy shared by creation and lobby configuration; input is validated at the edge. */
export function normalizeConfig(config: RoomConfig): RoomConfig {
  return config.preset === 'competitive'
    ? { ...config, cardTimeoutMs: 20000, responseTimeoutMs: 15000, preparationTimeoutMs: 10000 }
    : { ...config };
}
