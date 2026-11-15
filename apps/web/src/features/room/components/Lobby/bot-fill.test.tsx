import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { Lobby } from './index';

function room(): RoomView {
  return {
    code: 'ABC123',
    sequence: 1,
    roomRevision: 0,
    status: 'lobby',
    hostSeat: 0,
    selfSeat: 0,
    seats: [{ seat: 0, nickname: 'Ana', connected: true, ready: false }, null],
    config: { ...defaultRoomConfig },
    matchId: null,
    decisionId: null,
    deadline: null,
    paused: false,
    match: null,
    outcome: null,
  };
}
test('host bot fill uses authoritative seats, readiness and removable bot badges', () => {
  const send = mock(() => {});
  const state: RoomView = {
    ...room(),
    botFillEnabled: true,
    config: { ...defaultRoomConfig, format: '2v2' },
    seats: [
      { seat: 0, nickname: 'Ana', connected: true, ready: true },
      { seat: 1, nickname: 'Beto', connected: true, ready: true },
      { seat: 2, nickname: 'Cris', connected: true, ready: true },
      null,
    ],
  };
  const view = render(<Lobby room={state} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preencher com bots' }));
  expect(send).toHaveBeenCalledWith({ type: 'FILL_BOTS' });
  expect(screen.queryByText('Bot')).toBeNull();
  expect(screen.getByRole('button', { name: 'Iniciar partida' }).hasAttribute('disabled')).toBe(
    true,
  );
  const filled: RoomView = {
    ...state,
    seats: [
      ...state.seats.slice(0, 3),
      { seat: 3, nickname: 'Bot 4', bot: true, connected: true, ready: true },
    ],
  };
  view.rerender(<Lobby room={filled} send={send} />);
  expect(screen.getByText('Bot')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Preencher com bots' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remover bots' }));
  expect(send).toHaveBeenCalledWith({ type: 'CLEAR_BOTS' });
  expect(screen.getByRole('button', { name: 'Iniciar partida' }).hasAttribute('disabled')).toBe(
    false,
  );
  view.rerender(<Lobby room={{ ...filled, selfSeat: 1 }} send={send} />);
  expect(screen.queryByRole('group', { name: 'Bots da sala' })).toBeNull();
  expect(screen.getByText('Bot')).toBeTruthy();
  view.rerender(<Lobby room={{ ...state, botFillEnabled: false }} send={send} />);
  expect(screen.queryByRole('group', { name: 'Bots da sala' })).toBeNull();
  view.rerender(<Lobby room={{ ...filled, status: 'playing' }} send={send} />);
  expect(screen.queryByRole('group', { name: 'Bots da sala' })).toBeNull();

  view.rerender(
    <Lobby room={{ ...state, seats: [state.seats[0] ?? null, null, null, null] }} send={send} />,
  );
  expect(screen.queryByRole('button', { name: 'Preencher com bots' })).toBeNull();
  view.rerender(
    <Lobby
      room={{
        ...filled,
        config: defaultRoomConfig,
        seats: [
          filled.seats[0] ?? null,
          { seat: 1, nickname: 'Bot 2', bot: true, connected: true, ready: true },
        ],
      }}
      send={send}
    />,
  );
  expect(screen.getByRole('button', { name: 'Iniciar partida' }).hasAttribute('disabled')).toBe(
    true,
  );
  expect(
    screen.getByText('Jogar com bots no multiplayer exige pelo menos dois jogadores.'),
  ).toBeDefined();
});
