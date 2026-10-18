import { afterEach, expect, test } from 'bun:test';
import { backendUrl } from './backend-url';

const originalLocation = location.href;
afterEach(() => {
  location.href = originalLocation;
});

test('empty configuration preserves local HTTP proxy and derives WS from the page', () => {
  location.href = 'http://localhost:5173/room/ABC123';
  expect(backendUrl('/guest', false, '')).toBe('/api/guest');
  expect(backendUrl('/rooms/ABC123/ws', true, '  ')).toBe(
    'ws://localhost:5173/api/rooms/ABC123/ws',
  );
  location.href = 'https://jogo.example/';
  expect(backendUrl('/rooms/ABC123/ws', true, '')).toBe('wss://jogo.example/api/rooms/ABC123/ws');
});

test('one backend origin configures both HTTP and WS without duplicate slashes', () => {
  for (const base of ['https://api.example', ' https://api.example/ ']) {
    expect(backendUrl('/guest', false, base)).toBe('https://api.example/api/guest');
    expect(backendUrl('/rooms/ABC123/ws', true, base)).toBe(
      'wss://api.example/api/rooms/ABC123/ws',
    );
  }
  expect(backendUrl('/rooms/ABC123/ws', true, 'http://localhost:3001')).toBe(
    'ws://localhost:3001/api/rooms/ABC123/ws',
  );
});

test('invalid configuration is rejected without echoing credentials or arbitrary data', () => {
  for (const base of [
    '/api',
    'not-a-url',
    'ftp://api.example',
    'wss://api.example',
    'https://secret:password@api.example',
    'https://api.example/api',
    'https://api.example/?token=secret',
    'https://api.example/#secret',
  ]) {
    expect(() => backendUrl('/guest', false, base)).toThrow(
      'VITE_BACKEND_URL deve ser uma origem HTTP(S), sem caminho ou credenciais.',
    );
  }
});
