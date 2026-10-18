import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';

// Disposable transport fixture, not a product endpoint or multiplayer implementation.
test('Hono handles HTTP and WebSocket traffic on the pinned Bun runtime', async () => {
  const app = new Hono();
  app.get('/health', (context) => context.json({ status: 'ok' }));
  app.get(
    '/socket',
    upgradeWebSocket(() => ({
      onMessage(event, socket) {
        socket.send(event.data.toString());
      },
    })),
  );
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: app.fetch, websocket });
  let client: WebSocket | undefined;
  try {
    const response = await fetch(new URL('/health', server.url));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    const address = new URL('/socket', server.url);
    address.protocol = 'ws:';
    const message = await new Promise<string>((resolve, reject) => {
      client = new WebSocket(address);
      client.onopen = () => client?.send('transport-smoke');
      client.onmessage = (event) => resolve(String(event.data));
      client.onerror = () => reject(new Error('WebSocket fixture connection failed'));
    });
    expect(message).toBe('transport-smoke');
  } finally {
    client?.close();
    await server.stop(true);
  }
});
