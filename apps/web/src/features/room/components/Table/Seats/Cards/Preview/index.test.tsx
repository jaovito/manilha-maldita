import { expect, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { SeatCards } from '..';

test('private observed cards open an accessible preview, close and restore focus', () => {
  render(
    <SeatCards
      hand={{ seat: 1, count: 2, visibility: 'hidden' }}
      name="Bia"
      spying={false}
      spy={() => {}}
      position={0}
      hasOpaquePlay={false}
      intel={{ target: 1, card: { rank: 'A', suit: 'clubs' } }}
    />,
  );
  const trigger = screen.getByRole('button', { name: 'Ampliar carta revelada: A de Paus ♣' });
  trigger.focus();
  fireEvent.click(trigger);
  let dialog = screen.getByRole('dialog', { name: 'Carta revelada pelo Espião' });
  expect(dialog.querySelector('.card-face')).not.toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar carta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fechar carta' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);

  fireEvent.click(trigger);
  dialog = screen.getByRole('dialog');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull();

  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('dialog'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('removing or changing intel closes the preview and opaque plays keep only historical memory', () => {
  const props = {
    hand: { seat: 1, count: 2, visibility: 'hidden' as const },
    name: 'Bia',
    spying: false,
    spy: () => {},
    position: 0,
    hasOpaquePlay: false,
  };
  const intel = { target: 1, card: { rank: 'A' as const, suit: 'clubs' as const } };
  const view = render(<SeatCards {...props} intel={intel} />);
  fireEvent.click(screen.getByRole('button', { name: /Ampliar carta/ }));
  view.rerender(<SeatCards {...props} intel={intel} hasOpaquePlay />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button', { name: /Ampliar carta/ })).toBeNull();
  expect(screen.getByRole('note')).toBeDefined();
  view.rerender(<SeatCards {...props} intel={intel} />);
  fireEvent.click(screen.getByRole('button', { name: /Ampliar carta/ }));
  view.rerender(<SeatCards {...props} intel={{ ...intel, card: { rank: '7', suit: 'hearts' } }} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<SeatCards {...props} intel={null} />);
  expect(screen.queryByRole('button', { name: /Ampliar carta/ })).toBeNull();
});
