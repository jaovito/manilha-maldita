import { expect, test } from 'bun:test';
import {
  AUDIO_PREFERENCES_KEY,
  defaultAudioPreferences,
  loadAudioPreferences,
  saveAudioPreferences,
} from './preferences';

test('audio preferences persist only validated mute and bounded volume', () => {
  expect(loadAudioPreferences()).toEqual(defaultAudioPreferences);
  saveAudioPreferences({ muted: true, volume: 0 });
  expect(loadAudioPreferences()).toEqual({ muted: true, volume: 0 });
  localStorage.setItem(AUDIO_PREFERENCES_KEY, '{"muted":false,"volume":1,"cards":"ignored"}');
  expect(loadAudioPreferences()).toEqual({ muted: false, volume: 1 });
  for (const value of [
    'null',
    '[]',
    '{}',
    'false',
    '{"muted":"true","volume":0.5}',
    '{"muted":false,"volume":-1}',
    '{"muted":false,"volume":1.1}',
    'broken',
  ]) {
    localStorage.setItem(AUDIO_PREFERENCES_KEY, value);
    expect(loadAudioPreferences()).toEqual(defaultAudioPreferences);
  }
});

test('blocked storage falls back safely without blocking preference changes', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  try {
    expect(loadAudioPreferences()).toEqual(defaultAudioPreferences);
    expect(() => saveAudioPreferences({ muted: true, volume: 1 })).not.toThrow();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
  }
});
