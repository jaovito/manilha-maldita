import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t, useLocale } from '../../../../shared/i18n';
import type { PlayerController } from '../../hooks/use-player';
import { Account } from '../Account';
import { Cosmetics } from '../Cosmetics';
import { Ranking } from '../Ranking';

export type PlayerSection = 'cosmetics' | 'ranking' | 'account';
const labels = {
  cosmetics: 'Personalização',
  ranking: 'Ranking global',
  account: 'Conta',
} as const;
export function PlayerPanel({
  initial,
  player,
  nickname,
  onClose,
}: {
  initial: PlayerSection;
  player: PlayerController;
  nickname: string;
  onClose: () => void;
}) {
  const [authRequired, setAuthRequired] = useState(false);
  useEffect(() => {
    if (player.profile) setAuthRequired(false);
  }, [player.profile]);

  const account = initial === 'account' || authRequired;
  const title = account
    ? player.profile
      ? 'Minha conta'
      : 'Entrar na conta'
    : initial === 'cosmetics'
      ? 'Seu estilo na mesa'
      : 'Ranking global';
  const dismiss = () => {
    player.clearError();
    if (authRequired) setAuthRequired(false);
    else onClose();
  };
  const close = useRef<HTMLButtonElement>(null);
  useLocale();

  useEffect(() => {
    const previous = document.activeElement;
    const root = document.getElementById('root');
    const inert = root?.inert ?? false;
    if (root) root.inert = true;
    close.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      if (root) root.inert = inert;
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const target = account
      ? close.current?.closest('section')?.querySelector<HTMLInputElement>('input')
      : close.current;
    (target ?? close.current)?.focus();
  }, [account]);

  return createPortal(
    <div className="player-backdrop">
      <section
        className={`player-panel${!account && initial === 'cosmetics' ? ' is-cosmetics' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t(account ? 'Conta' : labels[initial])}
        aria-busy={player.pending}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !player.pending) dismiss();
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
            ),
          ].filter((control) => control.tabIndex >= 0 && !control.closest('[hidden]'));
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
        <header className="player-panel-header">
          <div>
            <span className="eyebrow">MANILHA MALDITA</span>
            <h2>{t(title)}</h2>
          </div>
          <button
            ref={close}
            className="player-close"
            type="button"
            disabled={player.pending}
            aria-label={t('Fechar painel')}
            onClick={dismiss}
          >
            ×
          </button>
        </header>
        <div className="player-panel-body">
          {player.error && (!account || player.profile) && (
            <p className="player-error" role="alert">
              {player.error}
            </p>
          )}
          {initial === 'cosmetics' && (
            <div hidden={account}>
              <Cosmetics player={player} onAccount={() => setAuthRequired(true)} />
            </div>
          )}
          {authRequired && (
            <p className="account-context">
              {t('Entre ou crie uma conta para equipar este visual.')}
            </p>
          )}
          {account ? (
            <Account player={player} nickname={nickname} onGuest={dismiss} />
          ) : initial === 'ranking' ? (
            <Ranking />
          ) : null}
        </div>
        <footer className="player-panel-footer">
          {!account && initial === 'cosmetics' && (
            <span>
              ✦ {t('Só muda o visual. Todos os poderes estão disponíveis desde o início.')}
            </span>
          )}
          <button type="button" disabled={player.pending} onClick={dismiss}>
            {t(authRequired ? 'Voltar à personalização' : 'Voltar ao menu')}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
