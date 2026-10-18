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
    <section className="welcome-scene" aria-label="Boas-vindas">
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
        <p className="eyebrow">BEM-VINDO AO TRUCO CAÓTICO</p>
        <h2>Como vamos chamar você?</h2>
        <p>Escolha o apelido que seus amigos vão ver na mesa.</p>
        <label>
          Apelido
          <input
            ref={input}
            autoComplete="nickname"
            maxLength={24}
            spellCheck={false}
            placeholder="Seu nome na mesa"
            value={nickname}
            aria-describedby="welcome-nickname-help"
            aria-invalid={nickname.length > 0 && !valid}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <p id="welcome-nickname-help" className="welcome-help">
          De 1 a 24 caracteres. Use letras, números, espaços, ponto, hífen ou sublinhado.
        </p>
        <button
          type="submit"
          className="button-primary"
          disabled={!valid}
          {...disabledHint(!valid ? 'Escolha um apelido válido para continuar.' : null)}
        >
          Continuar
        </button>
        <p className="welcome-note">
          {invitation
            ? 'Seu convite está guardado. Vamos entrar na sala depois.'
            : 'Sem cadastro. Você pode mudar o apelido no menu.'}
        </p>
      </form>
    </section>
  );
}
