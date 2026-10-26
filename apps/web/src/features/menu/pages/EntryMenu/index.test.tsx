import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { version } from '../../../../../package.json';
import { EntryMenu } from './index';

function handlers() {
  return {
    onNicknameChange: mock((_value: string) => {}),
    onCodeChange: mock((_value: string) => {}),
    onEnter: mock((_create: boolean) => {}),
  };
}

test('main menu keeps future features disabled, edits nickname and creates only when ready', () => {
  const events = handlers();
  const props = { nickname: '', code: '', busy: false, ...events };
  const view = render(<EntryMenu {...props} />);
  expect(view.container.querySelector('.menu-version')?.textContent).toBe(
    `v${version}+${import.meta.env.VITE_BUILD_NUMBER ?? '0'}`,
  );
  expect(screen.queryByText('alpha · M2')).toBeNull();

  for (const name of [/^Jogar/, /^Cosméticos/, /^Sair/]) {
    const button = screen.getByRole('button', { name });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('data-disabled-reason')).toBeTruthy();
    fireEvent.click(button);
  }
  expect(events.onEnter).not.toHaveBeenCalled();
  expect(screen.getByText('Nível —')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Moedas · Em breve' }).hasAttribute('disabled')).toBe(
    true,
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByRole('button', { name: 'Criar sala' }).hasAttribute('disabled')).toBe(true);
  expect(
    screen.getByRole('button', { name: 'Criar sala' }).getAttribute('aria-description'),
  ).toContain(props.nickname ? 'Aguarde' : 'apelido');
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Ana' } });
  expect(events.onNicknameChange).toHaveBeenCalledWith('Ana');
  view.rerender(<EntryMenu {...props} nickname="Ana" />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar nome' }));
  const nickname = screen.getByLabelText('Apelido') as HTMLInputElement;
  expect(document.activeElement).toBe(nickname);
  expect(nickname.selectionStart).toBe(0);
  expect(nickname.selectionEnd).toBe(3);
  expect(
    screen.getByRole('button', { name: 'Criar sala' }).getAttribute('data-disabled-reason'),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  expect(events.onEnter).toHaveBeenCalledWith(true);

  expect(view.container.querySelectorAll('.menu-navigation .menu-icon')).toHaveLength(6);
  for (const icon of view.container.querySelectorAll('.menu-icon')) {
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  }
  expect(view.container.querySelector('.menu-decoration')?.getAttribute('aria-hidden')).toBe(
    'true',
  );
  view.rerender(<EntryMenu {...props} nickname="Ana" busy />);
  expect(screen.getByRole('button', { name: 'Editar nome' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByLabelText('Apelido').hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Criar sala' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('status').textContent).toBe('Preparando sua mesa…');
});

test('joining opens a separate panel, uppercases code, rejects invalid input and returns to menu', () => {
  const events = handlers();
  const props = { nickname: 'Beto', code: '', busy: false, ...events };
  const view = render(<EntryMenu {...props} />);

  expect(screen.queryByLabelText('Código da sala')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }));
  expect(screen.getByRole('region', { name: 'Entrar em uma sala privada' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Entrar na sala' }).hasAttribute('disabled')).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText('Código da sala'), { target: { value: 'abc123' } });
  expect(events.onCodeChange).toHaveBeenCalledWith('ABC123');

  for (const code of ['ABC12', 'ABC1234', 'ABC_23']) {
    view.rerender(<EntryMenu {...props} code={code} />);
    expect(screen.getByRole('button', { name: 'Entrar na sala' }).hasAttribute('disabled')).toBe(
      true,
    );
  }
  view.rerender(<EntryMenu {...props} code="ABC123" nickname="   " />);
  expect(screen.getByRole('button', { name: 'Entrar na sala' }).hasAttribute('disabled')).toBe(
    true,
  );
  view.rerender(<EntryMenu {...props} code="ABC123" />);
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));
  expect(events.onEnter).toHaveBeenCalledWith(false);
  fireEvent.click(screen.getByRole('button', { name: '← Voltar ao menu' }));
  expect(screen.queryByLabelText('Código da sala')).toBeNull();
  expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeDefined();
});

test('invitation code opens joining immediately and busy state protects its fields and actions', () => {
  const events = handlers();
  const props = { nickname: 'Ana', code: 'ABC123', busy: true, ...events };
  const view = render(<EntryMenu {...props} />);

  expect(screen.getByRole('region', { name: 'Entrar em uma sala privada' })).toBeDefined();
  for (const label of ['Apelido', 'Código da sala'])
    expect(screen.getByLabelText(label).hasAttribute('disabled')).toBe(true);
  for (const name of ['Entrar na sala', '← Voltar ao menu']) {
    const button = screen.getByRole('button', { name });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('data-disabled-reason')).toBeTruthy();
    fireEvent.click(button);
  }
  expect(events.onEnter).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toBe('Preparando sua mesa…');
  view.rerender(<EntryMenu {...props} busy={false} />);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));
  expect(events.onEnter).toHaveBeenCalledWith(false);
});

test('Jogar is independently enabled for a valid nickname and never creates a multiplayer room', () => {
  const events = handlers();
  const play = mock(() => {});
  const props = {
    nickname: 'Ana',
    code: '',
    busy: false,
    ...events,
    soloEnabled: true,
    onPlay: play,
  };
  const view = render(<EntryMenu {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Jogar' }));
  expect(play).toHaveBeenCalledTimes(1);
  expect(events.onEnter).not.toHaveBeenCalled();
  view.rerender(<EntryMenu {...props} busy />);
  expect(screen.getByRole('button', { name: 'Jogar' }).hasAttribute('disabled')).toBe(true);
  view.rerender(<EntryMenu {...props} soloEnabled={false} />);
  expect(screen.getByRole('button', { name: 'Jogar' }).hasAttribute('disabled')).toBe(true);
});
