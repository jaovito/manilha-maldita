/** Operational request hints, never an authentication or device identity. */
export type AuthAuditContext = Readonly<{
  clientIp: string | null;
  clientContext: Readonly<{ userAgent?: string; clientVersion?: string }>;
}>;
