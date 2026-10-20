/** The opaque public identity is independent from the HttpOnly bearer credential. */
export function createSessionCredentials() {
  return {
    token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    id: crypto.randomUUID(),
  };
}
