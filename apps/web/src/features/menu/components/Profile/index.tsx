import type { PlayerProgress } from '@truco/game-protocol';
import { useRef } from 'react';
import { Avatar } from '../../../../shared/Avatar';
import { disabledHint } from '../../../../shared/DisabledTooltip';
import { t } from '../../../../shared/i18n';

type Props = {
  profile?: PlayerProgress | null | undefined;
  onAccount?: (() => void) | undefined;
  onRanking?: (() => void) | undefined;
  nickname: string;
  busy: boolean;
  onNicknameChange: (value: string) => void;
};

export function MenuProfile({
  nickname,
  busy,
  onNicknameChange,
  profile,
  onAccount,
  onRanking,
}: Props) {
  const nicknameInput = useRef<HTMLInputElement>(null);

  return (
    <section
      className={`guest-profile ${onAccount ? 'account-profile' : ''}`}
      aria-label={t('Seu perfil')}
    >
      <Avatar index={profile?.appearance.avatar.spriteIndex} />
      <div className="profile-info">
        <label>
          {t('Apelido')}
          <input
            aria-label={t('Apelido')}
            ref={nicknameInput}
            autoComplete="nickname"
            placeholder={t('Seu apelido')}
            maxLength={24}
            value={profile?.nickname ?? nickname}
            readOnly={Boolean(profile)}
            disabled={busy}
            {...disabledHint(busy ? t('Aguarde a entrada na sala para editar o apelido.') : null)}
            onChange={(event) => onNicknameChange(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="profile-edit"
          aria-label={t('Editar nome')}
          disabled={busy}
          onClick={() => {
            if (profile && onAccount) {
              onAccount();
              return;
            }
            nicknameInput.current?.focus();
            nicknameInput.current?.select();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M15 2L22 9L10 21H3V14ZM14 6L6 14L10 18L18 10ZM2 23H22V21H2Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <div className="profile-level">
          <span>{profile ? t('Nível {0}', [profile.level]) : t('Nível —')}</span>
          <small>{profile ? t('{0} XP', [profile.xp]) : onAccount ? '' : t('Em breve')}</small>
        </div>
        <div className="profile-progress" aria-hidden="true" />
        <p className="guest-caption">
          {profile ? t('Minha conta') : t('Convidado · Sem cadastro')}
        </p>
        {onAccount ? (
          <div className="profile-economy">
            <button type="button" disabled={busy} onClick={onAccount}>
              {profile ? t('Minha conta') : t('Entrar na conta')}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={t('Ranking global')}
              onClick={onRanking}
            >
              {profile ? `♛ ${profile.competitivePoints}` : t('Ranking global')}
            </button>
          </div>
        ) : (
          <div className="profile-economy">
            <strong>—</strong>
            <small>{t('Em breve')}</small>
            <button
              type="button"
              disabled
              aria-label={t('Moedas · Em breve')}
              {...disabledHint(t('Cosméticos e moedas estarão disponíveis em uma versão futura.'))}
            >
              +
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
