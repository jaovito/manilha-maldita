import { useEffect, useRef } from 'react';
import { t } from '../../../../../../../shared/i18n';
import { cardLabel, type Card } from '../../../../../utils/cards';
import { CardFace } from '../../../Card';

export function SpyCardPreview({ card, onClose }: { card: Card; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    close.current?.focus();

    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="spy-card-preview"
      aria-label={t('Carta revelada pelo Espião')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2>{t('Carta revelada pelo Espião')}</h2>
      <div className="spy-preview-face" role="img" aria-label={cardLabel(card)}>
        <CardFace card={card} />
      </div>
      <strong>{cardLabel(card)}</strong>
      <p>{t('Vista na preparação; pode já ter sido jogada.')}</p>
      <button ref={close} type="button" onClick={onClose}>
        {t('Fechar carta')}
      </button>
    </dialog>
  );
}
