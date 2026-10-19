import { t } from '../../../../shared/i18n';
import { useRef, useState, type ReactNode } from 'react';
import type { RoomView } from '@truco/game-protocol';
import { disabledHint } from '../../../../shared/DisabledTooltip';
import type { Action } from '../../../../shared/transport/client';

export function RoomMenu({
  room,
  connected,
  send,
  children,
}: {
  room: RoomView;
  connected: boolean;
  send: (action: Action) => void;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const close = () => {
    menu.current?.removeAttribute('open');
    menu.current?.querySelector('summary')?.focus();
    setConfirmExit(false);
  };

  return (
    <details
      className="room-menu"
      ref={menu}
      onToggle={(event) => {
        if (event.currentTarget.open) closeButton.current?.focus();
        else setConfirmExit(false);
      }}
    >
      <summary>
        {t('Sala ·')} {room.code}
      </summary>
      <section
        className="room-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('Menu da sala')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
          }
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), summary, input:not(:disabled), select:not(:disabled)',
            ),
          ].filter((element) => element.getClientRects().length > 0);
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
          <div>
            <p className="eyebrow">MANILHA MALDITA</p>
            <h2>
              {t('Sala ·')} {room.code}
            </h2>
          </div>
          <button
            type="button"
            ref={closeButton}
            onClick={close}
            aria-label={t('Fechar menu da sala')}
          >
            ×
          </button>
        </header>
        <p className="room-menu-rules">
          {room.config.format} · {room.config.preset === 'casual' ? t('Casual') : t('Competitivo')}
          <br />
          {room.solo
            ? t('Treino contra bot · sem progressão ou ranking.')
            : t('As regras e equipes ficam fixas durante a partida.')}
        </p>
        <div className="room-menu-sound">{children}</div>
        {confirmExit ? (
          <div className="room-menu-exit" role="alert">
            <h3>{t('Sair desta partida?')}</h3>
            <p>
              {t(
                'Desistir dá a vitória à equipe adversária. Depois, você poderá voltar ao menu pela tela de resultado.',
              )}
            </p>
            <button
              type="button"
              disabled={!connected}
              {...disabledHint(!connected ? t('Aguarde reconectar para desistir.') : null)}
              onClick={() => {
                send({ type: 'SURRENDER' });
                close();
              }}
            >
              {t('Confirmar desistência')}
            </button>
            <button type="button" onClick={() => setConfirmExit(false)}>
              {t('Continuar jogando')}
            </button>
          </div>
        ) : (
          <div className="room-menu-actions">
            <button type="button" className="button-primary" onClick={close}>
              {t('Voltar à partida')}
            </button>
            <button
              type="button"
              className="button-quiet"
              disabled={!connected}
              {...disabledHint(!connected ? t('Aguarde reconectar para sair da partida.') : null)}
              onClick={() => setConfirmExit(true)}
            >
              {t('Sair da partida')}
            </button>
          </div>
        )}
        {!connected && <p role="status">{t('Reconectando… Aguarde a conexão para sair.')}</p>}
      </section>
    </details>
  );
}
