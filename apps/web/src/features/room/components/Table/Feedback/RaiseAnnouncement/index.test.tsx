import { afterEach, expect, test } from 'bun:test';
import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { acceptedRoom, raiseRoom } from '../../../../../../shared/feedback/raises.test';
import { RaiseAnnouncement } from './index';

const originalTimeout = window.setTimeout;
const originalClear = window.clearTimeout;
afterEach(() => {
  window.setTimeout = originalTimeout;
  window.clearTimeout = originalClear;
});

function clock() {
  let id = 0;
  const timers = new Map<number, () => void>();
  window.setTimeout = ((run: () => void, delay: number) => {
    expect(delay).toBe(1800);
    timers.set(++id, run);
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = (key) => {
    if (typeof key === 'number') timers.delete(key);
  };
  return timers;
}

test('confirmed shouts replace one another, ignore SYNC and expire without obsolete callbacks hiding a newer one', () => {
  const timers = clock();
  const view = render(
    <StrictMode>
      <RaiseAnnouncement room={raiseRoom()} />
    </StrictMode>,
  );
  view.rerender(
    <StrictMode>
      <RaiseAnnouncement room={raiseRoom(3, 2)} />
    </StrictMode>,
  );
  expect(screen.getByRole('status').textContent).toContain('TRUCOOOOOOO!!');
  const first = [...timers.values()][0];
  const letters = document.querySelector('.raise-shout');
  view.rerender(
    <StrictMode>
      <RaiseAnnouncement room={raiseRoom(3, 3)} />
    </StrictMode>,
  );
  expect(document.querySelector('.raise-shout')).toBe(letters);
  expect([...timers.values()][0]).toBe(first);
  view.rerender(
    <StrictMode>
      <RaiseAnnouncement room={raiseRoom(6, 4)} />
    </StrictMode>,
  );
  act(() => first?.());
  expect(screen.getByRole('status').textContent).toContain('SEEEIS!');
  act(() => [...timers.values()][0]?.());
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(
    <StrictMode>
      <RaiseAnnouncement room={raiseRoom(6, 5)} />
    </StrictMode>,
  );
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(
    <StrictMode>
      <RaiseAnnouncement room={raiseRoom(9, 6)} />
    </StrictMode>,
  );
  expect(screen.getByRole('status').textContent).toContain('NOOVE!');
  view.rerender(
    <StrictMode>
      <RaiseAnnouncement room={raiseRoom(12, 7)} />
    </StrictMode>,
  );
  expect(screen.getByRole('status').textContent).toContain('DOOOZE!!');
  view.unmount();
  expect(timers.size).toBe(0);
});

test('restored negotiations stay quiet; acceptance, pause, new match and sequence gaps dismiss effects', () => {
  clock();
  const view = render(<RaiseAnnouncement room={raiseRoom(3)} />);
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<RaiseAnnouncement room={raiseRoom(6, 2)} />);
  expect(screen.getByRole('status')).toBeDefined();
  view.rerender(<RaiseAnnouncement room={{ ...raiseRoom(6, 3), paused: true }} />);
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<RaiseAnnouncement room={raiseRoom(6, 4)} />);
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<RaiseAnnouncement room={raiseRoom(9, 5)} />);
  view.rerender(<RaiseAnnouncement room={raiseRoom(null, 6)} />);
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<RaiseAnnouncement room={raiseRoom(12, 7)} />);
  view.rerender(<RaiseAnnouncement room={raiseRoom(12, 10)} />);
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<RaiseAnnouncement room={{ ...raiseRoom(3, 11), matchId: 'new' }} />);
  expect(screen.queryByRole('status')).toBeNull();
});

test('accepted raise replaces the proposal with DEEESCE, survives sync and expires without replay', () => {
  const timers = clock();
  const view = render(<RaiseAnnouncement room={raiseRoom()} />);
  view.rerender(<RaiseAnnouncement room={raiseRoom(3, 2)} />);
  const oldTimer = [...timers.values()][0];
  view.rerender(<RaiseAnnouncement room={acceptedRoom(3, 3)} />);
  act(() => oldTimer?.());
  expect(screen.getByRole('status').textContent).toContain('DEEESCE!!');
  expect(screen.getByRole('status').textContent).toContain('3 pontos valendo');
  const acceptedTimer = [...timers.values()][0];
  view.rerender(<RaiseAnnouncement room={acceptedRoom(3, 4)} />);
  expect([...timers.values()][0]).toBe(acceptedTimer);
  act(() => acceptedTimer?.());
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<RaiseAnnouncement room={acceptedRoom(3, 5)} />);
  expect(screen.queryByRole('status')).toBeNull();
  view.unmount();
  render(<RaiseAnnouncement room={acceptedRoom()} />);
  expect(screen.queryByRole('status')).toBeNull();
});
