import type { RoomView } from '@truco/game-protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAudio } from '../../feedback/audio';
import { ResultAudio } from '../../feedback/result-audio';
import { interactionSound, RoomAudioEvents } from '../../feedback/events';
import {
  type AudioPreferences,
  loadAudioPreferences,
  saveAudioPreferences,
} from '../../feedback/preferences';

export function useGameFeedback() {
  const [preferences, setPreferences] = useState(loadAudioPreferences);
  const preferencesRef = useRef(preferences);
  const audio = useRef<GameAudio | null>(null);
  const events = useRef(new RoomAudioEvents());
  const resultAudio = useRef<ResultAudio | null>(null);

  useEffect(() => {
    const engine = new GameAudio();
    audio.current = engine;
    const result = new ResultAudio((sound) => {
      if (document.visibilityState !== 'hidden') engine.play(sound, preferencesRef.current);
    });
    resultAudio.current = result;
    const unlock = () => engine.unlock();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') unlock();
    };
    const click = (event: MouseEvent) => {
      unlock();
      const sound = interactionSound(event.target);
      if (sound) engine.play(sound, preferencesRef.current);
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        result.cancel();
        engine.silence();
        events.current.reset();
      }
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('click', click);
    document.addEventListener('visibilitychange', visibility);

    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', visibility);
      result.cancel();
      resultAudio.current = null;
      engine.close();
      audio.current = null;
    };
  }, []);

  const changePreferences = (next: AudioPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    saveAudioPreferences(next);
    audio.current?.updatePreferences(next);
    if (next.muted || next.volume === 0) {
      resultAudio.current?.cancel();
      audio.current?.silence();
    }
  };
  const observe = useCallback((room: RoomView) => {
    const sounds = events.current.observe(room);
    if (document.visibilityState === 'hidden') return;

    resultAudio.current?.observe(room, sounds);
  }, []);
  const reset = useCallback(() => {
    events.current.reset();
    resultAudio.current?.cancel();
    audio.current?.silence();
  }, []);

  return { preferences, changePreferences, observe, reset };
}
