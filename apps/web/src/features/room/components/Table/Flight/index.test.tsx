import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { useCardFlight } from './index';

const state: RoomView = {
  code: 'ABC123',
  sequence: 1,
  roomRevision: 1,
  status: 'playing',
  hostSeat: 0,
  selfSeat: 0,
  seats: [],
  config: defaultRoomConfig,
  matchId: 'match',
  decisionId: 'turn',
  deadline: null,
  paused: false,
  outcome: null,
  match: {
    seat: 0,
    playerCount: 2,
    revision: 1,
    score: { A: 0, B: 0 },
    phase: { type: 'TURN', seat: 0 },
    hand: {
      number: 1,
      kind: 'normal',
      leader: 0,
      trickLeader: 0,
      elevenTeam: null,
      vira: { rank: '4', suit: 'clubs' },
      hands: [],
      plays: [],
      completedTricks: [],
      betting: {
        acceptedStake: 1,
        pendingStake: null,
        lastRaisingTeam: null,
        resumeTurnSeat: null,
      },
    },
  },
};

function Harness({
  room = state,
  ids = [],
  absent = false,
}: {
  room?: RoomView;
  ids?: number[];
  absent?: boolean;
}) {
  const { tableRef, captureCard } = useCardFlight(room);
  if (absent) return null;
  return (
    <section ref={tableRef} onClickCapture={captureCard}>
      <div className="hand-cards">
        <button className="card" type="button">
          play
        </button>
      </div>
      <div className="seat-relative-1">
        <span className="mini-card" />
      </div>
      {ids.map((id) => (
        <div key={id} data-play-id={String(id)} data-relative={id % 2}>
          <span className="destination">authorized face</span>
        </div>
      ))}
    </section>
  );
}

afterEach(() => mock.restore());

function browser() {
  const animation = new Animation();
  const cancel = spyOn(animation, 'cancel');
  const animate = spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);
  spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.className === 'destination'
      ? new DOMRect(100, 100, 50, 75)
      : new DOMRect(200, 300, 100, 150);
  });
  return { animation, animate, cancel };
}

test('confirmed plays fly from the selected card, never on click or repeated snapshots', () => {
  const { animation, animate } = browser();
  const view = render(<Harness />);
  fireEvent(window, new Event('resize'));
  fireEvent.click(view.getByRole('button'));
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<Harness room={{ ...state, sequence: 2 }} ids={[0]} />);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.calls[0]?.[0]).toEqual([
    { transform: 'translate(125px, 237.5px) scale(2) rotate(-6deg)' },
    { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
  ]);
  expect(view.container.querySelector('[data-flying]')).not.toBeNull();
  view.rerender(<Harness room={{ ...state, sequence: 3 }} ids={[0]} />);
  expect(animate).toHaveBeenCalledTimes(1);
  animation.dispatchEvent(new Event('finish'));
  expect(view.container.querySelector('[data-flying]')).toBeNull();
});

test('opponent slots animate and pause cancels flights without replay on resume', () => {
  const { animate, cancel } = browser();
  const view = render(<Harness />);
  view.rerender(<Harness room={{ ...state, sequence: 2 }} ids={[1]} />);
  expect(animate).toHaveBeenCalledTimes(1);
  view.rerender(<Harness room={{ ...state, paused: true }} ids={[1]} />);
  expect(cancel).toHaveBeenCalled();
  view.rerender(<Harness room={{ ...state, sequence: 4 }} ids={[1, 0]} />);
  expect(animate).toHaveBeenCalledTimes(1);
});

test('initial history, new matches, missing table and reduced motion do not replay flights', () => {
  const { animate } = browser();
  const view = render(<Harness ids={[0]} />);
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<Harness room={{ ...state, matchId: 'rematch' }} ids={[1]} />);
  expect(animate).not.toHaveBeenCalled();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  Object.defineProperty(media, 'matches', { value: true });
  spyOn(window, 'matchMedia').mockReturnValue(media);
  view.rerender(<Harness room={{ ...state, matchId: 'rematch', sequence: 3 }} ids={[1, 2]} />);
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<Harness absent room={{ ...state, sequence: 4 }} />);
});

test('unmount cancels flights and zero-sized cards do not animate', () => {
  const { animate, cancel } = browser();
  const view = render(<Harness />);
  view.rerender(<Harness room={{ ...state, sequence: 2 }} ids={[0]} />);
  view.unmount();
  expect(cancel).toHaveBeenCalled();
  animate.mockClear();
  spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect());
  const empty = render(<Harness />);
  empty.rerender(<Harness room={{ ...state, sequence: 3 }} ids={[1]} />);
  expect(animate).not.toHaveBeenCalled();
  expect(empty.container.querySelector('[data-flying]')).toBeNull();
});
