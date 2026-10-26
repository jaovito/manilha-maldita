import { mock } from 'bun:test';
import type { PlayerCatalog, PlayerProgress } from '@truco/game-protocol';
import type { PlayerController } from '../hooks/use-player';

export const profile: PlayerProgress = {
  nickname: 'Ana',
  xp: '1150',
  level: '3',
  competitivePoints: '20',
  appearance: {
    avatar: { id: 'avatar-1', avatarUrl: '/art/avatars-pixel.png', spriteIndex: 0 },
    deck: { id: 'classic', assetKey: 'classic' },
    table: { id: 'classic', assetKey: 'classic' },
  },
};
export const catalog: PlayerCatalog = {
  xpPerLevel: '500',
  avatars: [0, 1, 2, 3].map((spriteIndex) => ({
    id: `avatar-${spriteIndex + 1}`,
    avatarUrl: '/art/avatars-pixel.png',
    spriteIndex,
    name: `Avatar ${spriteIndex + 1}`,
    requiredLevel: spriteIndex + 1,
  })),
  decks: (['classic', 'ember', 'arcane'] as const).map((id, i) => ({
    id,
    assetKey: id,
    name: ['Clássico', 'Brasa', 'Arcano'][i] ?? id,
    requiredLevel: [1, 2, 4][i] ?? 1,
    style: {
      backUrl:
        id === 'classic'
          ? '/art/card-back.png'
          : id === 'ember'
            ? '/art/cosmetics/deck-ember.png'
            : '/art/cosmetics/deck-arcane.png',
      rankStyle: i ? 'engraved' : 'pixel',
      suitStyle: i ? 'angular' : 'classic',
      palette: id === 'classic' ? 'parchment' : id,
    },
  })),
  tables: (['classic', 'burgundy', 'midnight'] as const).map((id, i) => ({
    id,
    assetKey: id,
    name: ['Clássica', 'Vinho', 'Meia-noite'][i] ?? id,
    requiredLevel: [1, 3, 5][i] ?? 1,
    style: { felt: id === 'classic' ? 'green' : id, frame: 'wood' },
  })),
};
export function controller(value: PlayerProgress | null = profile): PlayerController {
  return {
    profile: value,
    pending: false,
    loading: false,
    error: '',
    refresh: mock(async () => {}),
    clearError: mock(() => {}),
    authenticate: mock(async () => {}),
    select: mock(async () => {}),
    rename: mock(async () => {}),
    recovery: mock(async () => 'a'.repeat(64)),
    maintain: mock(async () => {}),
    logout: mock(async () => {}),
  };
}
export function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function mockFetch(
  implementation: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>,
) {
  return Object.assign(mock(implementation), { preconnect: fetch.preconnect });
}
