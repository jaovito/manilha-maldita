import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { Welcome } from './index';

test('welcome focuses the nickname, explains the rules and prevents an invalid confirmation', () => {
  const onChange = mock((_value: string) => {});
  const onContinue = mock(() => {});
  const view = render(
    <Welcome nickname="" invitation={false} onChange={onChange} onContinue={onContinue} />,
  );
  const field = screen.getByLabelText('Apelido');
  expect(document.activeElement).toBe(field);
  expect(screen.getByRole('heading', { name: 'Como vamos chamar você?' })).toBeDefined();
  expect(field.getAttribute('maxlength')).toBe('24');
  expect(screen.getByText(/Sem cadastro/)).toBeDefined();
  fireEvent.change(field, { target: { value: 'João' } });
  expect(onChange).toHaveBeenCalledWith('João');
  for (const nickname of ['', '   ', '<script>', 'a'.repeat(25)]) {
    view.rerender(
      <Welcome
        nickname={nickname}
        invitation={false}
        onChange={onChange}
        onContinue={onContinue}
      />,
    );
    expect(screen.getByRole('button', { name: 'Continuar' }).hasAttribute('disabled')).toBe(true);
    fireEvent.submit(view.container.querySelector('form') as HTMLFormElement);
  }
  expect(onContinue).not.toHaveBeenCalled();
  expect(field.getAttribute('aria-invalid')).toBe('true');
});

test('valid nickname can be confirmed by form submit and keeps invitation guidance', () => {
  const onContinue = mock(() => {});
  const view = render(
    <Welcome nickname=" João-2 " invitation onChange={() => {}} onContinue={onContinue} />,
  );
  expect(screen.getByRole('button', { name: 'Continuar' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByText(/Seu convite está guardado/)).toBeDefined();
  expect(screen.getByLabelText('Apelido').getAttribute('aria-invalid')).toBe('false');
  fireEvent.submit(view.container.querySelector('form') as HTMLFormElement);
  expect(onContinue).toHaveBeenCalledTimes(1);
});
