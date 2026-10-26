import { nicknameSchema } from '@truco/game-protocol';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../../../../shared/i18n';
import type { PlayerController } from '../../hooks/use-player';
import { PasswordInput } from './PasswordInput';

type Mode = 'login' | 'register' | 'recover';
const labels = { login: 'Entrar', register: 'Criar conta', recover: 'Recuperar acesso' } as const;
export function AuthForm({
  player,
  nickname,
  onCode,
  onGuest,
}: {
  player: PlayerController;
  nickname: string;
  onCode: (code: string) => void;
  onGuest?: (() => void) | undefined;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [name, setName] = useState(nickname);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const feedback = error || player.error;
  const feedbackId = useId();
  const feedbackElement = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (feedback) feedbackElement.current?.focus();
  }, [feedback]);

  const changeMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setConfirm('');
    setCode('');
    setError('');
    player.clearError();
  };

  return (
    <div className="account-entry">
      <div className="account-intro">
        <span aria-hidden="true">♠</span>
        <h3>{t('Sua conta no jogo')}</h3>
        <p>{t('Crie uma conta para guardar seus desbloqueios.')}</p>
        <small>{t('Não pedimos e-mail e não aceitamos uploads.')}</small>
      </div>
      <div>
        <div className="account-modes">
          {(['login', 'register'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={player.pending}
              onClick={() => changeMode(value)}
            >
              {t(labels[value])}
            </button>
          ))}
        </div>
        <form
          className="account-form"
          noValidate
          aria-describedby={feedback ? feedbackId : undefined}
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            player.clearError();

            if (!/^[a-z0-9_]{3,32}$/.test(login)) {
              setError(t('Informe um usuário com 3 a 32 letras minúsculas, números ou _.'));
              return;
            }
            if (Array.from(password).length < 6 || Array.from(password).length > 128) {
              setError(t('A senha deve ter de 6 a 128 caracteres.'));
              return;
            }
            if (mode === 'register' && !nicknameSchema.safeParse(name).success) {
              setError(t('Informe um apelido válido com até 24 caracteres.'));
              return;
            }
            if (mode === 'recover' && !/^[a-f0-9]{64}$/.test(code)) {
              setError(t('Informe o código de recuperação de 64 caracteres.'));
              return;
            }
            if (mode !== 'login' && password !== confirm) {
              setError(t('As senhas precisam ser iguais.'));
              return;
            }
            const body =
              mode === 'register' ? { login, password, nickname: name } : { login, password };
            const operation =
              mode === 'recover'
                ? player
                    .recovery('recover', { login, recoveryCode: code, newPassword: password })
                    .then((next) => {
                      if (next) {
                        onCode(next);
                        setMode('login');
                      }
                    })
                : player.authenticate(mode, body);
            void operation
              .catch(() => {})
              .finally(() => {
                setPassword('');
                setConfirm('');
                setCode('');
              });
          }}
        >
          <label>
            {t('Usuário')}
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              maxLength={32}
              required
              disabled={player.pending}
            />
            <small>{t('De 3 a 32 letras minúsculas, números ou _.')}</small>
          </label>
          {mode === 'register' && (
            <label>
              {t('Apelido')}
              <input
                name="nickname"
                autoComplete="nickname"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={24}
                required
                disabled={player.pending}
              />
            </label>
          )}
          {mode === 'recover' && (
            <label>
              {t('Código de recuperação')}
              <input
                name="recoveryCode"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(event.target.value.trim())}
                maxLength={64}
                required
                disabled={player.pending}
              />
            </label>
          )}
          <PasswordInput
            label={mode === 'recover' ? t('Nova senha') : t('Senha')}
            hint={t('Use de 6 a 128 caracteres.')}
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={256}
            required
            disabled={player.pending}
          />
          {mode !== 'login' && (
            <PasswordInput
              label={t('Confirmar senha')}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              maxLength={256}
              required
              disabled={player.pending}
            />
          )}
          {feedback && (
            <p
              id={feedbackId}
              className="player-error"
              role="alert"
              tabIndex={-1}
              ref={feedbackElement}
            >
              {feedback}
            </p>
          )}
          <button type="submit" disabled={player.pending}>
            {player.pending ? t('Aguarde…') : t(labels[mode])}
          </button>
          <button
            type="button"
            className="player-link"
            disabled={player.pending}
            onClick={() => changeMode(mode === 'recover' ? 'login' : 'recover')}
          >
            {mode === 'recover' ? t('Voltar ao login') : t('Recuperar conta')}
          </button>
          <button
            type="button"
            className="player-link"
            disabled={player.pending}
            onClick={() =>
              void player
                .logout()
                .then(onGuest)
                .catch(() => {})
            }
          >
            {t('Continuar como convidado')}
          </button>
          {mode === 'recover' && (
            <small>{t('Sem senha e sem código, não é possível recuperar a conta.')}</small>
          )}
        </form>
      </div>
    </div>
  );
}
