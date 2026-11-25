import { expect, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useBrowserNavigation } from './index';

function Navigation() {
  const { route, navigate, back } = useBrowserNavigation();
  return (
    <>
      <output>
        {route.page}:{route.roomCode ?? 'none'}
      </output>
      <button type="button" onClick={() => navigate('tutorial', null)}>
        Tutorial
      </button>
      <button type="button" onClick={() => navigate('menu', 'ABC123')}>
        Room
      </button>
      <button type="button" onClick={() => navigate('settings', 'ABC123')}>
        Settings
      </button>
      <button type="button" onClick={back}>
        Back
      </button>
      <button type="button" onClick={() => navigate('menu', null, true)}>
        Replace
      </button>
    </>
  );
}

test('screen history restores Back/Forward without duplicate entries or private state', async () => {
  history.replaceState(null, '', '/');
  render(<Navigation />);
  const length = history.length;
  fireEvent.click(screen.getByText('Tutorial'));
  expect(location.hash).toBe('#tutorial');
  expect(history.state).toEqual({ trucoParent: 'http://localhost/' });
  fireEvent.click(screen.getByText('Tutorial'));
  expect(history.length).toBe(length + 1);
  fireEvent.click(screen.getByText('Back'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('menu:none'));
  act(() => history.forward());
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('tutorial:none'));
  fireEvent.click(screen.getByText('Room'));
  expect(location.search).toBe('?room=ABC123');
  fireEvent.click(screen.getByText('Settings'));
  expect(location.hash).toBe('#settings');
  fireEvent.click(screen.getByText('Replace'));
  expect(location.href).toBe('http://localhost/');
  expect(history.state).toBeNull();
});

test('unknown routes and external or malformed parent state safely return to the local menu', () => {
  for (const parent of [
    undefined,
    'not a URL',
    'https://other.example/',
    'http://localhost/other',
  ]) {
    history.replaceState({ trucoParent: parent }, '', '/?room=invalid#unknown');
    const view = render(<Navigation />);
    expect(screen.getByRole('status').textContent).toBe('menu:none');
    fireEvent.click(screen.getByText('Back'));
    expect(location.origin).toBe('http://localhost');
    expect(location.hash).toBe('');
    view.unmount();
  }
});
