export type GuestSession = Readonly<{ id: string; nickname: string; expiresAt: number }>;

export function isSessionActive(session: GuestSession, time: number): boolean {
  return session.expiresAt > time;
}
