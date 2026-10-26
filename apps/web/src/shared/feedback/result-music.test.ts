import { afterEach, expect, mock, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { GameAudio } from './audio';
import { installAudio, TestAudioContext } from './audio.test';
import { ResultMusic } from './result-music';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const preferences = { muted: false, volume: 0.4 };
function fixture() {
  installAudio();
  const music = new ResultMusic(new AudioContext());
  const context = TestAudioContext.instances.at(-1);
  if (!context) throw new Error('MISSING_AUDIO_CONTEXT');
  return { music, context };
}
function files() {
  const fetch = Object.assign(
    mock(async () => new Response(new Uint8Array([1, 2, 3]))),
    { preconnect: originalFetch.preconnect },
  );
  globalThis.fetch = fetch;
  return fetch;
}

test('approved music preloads once, selects distinct buffers and follows live volume/mute changes', async () => {
  const fetch = files();
  const { music, context } = fixture();
  expect(music.play('matchWin', preferences)).toBe(false);
  const loaded = music.preload();
  expect(music.preload()).toBe(loaded);
  await loaded;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(context.decodeAudioData).toHaveBeenCalledTimes(2);
  expect(music.play('matchWin', { muted: true, volume: 1 })).toBe(false);
  expect(music.play('matchWin', { muted: false, volume: 0 })).toBe(false);
  context.state = 'suspended';
  expect(music.play('matchWin', preferences)).toBe(false);
  context.state = 'running';
  expect(music.play('matchWin', preferences)).toBe(true);
  const win = context.sources[0];
  expect(win?.start).toHaveBeenCalledTimes(1);
  expect(context.gains[0]?.gain.setValueAtTime).toHaveBeenCalledWith(0.4, 2);
  music.updatePreferences({ muted: false, volume: 0.2 });
  expect(context.gains[0]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, 2);
  win?.onended?.();
  music.silence();
  expect(win?.stop).not.toHaveBeenCalled();
  expect(music.play('matchLose', preferences)).toBe(true);
  expect(context.sources[1]?.buffer).not.toBe(win?.buffer);
  music.updatePreferences({ muted: true, volume: 0.4 });
  expect(context.sources[1]?.stop).toHaveBeenCalledTimes(1);
  expect(music.play('matchWin', preferences)).toBe(true);
  expect(music.play('matchLose', preferences)).toBe(true);
  expect(context.sources[2]?.stop).toHaveBeenCalledTimes(1);
  music.close();
  await music.preload();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(music.play('matchWin', preferences)).toBe(false);
});

test('failed and oversized media do not block feedback or create a delayed playback', async () => {
  const { music, context } = fixture();
  globalThis.fetch = Object.assign(
    mock(async () => new Response('', { status: 404 })),
    { preconnect: originalFetch.preconnect },
  );
  await music.preload();
  expect(music.play('matchWin', preferences)).toBe(false);
  expect(context.decodeAudioData).not.toHaveBeenCalled();
  music.close();

  files();
  const invalid = fixture();
  invalid.context.decodeAudioData
    .mockResolvedValueOnce({ duration: 4.1 })
    .mockResolvedValueOnce({ duration: 0 });
  await invalid.music.preload();
  expect(invalid.music.play('matchWin', preferences)).toBe(false);
  expect(invalid.music.play('matchLose', preferences)).toBe(false);
  invalid.music.close();
});

test('closing during loading discards completion; audio-device errors fall back safely', async () => {
  let release = () => {};
  const gate = new Promise<void>((done) => {
    release = done;
  });
  globalThis.fetch = Object.assign(
    mock(async () => {
      await gate;
      return new Response(new Uint8Array([1]));
    }),
    { preconnect: originalFetch.preconnect },
  );
  const pending = fixture();
  const loading = pending.music.preload();
  pending.music.close();
  release();
  await loading;
  expect(pending.music.play('matchWin', preferences)).toBe(false);

  files();
  const { music, context } = fixture();
  await music.preload();
  expect(music.play('matchWin', preferences)).toBe(true);
  context.sources[0]?.stop.mockImplementation(() => {
    throw new Error('device');
  });
  context.sources[0]?.disconnect.mockImplementation(() => {
    throw new Error('device');
  });
  expect(() => music.silence()).not.toThrow();
  expect(music.play('matchWin', preferences)).toBe(true);
  context.gains.at(-1)?.gain.setValueAtTime.mockImplementation(() => {
    throw new Error('device');
  });
  expect(() => music.updatePreferences({ muted: false, volume: 0.2 })).not.toThrow();
  context.createBufferSource = () => {
    throw new Error('device');
  };
  expect(music.play('matchLose', preferences)).toBe(false);
  music.close();
});

test('GameAudio routes final cues through approved music while ordinary cues remain synthesized', async () => {
  files();
  installAudio();
  const engine = new GameAudio();
  engine.unlock();
  const context = TestAudioContext.instances.at(-1);
  if (!context) throw new Error('MISSING_AUDIO_CONTEXT');
  await waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(2));
  engine.play('matchWin', preferences);
  expect(context.sources).toHaveLength(1);
  expect(context.oscillators).toHaveLength(0);
  engine.updatePreferences({ muted: false, volume: 0.1 });
  expect(context.gains[0]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.1, 2);
  engine.play('win', preferences);
  expect(context.oscillators).toHaveLength(3);
  engine.close();
  expect(context.sources[0]?.stop).toHaveBeenCalled();
});
