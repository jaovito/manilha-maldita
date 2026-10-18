export const AUDIO_PREFERENCES_KEY = 'truco.audio';
export type AudioPreferences = { muted: boolean; volume: number };
export const defaultAudioPreferences: AudioPreferences = { muted: false, volume: 0.35 };

export function loadAudioPreferences(): AudioPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) ?? 'null');
    if (
      typeof value === 'object' &&
      value !== null &&
      'muted' in value &&
      typeof value.muted === 'boolean' &&
      'volume' in value &&
      typeof value.volume === 'number' &&
      Number.isFinite(value.volume) &&
      value.volume >= 0 &&
      value.volume <= 1
    )
      return { muted: value.muted, volume: value.volume };
  } catch {
    // A blocked or corrupt preference cannot prevent entering a room.
  }

  return { ...defaultAudioPreferences };
}

export function saveAudioPreferences(value: AudioPreferences): void {
  try {
    localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // Preferences still apply during this visit if storage is unavailable.
  }
}
