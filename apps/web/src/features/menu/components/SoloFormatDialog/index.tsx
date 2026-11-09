import type { RoomConfig } from '@truco/game-protocol';
import { useEffect, useRef } from 'react';
import { t } from '../../../../shared/i18n';
import { MenuIcon } from '../Icon';
import './styles.css';

export function SoloFormatDialog({
  onChoose,
  onClose,
}: {
  onChoose: (format: RoomConfig['format']) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    firstChoice.current?.focus();

    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="solo-format-dialog"
      aria-label={t('Como você quer jogar?')}
      aria-describedby="solo-format-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;

        // Native dialogs can otherwise let boundary Tab presses reach browser chrome.
        if (event.shiftKey && document.activeElement === firstChoice.current) {
          event.preventDefault();
          backButton.current?.focus();
        } else if (!event.shiftKey && document.activeElement === backButton.current) {
          event.preventDefault();
          firstChoice.current?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <p className="solo-format-eyebrow">{t('CONTRA BOTS')}</p>
      <h2>{t('Como você quer jogar?')}</h2>
      <p id="solo-format-description">{t('Escolha o formato da sua mesa.')}</p>
      <div className="solo-format-choices">
        <button
          ref={firstChoice}
          type="button"
          aria-label="1v1"
          aria-describedby="solo-format-1v1-description"
          onClick={() => onChoose('1v1')}
        >
          <MenuIcon name="cards" />
          <strong>1v1</strong>
          <span id="solo-format-1v1-description">{t('Você contra um bot.')}</span>
        </button>
        <button
          type="button"
          aria-label="2v2"
          aria-describedby="solo-format-2v2-description"
          onClick={() => onChoose('2v2')}
        >
          <MenuIcon name="players" />
          <strong>2v2</strong>
          <span id="solo-format-2v2-description">{t('Você e um bot contra dois bots.')}</span>
        </button>
      </div>
      <button ref={backButton} className="solo-format-back" type="button" onClick={onClose}>
        {t('Voltar ao menu')}
      </button>
    </dialog>
  );
}
