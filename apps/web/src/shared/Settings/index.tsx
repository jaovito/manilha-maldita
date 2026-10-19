import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t, useLocale } from '../i18n';
import './styles.css';

export function LanguageSelect() {
  const { locale, changeLocale } = useLocale();
  return (
    <label className="game-language">
      {t('Idioma do jogo')}
      <select
        aria-label={t('Idioma do jogo')}
        value={locale}
        onChange={(event) => changeLocale(event.target.value === 'en' ? 'en' : 'pt-BR')}
      >
        <option value="pt-BR">Português</option>
        <option value="en">English</option>
      </select>
      <small>{t('A preferência vale para todo o jogo e fica salva neste navegador.')}</small>
    </label>
  );
}

export function GameSettings({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useLocale();
  useEffect(() => {
    const previous = document.activeElement;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    closeButton.current?.focus();
    return () => {
      if (root) root.inert = wasInert;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return createPortal(
    <div className="game-settings-backdrop">
      <section
        className="game-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('Configurações')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), select, summary, input',
            ),
          ].filter(
            (element) => !element.closest('details:not([open])') || element.tagName === 'SUMMARY',
          );
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <h2>{t('Configurações')}</h2>
          <button
            ref={closeButton}
            type="button"
            aria-label={t('Fechar configurações')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <LanguageSelect />
        {children}
        <button type="button" onClick={onClose}>
          {t('Voltar')}
        </button>
      </section>
    </div>,
    document.body,
  );
}
