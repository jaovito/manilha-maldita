import { t } from '../../../../shared/i18n';
import { useRef } from 'react';
import { disabledHint } from '../../../../shared/DisabledTooltip';

type Props = {
  nickname: string;
  busy: boolean;
  onNicknameChange: (value: string) => void;
};

export function MenuProfile({ nickname, busy, onNicknameChange }: Props) {
  const nicknameInput = useRef<HTMLInputElement>(null);

  return (
    <section className="guest-profile" aria-label={t('Seu perfil')}>
      <span className="avatar avatar-0" aria-hidden="true" />
      <div className="profile-info">
        <label>
          {t('Apelido')}
          <input
            aria-label={t('Apelido')}
            ref={nicknameInput}
            autoComplete="nickname"
            placeholder={t('Seu apelido')}
            maxLength={24}
            value={nickname}
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
          <span>{t('Nível —')}</span>
          <small>{t('Em breve')}</small>
        </div>
        <div className="profile-progress" aria-hidden="true" />
        <p className="guest-caption">{t('Convidado · Sem cadastro')}</p>
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
      </div>
    </section>
  );
}
