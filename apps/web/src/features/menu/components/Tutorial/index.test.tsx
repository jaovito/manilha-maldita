import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { catalogs, loadLocale } from '../../../../shared/i18n';
import { EntryMenu } from '../../pages/EntryMenu';
import { Tutorial } from './index';

test('guided lessons teach every topic, explain wrong and correct answers, and reset between lessons', () => {
  const close = mock(() => {});
  const root = document.createElement('div');
  root.id = 'root';
  root.inert = false;
  document.body.append(root);
  const view = render(<Tutorial onClose={close} />);
  expect(root.inert).toBe(true);
  expect(screen.getByRole('button', { name: /Anterior/ }).hasAttribute('disabled')).toBe(true);
  for (const [index, lesson] of catalogs['pt-BR'].tutorial.lessons.entries()) {
    const title = screen.getByRole('heading', { name: lesson.title, level: 2 });
    expect(document.activeElement).toBe(title);
    const practice = screen.getByRole('region', { name: 'Sua vez de experimentar' });
    expect(within(practice).queryByRole('status')).toBeNull();
    fireEvent.click(
      within(practice).getByRole('button', {
        name: lesson.choices[(lesson.answer + 1) % lesson.choices.length]!,
      }),
    );
    expect(within(practice).getByRole('status').textContent).toContain('Vamos entender juntos.');
    fireEvent.click(within(practice).getByRole('button', { name: lesson.choices[lesson.answer]! }));
    expect(within(practice).getByRole('status').textContent).toContain(lesson.explanation);
    expect(within(practice).getByRole('status').getAttribute('data-correct')).toBe('true');
    if (index < 6) fireEvent.click(screen.getByRole('button', { name: /Próxima etapa/ }));
  }
  fireEvent.click(screen.getByRole('button', { name: /Concluir tutorial/ }));
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /Anterior/ }));
  for (const power of catalogs['pt-BR'].tutorial.powers)
    expect(screen.getByRole('heading', { name: power.name })).toBeDefined();
  view.unmount();
  expect(root.inert).toBe(false);
  root.remove();
});

test('vira wraps to four, translates all lessons and preserves the chosen language', () => {
  const view = render(<Tutorial onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /A vira muda tudo/ }));
  expect(screen.getByRole('img', { name: 'J Paus' })).toBeDefined();
  fireEvent.change(screen.getByLabelText('Escolha a vira'), { target: { value: '9' } });
  expect(screen.getByRole('img', { name: '4 Paus' })).toBeDefined();
  fireEvent.change(screen.getByLabelText('Idioma do jogo'), { target: { value: 'en' } });
  expect(screen.getByRole('dialog').getAttribute('lang')).toBe('en');
  expect(screen.getByRole('img', { name: '4 Clubs' })).toBeDefined();
  expect(loadLocale()).toBe('en');
  for (const lesson of catalogs.en.tutorial.lessons) {
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(lesson.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      }),
    );
    expect(screen.getByRole('heading', { name: lesson.title, level: 2 })).toBeDefined();
  }
  view.unmount();
  render(<Tutorial onClose={() => {}} />);
  expect(screen.getByRole('dialog', { name: 'How to play' })).toBeDefined();
});

test('keyboard stays within the guide and closing restores the menu trigger without entering a room', () => {
  const enter = mock(() => {});
  render(
    <EntryMenu
      nickname="Ana"
      code=""
      busy={false}
      onNicknameChange={() => {}}
      onCodeChange={() => {}}
      onEnter={enter}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Como jogar' }));
  const dialog = screen.getByRole('dialog');
  const first = screen.getByLabelText('Idioma do jogo');
  const last = screen.getByRole('button', { name: /Próxima etapa/ });
  last.focus();
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Como jogar' }));
  expect(enter).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Como jogar' }));
  fireEvent.click(screen.getByRole('button', { name: /Voltar ao menu/ }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
