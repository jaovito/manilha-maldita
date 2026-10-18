import { afterEach, expect, test } from 'bun:test';
import { loadNickname, NICKNAME_KEY, saveNickname } from './nickname';

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('nickname preference validates stored text and clears empty or invalid edits', () => {
  expect(loadNickname()).toBe('');
  saveNickname('  João Dias  ');
  expect(loadNickname()).toBe('João Dias');
  expect(localStorage.getItem(NICKNAME_KEY)).toBe('João Dias');

  for (const invalid of ['', '   ', '<script>', 'x'.repeat(25)]) {
    localStorage.setItem(NICKNAME_KEY, invalid);
    expect(loadNickname()).toBe('');
    saveNickname(invalid);
    expect(localStorage.getItem(NICKNAME_KEY)).toBeNull();
  }
});

test('blocked storage never prevents reading or editing a nickname', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage blocked');
    },
  });

  expect(loadNickname()).toBe('');
  expect(() => saveNickname('Ana')).not.toThrow();
  expect(() => saveNickname('')).not.toThrow();
});

test('write and removal failures do not turn preference storage into a requirement', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => 'Ana',
      setItem() {
        throw new Error('Quota exceeded');
      },
      removeItem() {
        throw new Error('Write blocked');
      },
    },
  });

  expect(loadNickname()).toBe('Ana');
  expect(() => saveNickname('Beto')).not.toThrow();
  expect(() => saveNickname('')).not.toThrow();
});
