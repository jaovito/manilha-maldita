import { nicknameSchema } from '@truco/game-protocol';
import { useState } from 'react';
import { disabledHint } from '../../../../shared/DisabledTooltip';
import { MenuIcon } from '../../components/Icon';
import { MenuProfile } from '../../components/Profile';

type Props = {
  nickname: string;
  code: string;
  busy: boolean;
  onNicknameChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onEnter: (create: boolean) => void;
};

export function EntryMenu({
  nickname,
  code,
  busy,
  onNicknameChange,
  onCodeChange,
  onEnter,
}: Props) {
  const [joining, setJoining] = useState(Boolean(code));
  const entryReason = busy
    ? 'Aguarde a entrada na sala.'
    : !nicknameSchema.safeParse(nickname).success
      ? 'Escolha um apelido válido antes de entrar.'
      : null;
  const joinReason =
    entryReason ||
    (!/^[A-Z0-9]{6}$/.test(code) ? 'Informe um código de sala com 6 letras ou números.' : null);

  return (
    <div className="main-menu">
      <MenuProfile nickname={nickname} busy={busy} onNicknameChange={onNicknameChange} />
      <div className="menu-decoration" aria-hidden="true" />
      {joining ? (
        <section className="join-panel" aria-label="Entrar em uma sala privada">
          <p className="eyebrow">SUA TURMA ESTÁ ESPERANDO</p>
          <h2>Entrar em sala</h2>
          <p>Informe o código que seu amigo compartilhou.</p>
          <label>
            Código da sala
            <input
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC123"
              value={code}
              disabled={busy}
              {...disabledHint(busy ? 'Aguarde a entrada na sala para editar o código.' : null)}
              onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
            />
          </label>
          <button
            className="menu-button menu-green"
            type="button"
            aria-label="Entrar na sala"
            disabled={Boolean(joinReason)}
            {...disabledHint(joinReason)}
            onClick={() => onEnter(false)}
          >
            <MenuIcon name="players" />
            Entrar na sala
          </button>
          <button
            className="menu-back"
            type="button"
            disabled={busy}
            {...disabledHint(busy ? 'Aguarde a entrada na sala.' : null)}
            onClick={() => setJoining(false)}
          >
            ← Voltar ao menu
          </button>
        </section>
      ) : (
        <nav className="menu-navigation" aria-label="Menu principal">
          <button
            className="menu-button menu-green"
            type="button"
            disabled
            {...disabledHint('Este recurso estará disponível em uma versão futura.')}
          >
            <MenuIcon name="cards" />
            <span>
              Jogar<small>Em breve</small>
            </span>
          </button>
          <button
            className="menu-button menu-red"
            type="button"
            aria-label="Criar sala"
            disabled={Boolean(entryReason)}
            {...disabledHint(entryReason)}
            onClick={() => onEnter(true)}
          >
            <MenuIcon name="house" />
            <span>Criar sala</span>
          </button>
          <button
            className="menu-button menu-blue"
            type="button"
            aria-label="Entrar em sala"
            onClick={() => setJoining(true)}
          >
            <MenuIcon name="players" />
            <span>Entrar em sala</span>
          </button>
          <button
            className="menu-button menu-green"
            type="button"
            disabled
            {...disabledHint('Este recurso estará disponível em uma versão futura.')}
          >
            <MenuIcon name="book" />
            <span>
              Como jogar<small>Em breve</small>
            </span>
          </button>
          <button
            className="menu-button menu-blue"
            type="button"
            disabled
            {...disabledHint('Este recurso estará disponível em uma versão futura.')}
          >
            <MenuIcon name="hat" />
            <span>
              Cosméticos<small>Em breve</small>
            </span>
          </button>
          <button
            className="menu-button menu-green"
            type="button"
            disabled
            {...disabledHint('Este recurso estará disponível em uma versão futura.')}
          >
            <MenuIcon name="gear" />
            <span>
              Configurações<small>Em breve</small>
            </span>
          </button>
        </nav>
      )}
      {busy && (
        <p className="menu-progress" role="status">
          Preparando sua mesa…
        </p>
      )}
      <footer className="menu-footer">
        <button
          className="menu-exit"
          type="button"
          disabled
          {...disabledHint('Este recurso estará disponível em uma versão futura.')}
        >
          Sair <small>Em breve</small>
        </button>
        <span>alpha · M2</span>
      </footer>
    </div>
  );
}
