import { useId, useState } from 'react';
import { LobbyIcon } from '../Icon';

const COPY_FAILED = 'Não foi possível copiar. Selecione e copie o link acima.';

export function RoomInvite({ code }: { code: string }) {
  const inputId = useId();
  const [feedback, setFeedback] = useState('');
  const value = `${location.origin}/?room=${code}`;

  async function copyLink() {
    setFeedback('');
    try {
      const clipboard = navigator.clipboard;
      if (typeof clipboard?.writeText !== 'function') {
        setFeedback(COPY_FAILED);
        return;
      }
      await clipboard.writeText(value);
      setFeedback('Link copiado!');
    } catch {
      setFeedback(COPY_FAILED);
    }
  }

  return (
    <div className="invite-field">
      <label htmlFor={inputId}>Link de convite</label>
      <div className="invite-control">
        <input
          id={inputId}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          aria-label="Copiar link da sala"
          title="Copiar link da sala"
          onClick={copyLink}
        >
          <LobbyIcon name="cards" />
        </button>
      </div>
      <p className="invite-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}
