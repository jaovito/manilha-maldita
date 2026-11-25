import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { AudioControls } from './index';

test('accessible sound controls update mute and bounded volume independently', () => {
  const change = mock(() => {});
  const { rerender } = render(
    <AudioControls preferences={{ muted: false, volume: 0.35 }} onChange={change} />,
  );
  expect(screen.getByLabelText('Configurações de som').tagName).toBe('SUMMARY');
  fireEvent.click(screen.getByLabelText('Efeitos sonoros'));
  expect(change).toHaveBeenLastCalledWith({ muted: true, volume: 0.35 });
  fireEvent.change(screen.getByLabelText('Volume dos efeitos sonoros'), {
    target: { value: '100' },
  });
  expect(change).toHaveBeenLastCalledWith({ muted: false, volume: 1 });
  rerender(<AudioControls preferences={{ muted: true, volume: 0 }} onChange={change} />);
  expect(screen.getByText('0%')).toBeDefined();
  const toggle = screen.getByLabelText('Efeitos sonoros');
  expect(toggle instanceof HTMLInputElement && toggle.checked).toBe(false);
});
