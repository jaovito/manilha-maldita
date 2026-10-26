import { useState } from 'react';
import { t } from '../../../../shared/i18n';

export function RecoveryCode({ code }: { code: string }) {
  const [message, setMessage] = useState('');

  return (
    <section className="recovery-result" aria-label={t('Código de recuperação')}>
      <h3>{t('Código de recuperação')}</h3>
      <p>{t('Salve seu código em um lugar seguro. Ele não será mostrado novamente.')}</p>
      <output>{code}</output>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText(code)
            .then(() => setMessage(t('Código copiado.')))
            .catch(() => setMessage(t('Não foi possível copiar. Selecione e salve o código.')));
          if (!navigator.clipboard)
            setMessage(t('Não foi possível copiar. Selecione e salve o código.'));
        }}
      >
        {t('Copiar código')}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
