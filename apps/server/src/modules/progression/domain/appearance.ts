export type PlayerAppearance = Readonly<{
  avatar: Readonly<{ id: string; avatarUrl: '/art/avatars-pixel.png'; spriteIndex: number }>;
  deck: Readonly<{ id: 'classic' | 'ember' | 'arcane'; assetKey: 'classic' | 'ember' | 'arcane' }>;
  table: Readonly<{
    id: 'classic' | 'burgundy' | 'midnight';
    assetKey: 'classic' | 'burgundy' | 'midnight';
  }>;
}>;

export const avatarDefinitions = [
  {
    id: 'avatar-1',
    name: 'Avatar 1',
    avatarUrl: '/art/avatars-pixel.png',
    spriteIndex: 0,
    requiredLevel: 1,
  },
  {
    id: 'avatar-2',
    name: 'Avatar 2',
    avatarUrl: '/art/avatars-pixel.png',
    spriteIndex: 1,
    requiredLevel: 2,
  },
  {
    id: 'avatar-3',
    name: 'Avatar 3',
    avatarUrl: '/art/avatars-pixel.png',
    spriteIndex: 2,
    requiredLevel: 3,
  },
  {
    id: 'avatar-4',
    name: 'Avatar 4',
    avatarUrl: '/art/avatars-pixel.png',
    spriteIndex: 3,
    requiredLevel: 4,
  },
] as const;

/** Trusted rendering tokens; full deck themes include backs, ranks and suits. Never player CSS. */
export const deckDefinitions = [
  {
    id: 'classic',
    name: 'Clássico',
    assetKey: 'classic',
    requiredLevel: 1,
    style: {
      backUrl: '/art/card-back.png',
      rankStyle: 'pixel',
      suitStyle: 'classic',
      palette: 'parchment',
    },
  },
  {
    id: 'ember',
    name: 'Brasa',
    assetKey: 'ember',
    requiredLevel: 2,
    style: {
      backUrl: '/art/cosmetics/deck-ember.png',
      rankStyle: 'engraved',
      suitStyle: 'angular',
      palette: 'ember',
    },
  },
  {
    id: 'arcane',
    name: 'Arcano',
    assetKey: 'arcane',
    requiredLevel: 4,
    style: {
      backUrl: '/art/cosmetics/deck-arcane.png',
      rankStyle: 'ornate',
      suitStyle: 'runic',
      palette: 'arcane',
    },
  },
] as const;

export const tableDefinitions = [
  {
    id: 'classic',
    name: 'Clássica',
    assetKey: 'classic',
    requiredLevel: 1,
    style: { felt: 'green', frame: 'wood' },
  },
  {
    id: 'burgundy',
    name: 'Vinho',
    assetKey: 'burgundy',
    requiredLevel: 3,
    style: { felt: 'burgundy', frame: 'wood' },
  },
  {
    id: 'midnight',
    name: 'Meia-noite',
    assetKey: 'midnight',
    requiredLevel: 5,
    style: { felt: 'midnight', frame: 'gold' },
  },
] as const;

export function appearanceFor(
  avatarId: string | null,
  deckId: string | null,
  tableId: string | null,
): PlayerAppearance {
  const avatar = avatarDefinitions.find((entry) => entry.id === avatarId) ?? avatarDefinitions[0];
  const deck = deckDefinitions.find((entry) => entry.id === deckId) ?? deckDefinitions[0];
  const table = tableDefinitions.find((entry) => entry.id === tableId) ?? tableDefinitions[0];

  return {
    avatar: { id: avatar.id, avatarUrl: avatar.avatarUrl, spriteIndex: avatar.spriteIndex },
    deck: { id: deck.id, assetKey: deck.assetKey },
    table: { id: table.id, assetKey: table.assetKey },
  };
}
