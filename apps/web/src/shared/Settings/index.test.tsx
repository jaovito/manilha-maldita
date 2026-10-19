import { expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GameSettings, LanguageSelect } from './index';
import { AudioControls } from '../feedback';
import { changeLocale, t, useLocale } from '../i18n';

function Scene() {
  useLocale();
  return (
    <>
      <p>{t('Criar sala')}</p>
      <LanguageSelect />
    </>
  );
}

test('language is global, persists and updates other subscribers and cross-tab changes', () => {
  render(
    <>
      <Scene />
      <LanguageSelect />
    </>,
  );
  fireEvent.change(screen.getAllByRole('combobox')[0] as HTMLSelectElement, {
    target: { value: 'en' },
  });
  expect(screen.getByText('Create room')).toBeDefined();
  expect(
    screen.getAllByRole<HTMLSelectElement>('combobox').every((select) => select.value === 'en'),
  ).toBe(true);
  expect(localStorage.getItem('truco.locale')).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  act(() => {
    localStorage.setItem('truco.locale', 'pt-BR');
    window.dispatchEvent(new Event('storage'));
  });
  expect(screen.getByText('Criar sala')).toBeDefined();
});

test('settings localize sound, contain keyboard focus, close and restore the original focus', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const close = mock(() => {});
  const view = render(
    <GameSettings onClose={close}>
      <AudioControls preferences={{ muted: false, volume: 0.5 }} onChange={() => {}} />
    </GameSettings>,
  );
  const first = screen.getByRole('button', { name: 'Fechar configurações' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Voltar' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Voltar' }), { key: 'Tab' });
  expect(document.activeElement).toBe(first);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
  expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();
  expect(screen.getByText('Sound')).toBeDefined();
  fireEvent.keyDown(first, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  expect(close).toHaveBeenCalledTimes(3);
  view.unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
  changeLocale('pt-BR');
});
