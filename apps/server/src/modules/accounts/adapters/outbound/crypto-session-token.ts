const SESSION_TOKEN_BYTES = 32;
const INVALID_TOKEN_CHARACTER = /[^a-f0-9]/;

/** Return the bearer only to cookie issuance; persist only tokenHash. */
export async function createAccountSessionToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES));
  const token = bytesToHex(bytes);
  const tokenHash = await digestToken(token);

  return { token, tokenHash };
}

export async function hashAccountSessionToken(token: unknown): Promise<string | null> {
  if (
    typeof token !== 'string' ||
    token.length !== SESSION_TOKEN_BYTES * 2 ||
    INVALID_TOKEN_CHARACTER.test(token)
  )
    return null;

  return digestToken(token);
}

async function digestToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));

  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
