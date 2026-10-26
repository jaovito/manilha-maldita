import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Account } from '../components/Account';
import { controller } from './player-fixture.test';

const password = 'TruC06';
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
}
function submit(label: string) {
  const buttons = screen.getAllByRole('button', { name: label });
  const button = buttons.at(-1);
  if (button) fireEvent.click(button);
}

test('register/login/recover clear secrets and submit only the appropriate credentials', async () => {
  const player = controller(null);
  render(<Account player={player} nickname="Ana" />);
  submit('Entrar');
  fill('Usuário', 'ana');
  fill('Senha', 'short');
  submit('Entrar');
  expect(screen.getByRole('alert')).toBeDefined();
  submit('Criar conta');
  fill('Senha', password);
  fill('Confirmar senha', 'different');
  submit('Criar conta');
  expect(screen.getByRole('alert').textContent).toContain('iguais');
  fill('Confirmar senha', password);
  submit('Criar conta');
  await waitFor(() =>
    expect(player.authenticate).toHaveBeenCalledWith('register', {
      login: 'ana',
      password,
      nickname: 'Ana',
    }),
  );
  await waitFor(() => expect((screen.getByLabelText(/^Senha/) as HTMLInputElement).value).toBe(''));
  submit('Entrar');
  fill('Senha', password);
  submit('Entrar');
  await waitFor(() =>
    expect(player.authenticate).toHaveBeenCalledWith('login', { login: 'ana', password }),
  );
  submit('Recuperar conta');
  fill('Código de recuperação', 'a'.repeat(64));
  fill('Nova senha', password);
  fill('Confirmar senha', password);
  submit('Recuperar acesso');
  await waitFor(() =>
    expect(player.recovery).toHaveBeenCalledWith('recover', {
      login: 'ana',
      recoveryCode: 'a'.repeat(64),
      newPassword: password,
    }),
  );
  await screen.findByText('Salve seu código em um lugar seguro. Ele não será mostrado novamente.');
  submit('Recuperar conta');
  submit('Voltar ao login');
  submit('Continuar como convidado');
  expect(player.logout).toHaveBeenCalled();
});

test('account maintenance requires confirmation, reauthenticates and clears secrets', async () => {
  const player = controller();
  const view = render(<Account player={player} nickname="Ana" />);
  expect(screen.getAllByRole('button', { name: 'Gerar código de recuperação' })).toHaveLength(1);
  fill('Apelido', 'Bia');
  submit('Salvar apelido');
  await waitFor(() => expect(player.rename).toHaveBeenCalledWith('Bia'));
  fill('Senha atual', password);
  submit('Gerar código de recuperação');
  await waitFor(() => expect(player.recovery).toHaveBeenCalledWith('recovery-code', { password }));
  await screen.findByText('Salve seu código em um lugar seguro. Ele não será mostrado novamente.');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  submit('Copiar código');
  await screen.findByText('Não foi possível copiar. Selecione e salve o código.');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: mock(async () => {}) },
  });
  submit('Copiar código');
  await screen.findByText('Código copiado.');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: mock(async () => {
        throw Error('denied');
      }),
    },
  });
  submit('Copiar código');
  await screen.findByText('Não foi possível copiar. Selecione e salve o código.');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  fireEvent.click(screen.getAllByRole('button', { name: 'Alterar senha' })[0] ?? document.body);
  fill('Senha atual', password);
  fill('Nova senha', 'short');
  fill('Confirmar senha', 'different');
  submit('Alterar senha');
  expect(screen.getByRole('alert')).toBeDefined();
  fill('Nova senha', password);
  fill('Confirmar senha', password);
  submit('Alterar senha');
  await waitFor(() =>
    expect(player.maintain).toHaveBeenCalledWith('password', {
      currentPassword: password,
      newPassword: password,
    }),
  );
  submit('Voltar');
  expect(screen.getAllByRole('button', { name: 'Gerar código de recuperação' })).toHaveLength(1);
  fireEvent.click(screen.getAllByRole('button', { name: 'Excluir conta' })[0] ?? document.body);
  expect(
    screen.getAllByRole('button', { name: 'Excluir conta' })[1]?.hasAttribute('disabled'),
  ).toBe(true);
  fill('Senha atual', password);
  fireEvent.click(screen.getByRole('checkbox'));
  submit('Excluir conta');
  await waitFor(() => expect(player.maintain).toHaveBeenCalledWith('delete', { password }));
  submit('Sair da conta');
  expect(player.logout).toHaveBeenCalled();
  view.rerender(<Account player={controller(null)} nickname="Ana" />);
  expect(screen.queryByText('a'.repeat(64))).toBeNull();
});

test('authentication reports missing and invalid fields without invoking the API', () => {
  const player = controller(null);
  render(<Account player={player} nickname="Ana" />);
  submit('Criar conta');
  submit('Criar conta');
  expect(screen.getByRole('alert').textContent).toContain('Informe um usuário');
  expect(document.activeElement).toBe(screen.getByRole('alert'));
  expect(document.querySelector('form')?.noValidate).toBe(true);
  fill('Usuário', 'ana');
  fill('Senha', 'short');
  submit('Criar conta');
  expect(screen.getByRole('alert').textContent).toContain('6 a 128');
  fill('Senha', password);
  fill('Apelido', '');
  submit('Criar conta');
  expect(screen.getByRole('alert').textContent).toContain('apelido válido');
  submit('Recuperar conta');
  fill('Nova senha', password);
  submit('Recuperar acesso');
  expect(screen.getByRole('alert').textContent).toContain('recuperação de 64');
  expect(player.authenticate).not.toHaveBeenCalled();
  expect(player.recovery).not.toHaveBeenCalled();
});

test('server errors appear next to the authentication submit button and receive focus', () => {
  const player = controller(null);
  const view = render(<Account player={player} nickname="Ana" />);
  view.rerender(
    <Account player={{ ...player, error: 'Login ou senha inválidos.' }} nickname="Ana" />,
  );
  const alert = screen.getByRole('alert');
  expect(alert.closest('form')).not.toBeNull();
  expect(alert.textContent).toBe('Login ou senha inválidos.');
  expect(document.activeElement).toBe(alert);
});

test('password visibility is independent, preserves values and never submits the form', () => {
  const player = controller(null);
  const view = render(<Account player={player} nickname="Ana" />);
  submit('Criar conta');
  fill('Senha', password);
  fill('Confirmar senha', password);
  const input = screen.getByLabelText(/^Senha/) as HTMLInputElement;
  const confirmation = screen.getByLabelText('Confirmar senha') as HTMLInputElement;
  expect(input.type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha: Senha' }));
  expect(input.type).toBe('text');
  expect(input.value).toBe(password);
  expect(confirmation.type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha: Senha' }));
  expect(input.type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha: Confirmar senha' }));
  expect(confirmation.type).toBe('text');
  expect(player.authenticate).not.toHaveBeenCalled();
  submit('Entrar');
  expect(input.type).toBe('password');

  view.rerender(<Account player={{ ...player, pending: true }} nickname="Ana" />);
  expect(
    screen.getByRole('button', { name: 'Mostrar senha: Senha' }).hasAttribute('disabled'),
  ).toBe(true);
});

test('account maintenance provides visibility controls for each password', () => {
  render(<Account player={controller()} nickname="Ana" />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Alterar senha' })[0] ?? document.body);
  for (const label of ['Senha atual', 'Nova senha', 'Confirmar senha']) {
    fill(label, password);
    fireEvent.click(screen.getByRole('button', { name: `Mostrar senha: ${label}` }));
    expect((screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement).type).toBe('text');
  }
});
