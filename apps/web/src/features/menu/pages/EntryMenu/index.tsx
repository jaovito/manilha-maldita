import type { PlayerProgress } from '@truco/game-protocol';
import { nicknameSchema } from '@truco/game-protocol';
import { useEffect, useRef, useState } from 'react';
import { version } from '../../../../../package.json';
import { disabledHint } from '../../../../shared/DisabledTooltip';
import { t } from '../../../../shared/i18n';
import { MenuIcon } from '../../components/Icon';
import { MenuProfile } from '../../components/Profile';
import { Tutorial } from '../../components/Tutorial';

type EntryPage = 'menu' | 'join' | 'tutorial';

type Props = {
  page?: EntryPage;
  onNavigate?: (page: EntryPage) => void;
  profile?: PlayerProgress | null | undefined;
  onAccount?: (() => void) | undefined;
  onRanking?: (() => void) | undefined;
  onCosmetics?: (() => void) | undefined;
  soloEnabled?: boolean;
  onSettings?: () => void;
  onPlay?: () => void;
  nickname: string;
  code: string;
  busy: boolean;
  onNicknameChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onEnter: (create: boolean) => void;
};

export function EntryMenu({
  page,
  onNavigate,
  profile,
  onAccount,
  onRanking,
  onCosmetics,
  soloEnabled = false,
  onPlay,
  onSettings,
  nickname,
  code,
  busy,
  onNicknameChange,
  onCodeChange,
  onEnter,
}: Props) {
  const [localPage, setLocalPage] = useState<EntryPage>(code ? 'join' : 'menu');
  const activePage = page ?? localPage;
  const navigate = onNavigate ?? setLocalPage;
  const tutorial = activePage === 'tutorial';
  const tutorialTrigger = useRef<HTMLButtonElement>(null);
  const openedTutorial = useRef(false);
  useEffect(() => {
    if (!tutorial && openedTutorial.current) tutorialTrigger.current?.focus();
  }, [tutorial]);
  const joining = activePage === 'join';
  const entryReason = busy
    ? t('Aguarde a entrada na sala.')
    : !nicknameSchema.safeParse(nickname).success
      ? t('Escolha um apelido válido antes de entrar.')
      : null;
  const joinReason =
    entryReason ||
    (!/^[A-Z0-9]{6}$/.test(code) ? t('Informe um código de sala com 6 letras ou números.') : null);

  if (tutorial) return <Tutorial onClose={() => navigate('menu')} />;

  return (
    <div className="main-menu">
      <MenuProfile
        profile={profile}
        onAccount={onAccount}
        onRanking={onRanking}
        nickname={nickname}
        busy={busy}
        onNicknameChange={onNicknameChange}
      />
      <div className="menu-decoration" aria-hidden="true" />
      {joining ? (
        <section className="join-panel" aria-label={t('Entrar em uma sala privada')}>
          <p className="eyebrow">{t('SUA TURMA ESTÁ ESPERANDO')}</p>
          <h2>{t('Entrar em sala')}</h2>
          <p>{t('Informe o código que seu amigo compartilhou.')}</p>
          <label>
            {t('Código da sala')}
            <input
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC123"
              value={code}
              disabled={busy}
              {...disabledHint(busy ? t('Aguarde a entrada na sala para editar o código.') : null)}
              onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
            />
          </label>
          <button
            className="menu-button menu-green"
            type="button"
            aria-label={t('Entrar na sala')}
            disabled={Boolean(joinReason)}
            {...disabledHint(joinReason)}
            onClick={() => onEnter(false)}
          >
            <MenuIcon name="players" />
            {t('Entrar na sala')}
          </button>
          <button
            className="menu-back"
            type="button"
            disabled={busy}
            {...disabledHint(busy ? t('Aguarde a entrada na sala.') : null)}
            onClick={() => navigate('menu')}
          >
            {t('← Voltar ao menu')}
          </button>
        </section>
      ) : (
        <nav className="menu-navigation" aria-label={t('Menu principal')}>
          <button
            className="menu-button menu-green"
            type="button"
            aria-label={t('Jogar')}
            disabled={!soloEnabled || Boolean(entryReason)}
            {...disabledHint(
              !soloEnabled
                ? t('Partidas contra bot estão desativadas neste servidor.')
                : entryReason,
            )}
            onClick={onPlay}
          >
            <MenuIcon name="cards" />
            <span>
              {t('Jogar')}
              <small>{soloEnabled ? t('Contra bot') : t('Indisponível')}</small>
            </span>
          </button>
          <button
            className="menu-button menu-red"
            type="button"
            aria-label={t('Criar sala')}
            disabled={Boolean(entryReason)}
            {...disabledHint(entryReason)}
            onClick={() => onEnter(true)}
          >
            <MenuIcon name="house" />
            <span>{t('Criar sala')}</span>
          </button>
          <button
            className="menu-button menu-blue"
            type="button"
            aria-label={t('Entrar em sala')}
            onClick={() => navigate('join')}
          >
            <MenuIcon name="players" />
            <span>{t('Entrar em sala')}</span>
          </button>
          <button
            className="menu-button menu-green"
            type="button"
            ref={tutorialTrigger}
            aria-label={t('Como jogar')}
            onClick={() => {
              openedTutorial.current = true;
              navigate('tutorial');
            }}
          >
            <MenuIcon name="book" />
            <span>{t('Como jogar')}</span>
          </button>
          <button
            className="menu-button menu-blue"
            type="button"
            disabled={!onCosmetics || busy}
            onClick={onCosmetics}
            {...disabledHint(
              !onCosmetics ? t('Este recurso estará disponível em uma versão futura.') : null,
            )}
          >
            <MenuIcon name="hat" />
            <span>
              {t('Cosméticos')}
              <small>{onCosmetics ? t('Avatares · Baralhos · Mesas') : t('Em breve')}</small>
            </span>
          </button>
          <button
            className="menu-button menu-green"
            type="button"
            aria-label={t('Configurações')}
            onClick={onSettings}
          >
            <MenuIcon name="gear" />
            <span>{t('Configurações')}</span>
          </button>
        </nav>
      )}
      {busy && (
        <p className="menu-progress" role="status">
          {t('Preparando sua mesa…')}
        </p>
      )}
      <footer className="menu-footer">
        <button
          className="menu-exit"
          type="button"
          disabled
          {...disabledHint(t('Este recurso estará disponível em uma versão futura.'))}
        >
          {t('Sair')} <small>{t('Em breve')}</small>
        </button>
        <span className="menu-version">
          v{version}+{import.meta.env.VITE_BUILD_NUMBER ?? '0'}
        </span>
      </footer>
    </div>
  );
}
