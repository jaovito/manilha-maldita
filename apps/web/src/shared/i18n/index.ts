import { useSyncExternalStore } from 'react';
import { en } from './en';
import { gameEnglish, type MessageKey } from './game';
import { ptBR } from './pt-BR';
import type { Locale } from './types';

export const catalogs = { 'pt-BR': { tutorial: ptBR }, en: { tutorial: en } };
const storageKey = 'truco.locale';
let fallback: Locale = 'pt-BR';
let lastStored: string | null | undefined;
const listeners = new Set<() => void>();

export function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== lastStored) {
      lastStored = stored;
      fallback = stored === 'en' ? 'en' : 'pt-BR';
    }
  } catch {
    // Keep the in-memory preference when browser storage is blocked.
  }
  return fallback;
}

function notify() {
  if (typeof document !== 'undefined') document.documentElement.lang = loadLocale();
  for (const listener of listeners) listener();
}

export function changeLocale(next: Locale) {
  loadLocale();
  fallback = next;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Language changes still work without persistent browser storage.
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', notify);
  };
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, loadLocale, () => 'pt-BR' as const);
  return { locale, changeLocale, messages: catalogs[locale] };
}

/** Translate complete messages. Player names and protocol values are interpolation data. */
export function t(key: MessageKey, values: readonly (string | number)[] = []): string {
  const message: string = loadLocale() === 'en' ? gameEnglish[key] : key;
  return message.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
    values[Number(index)] === undefined ? placeholder : String(values[Number(index)]),
  );
}

/** Module-level dictionaries resolve lazily so a language change cannot freeze their labels. */
export function localized<K extends string>(keys: Record<K, MessageKey>): Record<K, string> {
  return Object.defineProperties(
    {} as Record<K, string>,
    Object.fromEntries(
      Object.keys(keys).map((key) => [key, { enumerable: true, get: () => t(keys[key as K]) }]),
    ),
  );
}
