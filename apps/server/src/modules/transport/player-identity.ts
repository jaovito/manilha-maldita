import type { MemberIdentity } from '../rooms';
import type { GuestSession } from '../sessions';

export type PlayerSession = GuestSession &
  Readonly<{
    identity?: MemberIdentity;
    credentialId?: string;
  }>;

export type PlayerAuthenticator = Readonly<{
  resolve(
    guestToken: string | undefined,
    accountToken: string | undefined,
  ): Promise<PlayerSession | undefined>;
  retain(session: PlayerSession, close: () => void): () => void;
  valid(session: PlayerSession): boolean;
}>;
