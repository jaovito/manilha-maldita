import { afterEach, expect, mock, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoomInvite } from './index';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

test('invitation is read-only and selects its text on focus without using the clipboard', () => {
  const writeText = mock(async () => {});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<RoomInvite code="ABC123" />);
  const input = screen.getByLabelText<HTMLInputElement>('Link de convite');
  expect(input.value).toBe(`${location.origin}/?room=ABC123`);
  expect(input.readOnly).toBe(true);
  fireEvent.focus(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  expect(writeText).not.toHaveBeenCalled();
});

test('clicking copies only the invitation URL and announces success after completion', async () => {
  const writeText = mock(async () => {});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<RoomInvite code="ABC123" />);
  expect(writeText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link da sala' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Link copiado!'));
  expect(writeText).toHaveBeenCalledWith(`${location.origin}/?room=ABC123`);
  expect(writeText).toHaveBeenCalledTimes(1);
});

test('clipboard rejection provides manual copying instructions without false success', async () => {
  const writeText = mock(async () => {
    throw new Error('DENIED');
  });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<RoomInvite code="ABC123" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link da sala' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'Não foi possível copiar. Selecione e copie o link acima.',
    ),
  );
  expect(screen.queryByText('Link copiado!')).toBe(null);
});

test('an unavailable clipboard safely offers the visible invitation for manual copying', () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  render(<RoomInvite code="ABC123" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link da sala' }));
  expect(screen.getByRole('status').textContent).toBe(
    'Não foi possível copiar. Selecione e copie o link acima.',
  );
  expect(screen.queryByText('Link copiado!')).toBe(null);
});

test('invitation keeps its URL available after copying succeeds or fails', async () => {
  const writeText = mock(async () => {});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<RoomInvite code="ABC123" />);
  expect(screen.getByLabelText<HTMLInputElement>('Link de convite').value).toBe(
    `${location.origin}/?room=ABC123`,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link da sala' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Link copiado!'));
  expect(writeText).toHaveBeenCalledWith(`${location.origin}/?room=ABC123`);

  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link da sala' }));
  const input = screen.getByLabelText<HTMLInputElement>('Link de convite');
  expect(input.value).toBe(`${location.origin}/?room=ABC123`);
  expect(input.readOnly).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('Selecione e copie');
});
