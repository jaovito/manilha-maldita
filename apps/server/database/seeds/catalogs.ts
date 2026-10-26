import {
  avatarDefinitions,
  deckDefinitions,
  tableDefinitions,
} from '../../src/modules/progression';
import { avatars, deckThemes, tableThemes } from '../schema';
import type { SeedTask } from './run';

export const cosmeticCatalogSeed: SeedTask = {
  id: 'cosmetic-catalog-v1',
  async run(tx) {
    for (const [index, item] of avatarDefinitions.entries()) {
      await tx
        .insert(avatars)
        .values({
          id: item.id,
          name: item.name,
          avatarUrl: item.avatarUrl,
          spriteIndex: item.spriteIndex,
          requiredLevel: item.requiredLevel,
          sortOrder: index,
        })
        .onConflictDoNothing();
    }

    for (const [index, item] of deckDefinitions.entries())
      await tx
        .insert(deckThemes)
        .values({
          id: item.id,
          name: item.name,
          assetKey: item.assetKey,
          requiredLevel: item.requiredLevel,
          sortOrder: index,
        })
        .onConflictDoNothing();

    for (const [index, item] of tableDefinitions.entries())
      await tx
        .insert(tableThemes)
        .values({
          id: item.id,
          name: item.name,
          assetKey: item.assetKey,
          requiredLevel: item.requiredLevel,
          sortOrder: index,
        })
        .onConflictDoNothing();
  },
};
