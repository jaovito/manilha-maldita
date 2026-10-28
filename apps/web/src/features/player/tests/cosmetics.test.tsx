import { afterEach, expect, mock, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Avatar } from '../../../shared/Avatar';
import { CardBack, CardFace } from '../../../shared/PlayingCard';
import { Cosmetics } from '../components/Cosmetics';
import { PlayerPanel } from '../components/Panel';
import { Ranking } from '../components/Ranking';
import { catalog, controller, mockFetch, profile, response } from './player-fixture.test';

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test('independent cosmetic tabs preview locked assets but only submit eligible selections', async () => {
  globalThis.fetch = mockFetch(async () => response(catalog));
  const player = controller();
  const onAccount = mock(() => {});
  const view = render(<Cosmetics player={player} onAccount={onAccount} />);
  await screen.findByRole('tab', { name: 'Avatares' });
  expect(view.container.querySelector('.player-summary')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Avatar 2/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Equipar' }));
  await waitFor(() =>
    expect(player.select).toHaveBeenCalledWith({
      avatarId: 'avatar-2',
      deckThemeId: 'classic',
      tableThemeId: 'classic',
    }),
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Baralhos' }));
  fireEvent.click(screen.getByRole('button', { name: /Arcano/ }));
  expect(screen.getByRole('button', { name: 'Equipar' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Brasa/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Equipar' }));
  await waitFor(() =>
    expect(player.select).toHaveBeenCalledWith({
      avatarId: 'avatar-1',
      deckThemeId: 'ember',
      tableThemeId: 'classic',
    }),
  );
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Baralhos' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Mesas' }).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: /Vinho/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Equipar' }));
  await waitFor(() =>
    expect(player.select).toHaveBeenCalledWith({
      avatarId: 'avatar-1',
      deckThemeId: 'classic',
      tableThemeId: 'burgundy',
    }),
  );
  for (const key of ['ArrowLeft', 'Home', 'End', 'Enter'])
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Mesas' }), { key });
  view.rerender(<Cosmetics player={controller(null)} onAccount={onAccount} />);
  expect(screen.queryByText('Convidado · Sem cadastro')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Entre para equipar' }));
  expect(onAccount).toHaveBeenCalled();
});

test('catalog failures retry and late responses do not update unmounted panels', async () => {
  let fail = true;
  globalThis.fetch = mockFetch(async () =>
    fail ? response({ error: 'UNAVAILABLE' }, 503) : response(catalog),
  );
  const view = render(<Cosmetics player={controller()} onAccount={() => {}} />);
  await screen.findByRole('button', { name: 'Tentar novamente' });
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByRole('tab', { name: 'Avatares' });
  view.unmount();
});

test('global ranking fetches real pages, preserves exact large points and retries errors', async () => {
  let fail = false;
  globalThis.fetch = mockFetch(async (input) =>
    fail
      ? response({ error: 'UNAVAILABLE' }, 503)
      : response(
          String(input).includes('page=2')
            ? { entries: [], nextPage: null }
            : {
                entries: [
                  {
                    rank: 1,
                    nickname: 'Ana',
                    competitivePoints: '9007199254740993',
                    avatar: profile.appearance.avatar,
                  },
                ],
                nextPage: 2,
              },
        ),
  );
  render(<Ranking />);
  await screen.findByText('Ana');
  expect(screen.getByRole('table').textContent).toContain('9.007.199.254.740.993');
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await screen.findByText('Ainda não há jogadores pontuando.');
  fail = true;
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  await screen.findByRole('alert');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText('Ana');
});

test('cosmetics panel traps focus, excludes account navigation and restores the page', async () => {
  globalThis.fetch = mockFetch(async (input) =>
    response(String(input).includes('/ranking') ? { entries: [], nextPage: null } : catalog),
  );
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const player = controller();
  const close = mock(() => {});
  const view = render(
    <PlayerPanel initial="cosmetics" player={player} nickname="Ana" onClose={close} />,
  );
  const dialog = screen.getByRole('dialog');
  await screen.findByRole('tab', { name: 'Avatares' });
  const first = screen.getByRole('button', { name: 'Fechar painel' });
  const last = screen.getByRole('button', { name: 'Voltar ao menu' });
  first.focus();
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(document.activeElement).toBe(first);
  expect(screen.queryByRole('button', { name: /Minha conta|Ranking global/ })).toBeNull();
  expect(screen.getAllByRole('tab')).toHaveLength(3);

  const principles = screen.getAllByText(/Só muda o visual\. Todos os poderes/);
  expect(principles).toHaveLength(1);
  expect(principles[0]?.closest('footer')).not.toBeNull();

  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.click(last);
  fireEvent.click(first);
  expect(close).toHaveBeenCalledTimes(3);
  view.unmount();
  expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).not.toBe('hidden');
  opener.remove();
});

test('all deck suits remain readable faces; hidden cards never carry rank or suit', () => {
  const view = render(
    <>
      <Avatar index={9} />
      {[4, 5, 6, 7].map((index) => (
        <Avatar key={index} index={index} />
      ))}
      {(['classic', 'ember', 'arcane'] as const).map((theme) => (
        <div key={theme}>
          <CardBack theme={theme} />
          {(['clubs', 'hearts', 'spades', 'diamonds'] as const).map((suit) => (
            <CardFace key={suit} theme={theme} card={{ rank: 'A', suit }} />
          ))}
        </div>
      ))}
    </>,
  );
  expect(view.container.querySelector('.avatar-0')).not.toBeNull();
  for (const index of [4, 5, 6, 7])
    expect(view.container.querySelector(`.avatar-${index}`)).not.toBeNull();
  for (const back of view.container.querySelectorAll('.card-back'))
    expect(back.textContent).not.toContain('A');
  expect(view.container.querySelectorAll('svg')).toHaveLength(24);
});

test('contextual authentication returns to the selected deck on cancel and successful login', async () => {
  globalThis.fetch = mockFetch(async () => response(catalog));
  const guest = controller(null);
  const close = mock(() => {});
  const view = render(
    <PlayerPanel initial="cosmetics" player={guest} nickname="Ana" onClose={close} />,
  );
  await screen.findByRole('tab', { name: 'Baralhos' });
  fireEvent.click(screen.getByRole('tab', { name: 'Baralhos' }));
  fireEvent.click(screen.getByRole('button', { name: /Brasa/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Entre para equipar' }));
  expect(screen.getByRole('dialog', { name: 'Conta' })).toBeDefined();
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.getByText('Entre ou crie uma conta para equipar este visual.')).toBeDefined();
  const first = screen.getByRole('button', { name: 'Fechar painel' });
  first.focus();
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Voltar à personalização' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à personalização' }));
  expect(screen.getByRole('tab', { name: 'Baralhos' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('button', { name: /Brasa/ }).getAttribute('aria-pressed')).toBe('true');
  expect(close).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Entre para equipar' }));
  const authenticated = controller();
  view.rerender(
    <PlayerPanel initial="cosmetics" player={authenticated} nickname="Ana" onClose={close} />,
  );
  await screen.findByRole('tab', { name: 'Baralhos' });
  expect(screen.getByRole('button', { name: /Brasa/ }).getAttribute('aria-pressed')).toBe('true');
  expect(authenticated.select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^Equipar$/ }));
  await waitFor(() =>
    expect(authenticated.select).toHaveBeenCalledWith({
      avatarId: 'avatar-1',
      deckThemeId: 'ember',
      tableThemeId: 'classic',
    }),
  );
});

test('account and ranking open independently of the collection', async () => {
  globalThis.fetch = mockFetch(async () => response({ entries: [], nextPage: null }));
  const account = render(
    <PlayerPanel initial="account" player={controller()} nickname="Ana" onClose={() => {}} />,
  );
  expect(screen.getByRole('button', { name: 'Salvar apelido' })).toBeDefined();
  expect(screen.queryByRole('tab')).toBeNull();
  account.unmount();

  render(
    <PlayerPanel initial="ranking" player={controller(null)} nickname="Ana" onClose={() => {}} />,
  );
  await screen.findByText('Ainda não há jogadores pontuando.');
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.queryByLabelText(/Usuário/)).toBeNull();
});
