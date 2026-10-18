import { pgSchema } from 'drizzle-orm/pg-core';

// Namespace reserved for future application tables. No product models are invented here.
export const app = pgSchema('app');
