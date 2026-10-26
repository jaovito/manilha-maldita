import { afterEach, expect, mock, test } from 'bun:test';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Tutorial } from '..';
import { EntryMenu } from '../../../pages/EntryMenu';
import { changeLocale, t } from '../../../../../shared/i18n';
import { guidedLessons } from './lessons';

afterEach(() => changeLocale('pt-BR'));
const selectedCards: Record<string, string> = {
  low: 'Q de Paus ♣',
  trump: '2 de Ouros ♦',
  'suit-play': '2 de Paus ♣',
  exchange: 'Q de Paus ♣',
  boost: '7 de Espadas ♠',
  mask: '3 de Copas ♥',
};

function completeAction(id: string) {
  const scene = screen.getByLabelText('Sua mão').closest('.guided-scene');
  if (!scene) throw new Error('Missing guided table');
  const controls = within(scene as HTMLElement);
  if (id === 'raise')
    fireEvent.click(controls.getByRole('button', { name: 'Pedir Truco / aumentar' }));
  else {
    if (['spy', 'exchange', 'boost', 'mask'].includes(id)) {
      fireEvent.click(controls.getByRole('button', { name: /^Poder / }));
    }
    if (id === 'spy')
      fireEvent.click(controls.getByRole('button', { name: 'Espionar carta 1 de Seu adversário' }));
    else fireEvent.click(controls.getByRole('button', { name: selectedCards[id] ?? id }));
  }
}

test('guided practice requires highlighted actions and explains comparisons, all powers and completion', () => {
  const close = mock(() => {});
  render(<Tutorial onClose={close} />);
  fireEvent.click(screen.getByRole('button', { name: 'Jogar tutorial guiado' }));
  expect(screen.getByRole('dialog', { name: 'Tutorial guiado' })).toBeDefined();
  expect(screen.getByLabelText('Sua mão').querySelectorAll('.card')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  fireEvent.click(screen.getByRole('button', { name: 'Desistir da partida' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pedir Truco / aumentar' }));
  expect(screen.getByRole('heading', { name: 'Estas são suas três cartas' })).toBeDefined();
  expect(close).not.toHaveBeenCalled();

  for (const [index, lesson] of guidedLessons.entries()) {
    const title = screen.getByRole('heading', { name: t(lesson.title) });
    expect(document.activeElement).toBe(title);
    expect(screen.getByText(`Etapa ${index + 1} de ${guidedLessons.length}`)).toBeDefined();
    if (lesson.action) {
      const next = screen.getByRole('button', { name: 'Continuar tutorial' });
      expect(next.hasAttribute('disabled')).toBe(true);
      fireEvent.click(next);
      expect(screen.getByRole('heading', { name: t(lesson.title) })).toBe(title);
      if (lesson.action === 'power-card') {
        const card = screen.getByRole('button', { name: selectedCards[lesson.id] ?? lesson.id });
        expect(next.hasAttribute('disabled')).toBe(true);
        fireEvent.click(card);
        expect(next.hasAttribute('disabled')).toBe(true);
      }
      completeAction(lesson.id);
      expect(next.hasAttribute('disabled')).toBe(false);
      if (!lesson.result) throw new Error('Missing exercise explanation');
      expect(document.querySelector('.guided-explanation')?.textContent).toBe(t(lesson.result));
      if (lesson.power)
        expect(document.querySelector('.power-energy')?.textContent).toContain(
          lesson.power === 'spy' || lesson.power === 'mask' ? '1/3' : '0/3',
        );
      if (lesson.id === 'exchange')
        expect(screen.getByRole('button', { name: '7 de Espadas ♠' })).toBeDefined();
      if (lesson.id === 'low')
        expect(screen.getByLabelText('Sua mão').querySelectorAll('.card')).toHaveLength(2);
    }
    if (lesson.id === 'ranks') {
      const order = within(screen.getByRole('list', { name: 'Ordem crescente de força' }));
      expect(order.getAllByRole('listitem')).toHaveLength(10);
      expect(order.getAllByRole('img').map((card) => card.getAttribute('aria-label'))).toEqual(
        ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'].map((rank) => `${rank} de Ouros ♦`),
      );
    }
    if (lesson.id === 'suits')
      expect(screen.getByLabelText('Manilhas desta mão').querySelectorAll('span')).toHaveLength(4);
    if (index < guidedLessons.length - 1)
      fireEvent.click(screen.getByRole('button', { name: 'Continuar tutorial' }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Concluir e voltar ao menu' }));
  expect(close).toHaveBeenCalledTimes(1);
});

test('guided navigation resets actions, translates, contains focus and returns to the menu without joining', () => {
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
  const open = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Como jogar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jogar tutorial guiado' }));
  };
  open();
  const dialog = screen.getByRole('dialog');
  fireEvent.click(screen.getByText('Idioma do jogo', { selector: 'summary' }));
  const language = screen.getByLabelText('Idioma do jogo');
  const restart = screen.getByRole('button', { name: 'Recomeçar tutorial' });
  fireEvent.keyDown(screen.getByRole('heading', { name: 'Estas são suas três cartas' }), {
    key: 'Tab',
    shiftKey: true,
  });
  expect(document.activeElement).toBe(restart);
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Q de Paus ♣' }));
  fireEvent.keyDown(dialog, { key: 'ArrowDown' });
  fireEvent.change(language, { target: { value: 'en' } });
  expect(screen.getByRole('dialog', { name: 'Guided tutorial' }).getAttribute('lang')).toBe('en');
  expect(screen.getByRole('heading', { name: 'These are your three cards' })).toBeDefined();
  fireEvent.change(screen.getByLabelText('Game language'), { target: { value: 'pt-BR' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar tutorial' }));
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  expect(screen.getByRole('button', { name: 'Anterior' }).hasAttribute('disabled')).toBe(true);
  for (let index = 0; index < 4; index++)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar tutorial' }));
  completeAction('low');
  fireEvent.click(restart);
  expect(screen.getByRole('heading', { name: 'Estas são suas três cartas' })).toBeDefined();
  for (let index = 0; index < 4; index++)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar tutorial' }));
  expect(screen.getByRole('button', { name: 'Continuar tutorial' }).hasAttribute('disabled')).toBe(
    true,
  );
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Como jogar' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Jogar tutorial guiado' }));
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao guia' }));
  fireEvent.click(screen.getByRole('button', { name: /Voltar ao menu/ }));
  expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Como jogar' }));
  expect(enter).not.toHaveBeenCalled();
});
