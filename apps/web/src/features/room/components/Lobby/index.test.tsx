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
test('lobby controls configure room, choose seats, readiness, start and rematch', () => {
  const send = mock(() => {});
  const state = room();
  const view = render(<Lobby room={state} send={send} />);
  expect(screen.getByRole('heading', { name: 'Sala ABC123' })).toBeDefined();
  expect(screen.getByText('Você')).toBeDefined();
  expect(screen.getByText('Anfitrião')).toBeDefined();
  expect(screen.getByText('Ana · conectado · aguardando')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Sentar no assento 2' }));
  fireEvent.click(screen.getByRole('radio', { name: '2v2' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Competitivo' }));
  fireEvent.change(screen.getByLabelText('Tempo de carta'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Tempo de resposta'), { target: { value: '15000' } });
  expect(send).toHaveBeenCalledTimes(5);
  view.rerender(
    <Lobby
      room={{
        ...state,
        seats: [
          { seat: 0, nickname: 'Ana', connected: true, ready: true },
          { seat: 1, nickname: 'Beto', connected: true, ready: true },
        ],
      }}
      send={send}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar pronto' }));
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar partida' }));
  view.rerender(<Lobby room={{ ...state, status: 'finished' }} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Revanche' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
  expect(send).toHaveBeenCalledTimes(9);
});

test('occupied seats cannot be selected even before ready, and active games hide leave', () => {
  const send = mock(() => {});
  const state = room();
  const full = {
    ...state,
    seats: [
      { seat: 0, nickname: 'Ana', connected: true, ready: false },
      { seat: 1, nickname: 'Beto', connected: true, ready: false },
    ],
  };
  const view = render(<Lobby room={full} send={send} />);
  expect(screen.queryByRole('button', { name: /assento/i })).toBeNull();
  expect(send).not.toHaveBeenCalled();
  view.rerender(<Lobby room={{ ...full, status: 'playing' }} send={send} />);
  expect(screen.queryByRole('button', { name: 'Sair da sala' })).toBeNull();
});

test('start explains missing players, readiness and reconnection without bypassing requirements', () => {
  const state = room();
  const send = mock(() => {});
  const view = render(<Lobby room={state} send={send} />);
  const start = screen.getByRole('button', { name: 'Iniciar partida' });

  expect(start.hasAttribute('disabled')).toBe(true);
  expect(screen.getByText(/Falta 1 jogador para completar a sala 1v1/)).toBeTruthy();
  expect(screen.getByText(/Você ainda precisa clicar em “Estou pronto”/)).toBeTruthy();
  expect(screen.getByText(/Abas da mesma sessão controlam o mesmo assento/)).toBeTruthy();

  const selfReady = { seat: 0, nickname: 'Ana', connected: true, ready: true };
  const guest = { seat: 1, nickname: 'Beto', connected: true, ready: false };
  view.rerender(<Lobby room={{ ...state, seats: [selfReady, guest] }} send={send} />);

  expect(screen.queryByText(/Falta 1 jogador/)).toBeNull();
  expect(screen.getByText(/Beto ainda precisa clicar em “Estou pronto”/)).toBeTruthy();
  expect(start.hasAttribute('disabled')).toBe(true);

  view.rerender(
    <Lobby
      room={{ ...state, seats: [selfReady, { ...guest, ready: true, connected: false }] }}
      send={send}
    />,
  );

  expect(screen.getByText('Aguardando a reconexão de Beto.')).toBeTruthy();
  expect(start.hasAttribute('disabled')).toBe(true);

  view.rerender(
    <Lobby room={{ ...state, seats: [selfReady, { ...guest, ready: true }] }} send={send} />,
  );

  expect(screen.getByText('Todos estão conectados e prontos.')).toBeTruthy();
  expect(start.hasAttribute('disabled')).toBe(false);
  expect(start.getAttribute('aria-describedby')).toBe('start-requirements');
  fireEvent.click(start);
  expect(send).toHaveBeenCalledWith({ type: 'START_MATCH' });

  view.rerender(<Lobby room={{ ...state, selfSeat: 1 }} send={send} />);

  expect(screen.queryByRole('button', { name: 'Iniciar partida' })).toBeNull();
  expect(screen.getByText('Somente o anfitrião pode iniciar a partida.')).toBeTruthy();
});

test('2v2 explains every remaining seat and only the current readiness', () => {
  const state = room();
  render(
    <Lobby
      room={{
        ...state,
        config: { ...state.config, format: '2v2' },
        seats: [...state.seats, null, null],
      }}
      send={() => {}}
    />,
  );

  expect(screen.getByText(/Faltam 3 jogadores para completar a sala 2v2/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Iniciar partida' }).hasAttribute('disabled')).toBe(
    true,
  );
});

test('the lobby workbench groups alternating seats relative to the viewer and exposes invitation settings', () => {
  const state = room();
  const send = mock(() => {});
  const view = render(
    <Lobby
      room={{
        ...state,
        selfSeat: 1,
        config: { ...state.config, format: '2v2' },
        seats: [
          state.seats[0] ?? null,
          { seat: 1, nickname: 'Beto', connected: true, ready: false },
          null,
          null,
        ],
      }}
      send={send}
    />,
  );
  const own = screen.getByRole('region', { name: 'Sua equipe' });
  const enemy = screen.getByRole('region', { name: 'Adversários' });

  expect(own.textContent).toContain('Beto · conectado · aguardando');
  expect(own.textContent).toContain('Equipe B · Assento 2');
  expect(own.textContent).toContain('Equipe B · Assento 4');
  expect(own.textContent).not.toContain('Ana');
  expect(enemy.textContent).toContain('Equipe A · Assento 1');
  expect(enemy.textContent).toContain('Equipe A · Assento 3');
  expect(view.container.querySelectorAll('.lobby-workbench > div')).toHaveLength(2);
  expect(screen.getByLabelText<HTMLInputElement>('Link de convite').value).toBe(
    `${location.origin}/?room=${state.code}`,
  );
  expect(screen.getByLabelText<HTMLInputElement>('Link de convite').readOnly).toBe(true);
  expect(view.container.querySelector('.lobby-players-column .lobby-team')).toBe(own);
  expect(screen.getByRole('button', { name: 'Copiar link da sala' })).toBeDefined();
  expect(screen.getByRole('switch', { name: 'Sala privada' }).hasAttribute('disabled')).toBe(true);
  const powers = screen.getByText('Ver poderes');
  fireEvent.click(powers);
  expect(screen.getByText(/Espião · 1 energia/)).toBeDefined();
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole('combobox', { name: 'Formato' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Sentar no assento 4' }));
  expect(send).toHaveBeenCalledWith({ type: 'SET_SEAT', seat: 3 });
});

test('competitive settings preserve fixed clocks and finished lobbies retain rematch controls', () => {
  const state = room();
  const send = mock(() => {});
  const competitive = {
    ...state.config,
    preset: 'competitive' as const,
    cardTimeoutMs: 20000,
    responseTimeoutMs: 15000,
    preparationTimeoutMs: 10000,
  };
  const view = render(<Lobby room={{ ...state, config: competitive }} send={send} />);

  expect(screen.getByRole('radiogroup', { name: 'Preset' })).toBeDefined();
  expect(screen.queryByRole('combobox', { name: 'Tempo de carta' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Tempo de resposta' })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: '2v2' }));
  expect(send).toHaveBeenCalledWith({
    type: 'CONFIGURE',
    config: { ...competitive, format: '2v2' },
  });

  view.rerender(
    <Lobby
      room={{ ...state, status: 'finished', config: { ...state.config, cardTimeoutMs: null } }}
      send={send}
    />,
  );
  expect(screen.getByText(/Sem relógio de cartas/)).toBeDefined();
  expect(screen.queryByRole('combobox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Revanche' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
  expect(send).toHaveBeenCalledWith({ type: 'REMATCH' });
  expect(send).toHaveBeenCalledWith({ type: 'LEAVE' });
});

test('pixel controls reflect server selection and keep privacy and powers fixed', () => {
  const state = room();
  const send = mock(() => {});
  const view = render(<Lobby room={state} send={send} />);
  expect(screen.queryByText('Somente leitura')).toBeNull();
  expect((screen.getByRole('radio', { name: '1v1' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('radio', { name: 'Casual' }) as HTMLInputElement).checked).toBe(true);
  const privacy = screen.getByRole('switch', { name: 'Sala privada' }) as HTMLInputElement;
  const powers = screen.getByRole('switch', { name: 'Poderes aleatórios' }) as HTMLInputElement;
  expect(privacy.checked && privacy.disabled).toBe(true);
  expect(powers.checked).toBe(true);
  expect(powers.disabled).toBe(true);
  expect(send).not.toHaveBeenCalled();

  view.rerender(
    <Lobby
      room={{ ...state, config: { ...state.config, format: '2v2', preset: 'competitive' } }}
      send={send}
    />,
  );
  expect((screen.getByRole('radio', { name: '2v2' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: '1v1' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Casual' }));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenLastCalledWith({
    type: 'CONFIGURE',
    config: { ...state.config, format: '2v2' },
  });

  view.rerender(<Lobby room={{ ...state, selfSeat: 1 }} send={send} />);
  const radio = screen.getByRole('radio', { name: '2v2' });
  expect((radio.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
  expect(screen.getByText('Somente leitura')).toBeDefined();
  expect(radio.closest('fieldset')?.getAttribute('aria-describedby')).toBe(
    screen.getByText('Somente leitura').id,
  );
});

test('host can adjust preparation time before playing and guests cannot change it', () => {
  const state = room();
  const send = mock(() => {});
  const view = render(<Lobby room={state} send={send} />);
  fireEvent.change(screen.getByLabelText('Tempo de preparação'), { target: { value: '30000' } });
  expect(send).toHaveBeenLastCalledWith({
    type: 'CONFIGURE',
    config: { ...state.config, preparationTimeoutMs: 30000 },
  });
  view.rerender(<Lobby room={{ ...state, selfSeat: 1 }} send={send} />);
  expect(screen.queryByLabelText('Tempo de preparação')).toBeNull();
});
