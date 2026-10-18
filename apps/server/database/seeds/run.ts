import type { LocalDatabase, SeedTransaction } from '../connect';

export type SeedTask = {
  id: string;
  run: (transaction: SeedTransaction) => Promise<void>;
};

export async function runSeeds(database: LocalDatabase, tasks: readonly SeedTask[]) {
  const identifiers = new Set<string>();
  for (const task of tasks) {
    if (!task.id.trim() || identifiers.has(task.id))
      throw new Error('Seed IDs must be nonempty and unique.');
    identifiers.add(task.id);
  }
  if (tasks.length === 0) return [];
  return database.transaction(async (transaction) => {
    for (const task of tasks) await task.run(transaction);
    return tasks.map((task) => task.id);
  });
}
