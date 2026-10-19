import { t } from '../i18n';
export function backendUrl(
  path: string,
  websocket = false,
  configured: string | undefined = import.meta.env?.VITE_BACKEND_URL,
): string {
  const base = configured?.trim();
  let origin = location.origin;

  if (base) {
    try {
      const url = new URL(base);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        throw new Error();
      }
      origin = url.origin;
    } catch {
      throw new Error(
        t('VITE_BACKEND_URL deve ser uma origem HTTP(S), sem caminho ou credenciais.'),
      );
    }
  }

  if (!websocket) return base ? `${origin}/api${path}` : `/api${path}`;

  const url = new URL(`/api${path}`, origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
