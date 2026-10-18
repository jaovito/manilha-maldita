import { afterEach, expect, mock, test } from 'bun:test';
import { request } from './client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function respond(body: unknown, status = 400) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => new Response(JSON.stringify(body), { status })),
  });
}

test('HTTP errors provide safe instructions for recognized failures', async () => {
  for (const [code, instruction] of [
    ['FORBIDDEN_ORIGIN', 'endereço não está autorizado'],
    ['UNAUTHENTICATED', 'sessão expirou'],
    ['ROOM_CAPACITY', 'servidor está cheio'],
    ['SESSION_CAPACITY', 'Saia de uma sala anterior'],
    ['ROOM_NOT_FOUND', 'Sala não encontrada'],
    ['ROOM_FULL', 'sala está cheia'],
    ['ROOM_CLOSED', 'não aceita mais jogadores'],
    ['RATE_LIMITED', 'Aguarde um minuto'],
  ]) {
    respond({ code, detail: 'private server detail' });
    await expect(request('/rooms', {})).rejects.toThrow(instruction);
  }

  respond({ code: 'SESSION_CAPACITY' });
  await expect(request('/guest', { nickname: 'Ana' })).rejects.toThrow('servidor está cheio');
  respond({ code: 'INVALID_MESSAGE' });
  await expect(request('/guest', { nickname: '♥' })).rejects.toThrow('Use um apelido');
});

test('unknown and malformed HTTP errors never echo arbitrary server payloads', async () => {
  for (const body of [
    null,
    {},
    { code: 42 },
    { code: 'private detail' },
    { code: 'constructor' },
  ]) {
    respond(body);
    await expect(request('/rooms', {})).rejects.toThrow(
      'Não foi possível concluir. Confira os dados e tente novamente.',
    );
  }

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => new Response('<html>private detail</html>', { status: 502 })),
  });
  await expect(request('/rooms', {})).rejects.toThrow('Não foi possível concluir.');
});

test('connection failures explain that the server could not be reached', async () => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => {
      throw new Error('private network detail');
    }),
  });

  await expect(request('/rooms', {})).rejects.toThrow('Não foi possível conectar ao servidor.');
});
