import { isCommonPassword } from '../modules/accounts/domain/password-blocklist';
import type { ServerEnvironment } from './environment';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PASSWORDS = 100_000;

/** Optional reviewed local plaintext list; passwords are never sent to an external lookup service. */
export async function loadPasswordBlocklist(
  env: ServerEnvironment,
): Promise<(password: string) => boolean> {
  const path = env.PASSWORD_BLOCKLIST_FILE;

  if (path === undefined) return isCommonPassword;

  try {
    if (!path || path.length > 4096) throw new Error();

    const file = Bun.file(path);

    if (file.size > MAX_FILE_BYTES) throw new Error();

    const text = await file.text();

    if (Buffer.byteLength(text) > MAX_FILE_BYTES) throw new Error();

    const values = text.split(/\r?\n/).filter((value) => value.length > 0);

    if (values.length > MAX_PASSWORDS || values.some((value) => Array.from(value).length > 128))
      throw new Error();

    const blocked = new Set(values.map((value) => value.toLowerCase()));

    return (password) => isCommonPassword(password) || blocked.has(password.toLowerCase());
  } catch {
    throw new Error('INVALID_PASSWORD_BLOCKLIST');
  }
}
