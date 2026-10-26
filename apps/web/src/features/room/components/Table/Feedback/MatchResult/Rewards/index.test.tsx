import { afterEach, expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MatchRewards } from './index';

const original = globalThis.fetch;
const mockFetch = (run: () => Promise<Response>) =>
  Object.assign(mock(run), { preconnect: original.preconnect });
afterEach(() => {
  globalThis.fetch = original;
});
const props = { matchId: 'match-result', eligibility: 'eligible' as const, completed: true };

test('shows committed XP and ranking grants without inferring amounts from a win', async () => {
  globalThis.fetch = mockFetch(async () =>
    Response.json({ status: 'granted', xp: '75', competitivePoints: '0' }),
  );
  render(<MatchRewards {...props} />);
  await screen.findByText('+75 XP');
  expect(screen.getByText('+0')).toBeDefined();
  expect(screen.queryByText('+150 XP')).toBeNull();
});

test('pending rewards retry and failures offer a deliberate retry without claiming a grant', async () => {
  let fail = true;
  globalThis.fetch = mockFetch(async () => {
    if (fail) throw new Error('offline');
    return Response.json({ status: 'none' });
  });
  render(<MatchRewards {...props} />);
  await screen.findByText('Não foi possível confirmar as recompensas agora.');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Consultar novamente' }));
  await screen.findByText('Esta partida não concede recompensas.');
});

test('pending processing is bounded, later confirmation updates and unmount discards late replies', async () => {
  let resolve: ((value: Response) => void) | undefined;
  globalThis.fetch = mockFetch(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const view = render(<MatchRewards {...props} />);
  await waitFor(() => expect(resolve).toBeDefined());
  view.unmount();
  resolve?.(Response.json({ status: 'granted', xp: '999', competitivePoints: '10' }));
  await Promise.resolve();
  expect(screen.queryByText('+999 XP')).toBeNull();
});

test('guests, edited games and interrupted results explain why rewards are absent without fetching', () => {
  const fetch = mockFetch(async () => Response.json({ status: 'pending' }));
  globalThis.fetch = fetch;
  for (const eligibility of ['guest', 'development', undefined] as const) {
    const view = render(<MatchRewards {...props} eligibility={eligibility} />);
    expect(screen.queryByText('+75 XP')).toBeNull();
    view.unmount();
  }
  render(<MatchRewards {...props} completed={false} />);
  expect(screen.getByText('Partidas interrompidas não concedem recompensas.')).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
});

test('processing polls a bounded number of times and a fresh attempt can confirm the reward', async () => {
  const ticks: (() => void)[] = [];
  const schedule = window.setTimeout.bind(window);
  const originalTimer = window.setTimeout;
  Object.defineProperty(window, 'setTimeout', {
    configurable: true,
    value: (handler: () => void, delay?: number) => {
      if (delay === 1500) {
        ticks.push(handler);
        return 0;
      }
      return schedule(handler, delay);
    },
  });
  let granted = false;
  const fetch = mockFetch(async () =>
    Response.json(
      granted ? { status: 'granted', xp: '150', competitivePoints: '10' } : { status: 'pending' },
    ),
  );
  globalThis.fetch = fetch;
  try {
    render(<MatchRewards {...props} />);
    for (let index = 0; index < 5; index++) {
      await waitFor(() => expect(ticks.length).toBe(1));
      await act(async () => {
        ticks.shift()?.();
      });
    }
    await screen.findByRole('button', { name: 'Consultar novamente' });
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(ticks).toHaveLength(0);
    granted = true;
    fireEvent.click(screen.getByRole('button', { name: 'Consultar novamente' }));
    await screen.findByText('+150 XP');
    expect(screen.getByText('+10')).toBeDefined();
  } finally {
    Object.defineProperty(window, 'setTimeout', { configurable: true, value: originalTimer });
  }
});
