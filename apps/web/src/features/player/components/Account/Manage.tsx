import { nicknameSchema } from '@truco/game-protocol';
import { useState } from 'react';
import { t } from '../../../../shared/i18n';
import type { PlayerController } from '../../hooks/use-player';
import { PasswordInput } from './PasswordInput';

export function ManageAccount({
  player,
  onCode,
}: {
  player: PlayerController;
  onCode: (code: string) => void;
}) {
  const [name, setName] = useState(player.profile?.nickname ?? '');
  const [action, setAction] = useState<'recovery-code' | 'password' | 'delete'>('recovery-code');
  const [password, setPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState('');
  const [securityError, setSecurityError] = useState('');

  return (
    <div className="account-management">
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!nicknameSchema.safeParse(name).success) return;
          void player
            .rename(name)
            .then(() => setNotice(t('Apelido salvo.')))
            .catch(() => {});
        }}
      >
        <h3>{t('Seu perfil')}</h3>
        <label>
          {t('Apelido')}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            required
            disabled={player.pending}
          />
        </label>
        <button type="submit" disabled={player.pending || name === player.profile?.nickname}>
          {t('Salvar apelido')}
        </button>
        {notice && <p role="status">{notice}</p>}
        <button
          type="button"
          className="player-link"
          disabled={player.pending}
          onClick={() => void player.logout().catch(() => {})}
        >
          {t('Sair da conta')}
        </button>
      </form>
      <form
        className="account-form account-security"
        onSubmit={(event) => {
          event.preventDefault();
          setSecurityError('');
          if (
            action === 'password' &&
            (nextPassword !== confirm ||
              Array.from(nextPassword).length < 6 ||
              Array.from(nextPassword).length > 128)
          ) {
            setSecurityError(
              t(
                nextPassword !== confirm
                  ? 'As senhas precisam ser iguais.'
                  : 'Use de 6 a 128 caracteres.',
              ),
            );
            return;
          }
          if (action === 'delete' && !accepted) return;
          const task =
            action === 'recovery-code'
              ? player.recovery('recovery-code', { password }).then((code) => {
                  if (code) onCode(code);
                })
              : player.maintain(
                  action,
                  action === 'password'
                    ? { currentPassword: password, newPassword: nextPassword }
                    : { password },
                );
          void task
            .catch(() => {})
            .finally(() => {
              setPassword('');
              setNextPassword('');
              setConfirm('');
              setAccepted(false);
            });
        }}
      >
        <div className="security-options">
          {(['recovery-code', 'password', 'delete'] as const)
            .filter((mode) => mode !== 'recovery-code' || action !== 'recovery-code')
            .map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={player.pending}
                aria-pressed={action === mode}
                onClick={() => {
                  setAction(mode);
                  setPassword('');
                  setNextPassword('');
                  setConfirm('');
                  setAccepted(false);
                  setNotice('');
                  setSecurityError('');
                  player.clearError();
                }}
              >
                {t(
                  mode === 'recovery-code'
                    ? 'Voltar'
                    : mode === 'password'
                      ? 'Alterar senha'
                      : 'Excluir conta',
                )}
              </button>
            ))}
        </div>
        <PasswordInput
          label={t('Senha atual')}
          autoComplete="current-password"
          required
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={player.pending}
        />
        {action === 'password' && (
          <>
            <PasswordInput
              label={t('Nova senha')}
              hint={t('Use de 6 a 128 caracteres.')}
              autoComplete="new-password"
              required
              value={nextPassword}
              maxLength={256}
              onChange={(event) => setNextPassword(event.target.value)}
              disabled={player.pending}
            />
            <PasswordInput
              label={t('Confirmar senha')}
              autoComplete="new-password"
              required
              value={confirm}
              maxLength={256}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={player.pending}
            />
          </>
        )}
        {action === 'delete' && (
          <label className="delete-confirmation">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
              disabled={player.pending}
            />
            {t('Entendo que minha conta e meu progresso serão excluídos.')}
          </label>
        )}
        {securityError && <p role="alert">{securityError}</p>}
        <button type="submit" disabled={player.pending || (action === 'delete' && !accepted)}>
          {player.pending
            ? t('Aguarde…')
            : t(
                action === 'recovery-code'
                  ? 'Gerar código de recuperação'
                  : action === 'password'
                    ? 'Alterar senha'
                    : 'Excluir conta',
              )}
        </button>
      </form>
    </div>
  );
}
