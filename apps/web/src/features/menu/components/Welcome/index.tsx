import { t } from '../../../../shared/i18n';
import { nicknameSchema } from '@truco/game-protocol';
import { useEffect, useRef } from 'react';
import { disabledHint } from '../../../../shared/DisabledTooltip';

type Props = {
  nickname: string;
  invitation: boolean;
  onChange: (value: string) => void;
  onContinue: () => void;
};

export function Welcome({ nickname, invitation, onChange, onContinue }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const valid = nicknameSchema.safeParse(nickname).success;

  useEffect(() => input.current?.focus(), []);

  return (
    <section className="welcome-scene" aria-label={t('Boas-vindas')}>
      <form
        className="welcome-panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onContinue();
        }}
      >
        <span className="welcome-suits" aria-hidden="true">
          ♦ ♠ ♥ ♣
        </span>
        <p className="eyebrow">{t('BEM-VINDO À MANILHA MALDITA')}</p>
        <h2>{t('Como vamos chamar você?')}</h2>
        <p>{t('Escolha o apelido que seus amigos vão ver na mesa.')}</p>
        <label>
          {t('Apelido')}
          <input
            ref={input}
            autoComplete="nickname"
            maxLength={24}
            spellCheck={false}
            placeholder={t('Seu nome na mesa')}
            value={nickname}
            aria-describedby="welcome-nickname-help"
            aria-invalid={nickname.length > 0 && !valid}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <p id="welcome-nickname-help" className="welcome-help">
          {t('De 1 a 24 caracteres. Use letras, números, espaços, ponto, hífen ou sublinhado.')}
        </p>
        <button
          type="submit"
          className="button-primary"
          disabled={!valid}
          {...disabledHint(!valid ? t('Escolha um apelido válido para continuar.') : null)}
        >
          {t('Continuar')}
        </button>
        <p className="welcome-note">
          {invitation
            ? t('Seu convite está guardado. Vamos entrar na sala depois.')
            : t('Sem cadastro. Você pode mudar o apelido no menu.')}
        </p>
      </form>
    </section>
  );
}
