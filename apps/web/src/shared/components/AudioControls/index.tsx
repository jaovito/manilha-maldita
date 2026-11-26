import { t, useLocale } from '../../i18n';
import type { AudioPreferences } from '../../feedback/preferences';

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
