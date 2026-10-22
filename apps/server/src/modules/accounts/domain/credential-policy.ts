export const MIN_PASSWORD_CHARACTERS = 15;
export const MAX_PASSWORD_CHARACTERS = 128;

/** Login names are canonical identifiers; passwords are never trimmed or normalized. */
export function isLoginName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 3 &&
    value.length <= 32 &&
    !/[^a-z0-9_]/.test(value)
  );
}

export function isPassword(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length < MIN_PASSWORD_CHARACTERS ||
    value.length > MAX_PASSWORD_CHARACTERS * 2 ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    return false;

  const characters = Array.from(value).length;

  return characters >= MIN_PASSWORD_CHARACTERS && characters <= MAX_PASSWORD_CHARACTERS;
}
