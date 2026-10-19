import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { RoomMenu } from './index';
import { playing } from '../Table/index.test';

test('room menu confirms surrender, supports closing and blocks exit while disconnected', () => {
  const send = mock(() => {});
  const props = { room: playing(), connected: true, send, children: <p>Som</p> };
  const view = render(<RoomMenu {...props} />);
  const menu = view.container.querySelector('details');
  if (!menu) throw new Error('Menu missing');
  menu.open = true;
  fireEvent(menu, new Event('toggle'));
  const close = screen.getByRole('button', { name: 'Fechar menu da sala' });
  expect(document.activeElement).toBe(close);
  fireEvent.click(screen.getByRole('button', { name: 'Sair da partida' }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar jogando' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sair da partida' }));
  view.rerender(<RoomMenu {...props} connected={false} />);
  expect(
    screen.getByRole('button', { name: 'Confirmar desistência' }).hasAttribute('disabled'),
  ).toBe(true);
  view.rerender(<RoomMenu {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desistência' }));
  expect(send).toHaveBeenCalledWith({ type: 'SURRENDER' });
  expect(menu.open).toBe(false);
  menu.open = true;
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(menu.open).toBe(false);
  menu.open = true;
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à partida' }));
  expect(menu.open).toBe(false);
  menu.open = true;
  view.rerender(<RoomMenu {...props} connected={false} />);
  expect(screen.getByRole('button', { name: 'Sair da partida' }).hasAttribute('disabled')).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Fechar menu da sala' }));
  expect(menu.open).toBe(false);
});
