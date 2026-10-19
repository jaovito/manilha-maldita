import { DEFAULT_ORIGINS, type ServerOptions, startServer } from './runtime';

type ServerEnvironment = Readonly<Record<string, string | undefined>>;

export function parseServerOptions(env: ServerEnvironment): ServerOptions {
  for (const key of ['ENABLE_SOLO', 'ENABLE_DEV_TOOLS']) {
    if (env[key] !== undefined && env[key] !== 'true' && env[key] !== 'false')
      throw new Error('INVALID_FEATURE_FLAG');
  }
  const hostname = env.HOST ?? '127.0.0.1';
  const portText = env.PORT ?? '3001';
  if (!/^[a-zA-Z0-9.:-]+$/.test(hostname)) throw new Error('INVALID_HOST');
  if (!/^\d+$/.test(portText)) throw new Error('INVALID_PORT');
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_PORT');
  const secureText = env.SECURE_COOKIES ?? 'false';
  if (secureText !== 'true' && secureText !== 'false') throw new Error('INVALID_SECURE_COOKIES');
  const origins =
    env.ALLOWED_ORIGINS === undefined
      ? [...DEFAULT_ORIGINS]
      : env.ALLOWED_ORIGINS.split(',').map((origin) => {
          try {
            const url = new URL(origin.trim());
            if (
              (url.protocol !== 'http:' && url.protocol !== 'https:') ||
              url.username ||
              url.password ||
              url.pathname !== '/' ||
              url.search ||
              url.hash
            )
              throw new Error('INVALID_ORIGIN');
            return url.origin;
          } catch {
            throw new Error('INVALID_ALLOWED_ORIGINS');
          }
        });
  return {
    hostname,
    port,
    environment: env.NODE_ENV ?? 'production',
    soloEnabled: env.ENABLE_SOLO === 'true',
    devTools: env.NODE_ENV === 'development' && env.ENABLE_DEV_TOOLS === 'true',
    allowedOrigins: [...new Set(origins)],
    secureCookies: secureText === 'true',
  };
}

export function main(env: ServerEnvironment = Bun.env) {
  return startServer(parseServerOptions(env));
}

if (import.meta.main) main();
