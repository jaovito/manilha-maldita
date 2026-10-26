import type { MatchRecord } from '../../../progression';

export type ResultWriter = Readonly<{
  policyVersion: string;
  reserve(matchId: string): void;
  release(matchId: string): void;
  write(record: MatchRecord): void;
}>;
