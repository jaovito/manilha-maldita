import { t, useLocale } from '../i18n';
import type { RoomView } from '@truco/game-protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAudio } from './audio';
import { interactionSound, RoomAudioEvents } from './events';
import { type AudioPreferences, loadAudioPreferences, saveAudioPreferences } from './preferences';

export function useGameFeedback() {
  const [preferences, setPreferences] = useState(loadAudioPreferences);
  const preferencesRef = useRef(preferences);
  const audio = useRef<GameAudio | null>(null);
  const events = useRef(new RoomAudioEvents());

  useEffect(() => {
    const engine = new GameAudio();
    audio.current = engine;
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
      engine.close();
      audio.current = null;
    };
  }, []);

  const changePreferences = (next: AudioPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    saveAudioPreferences(next);
    if (next.muted || next.volume === 0) audio.current?.silence();
  };
  const observe = useCallback((room: RoomView) => {
    const sounds = events.current.observe(room);
    if (document.visibilityState === 'hidden') return;

    for (const sound of sounds) audio.current?.play(sound, preferencesRef.current);
  }, []);
  const reset = useCallback(() => events.current.reset(), []);

  return { preferences, changePreferences, observe, reset };
}

export function AudioControls({
  preferences,
  onChange,
}: {
  preferences: AudioPreferences;
  onChange: (preferences: AudioPreferences) => void;
}) {
  useLocale();
  return (
    <details className="audio-controls" data-audio-controls>
      <summary aria-label={t('Configurações de som')}>
        <span aria-hidden="true">
          {preferences.muted || preferences.volume === 0 ? '♪ ×' : '♪'}
        </span>
        <span>{t('Som')}</span>
      </summary>
      <div className="audio-settings">
        <label className="audio-toggle">
          <input
            type="checkbox"
            checked={!preferences.muted}
            onChange={(event) => onChange({ ...preferences, muted: !event.target.checked })}
          />
          {t('Efeitos sonoros')}
        </label>
        <label className="audio-volume">
          {t('Volume')} <output>{Math.round(preferences.volume * 100)}%</output>
          <input
            type="range"
            aria-label={t('Volume dos efeitos sonoros')}
            min="0"
            max="100"
            step="5"
            value={Math.round(preferences.volume * 100)}
            onChange={(event) =>
              onChange({ ...preferences, volume: Number(event.target.value) / 100 })
            }
          />
        </label>
        <p>{t('O som começa após interagir. Todos os avisos também aparecem na tela.')}</p>
      </div>
    </details>
  );
}
