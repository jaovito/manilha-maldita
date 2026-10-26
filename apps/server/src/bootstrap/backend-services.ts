import type { AccountApplication } from '../modules/accounts';
import type { AccountMaintenance } from '../modules/accounts/application/account-maintenance';
import type { PlayerApplication } from '../modules/progression';
import type { ResultWriter } from '../modules/rooms';

export type BackendServices = Readonly<{
  accounts: AccountApplication;
  maintenance: AccountMaintenance;
  players: PlayerApplication;
  results: ResultWriter;
  leaseMs: number;
  ready(): boolean;
  close(): Promise<void>;
}>;
