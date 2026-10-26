import { cosmeticCatalogSeed } from './catalogs';
import type { SeedTask } from './run';

// Register deterministic, idempotent product seeds as their models are introduced.
// Test fixtures are registered by each integration test, never in development.
export const developmentSeeds: readonly SeedTask[] = [cosmeticCatalogSeed];
