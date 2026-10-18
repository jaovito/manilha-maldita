import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RoomView } from '@truco/game-protocol';
import type { Action } from '../../../../../../shared/transport/client';
import { playing } from '../../index.test';
import { MatchResult } from './index';

const send = mock((_action: Action) => {});

function finalRoom(base: RoomView): RoomView {
  if (!base.match) throw new Error('MISSING_MATCH');

  return {
    ...base,
    status: 'finished',
    decisionId: null,
    deadline: null,
    outcome: { winner: 'A', reason: 'completed' },
    match: { ...base.match, phase: { type: 'MATCH_END', winner: 'A' }, score: { A: 12, B: 6 } },
  };
}

test('final menu exposes only authorized room actions, keeps keyboard focus and waits for connection', () => {
  const room = finalRoom(playing());
  const view = render(<MatchResult send={send} room={room} />);
  const menu = screen.getByRole('dialog', { name: 'Resultado da partida' });
  const title = screen.getByRole('heading', { name: 'VOCÊ VENCEU!!' });
  const rematch = screen.getByRole('button', { name: 'Revanche' });
  const lobby = screen.getByRole('button', { name: 'Voltar ao lobby' });
  const leave = screen.getByRole('button', { name: 'Sair da sala' });
  expect(screen.queryByLabelText('Tempo de carta')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Lobby' })).toBeNull();
  expect(document.activeElement).toBe(title);
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBe(menu);
  fireEvent.keyDown(title, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(leave);
  fireEvent.keyDown(leave, { key: 'Tab' });
  expect(document.activeElement).toBe(rematch);
  fireEvent.keyDown(rematch, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(leave);
  fireEvent.keyDown(lobby, { key: 'Tab' });
  fireEvent.click(rematch);
  fireEvent.click(lobby);
  fireEvent.click(leave);
  expect(send.mock.calls).toEqual([
    [{ type: 'REMATCH' }],
    [{ type: 'REMATCH' }],
    [{ type: 'LEAVE' }],
  ]);

  view.rerender(<MatchResult send={send} room={{ ...room, selfSeat: 1 }} />);
  expect(rematch.hasAttribute('disabled')).toBe(true);
  expect(rematch.getAttribute('aria-description')).toContain('anfitrião');
  expect(lobby.hasAttribute('disabled')).toBe(true);
  expect(leave.hasAttribute('disabled')).toBe(false);
  expect(screen.getByText(/Aguarde o anfitrião/)).toBeDefined();
  fireEvent.click(rematch);
  fireEvent.click(lobby);
  expect(send).toHaveBeenCalledTimes(3);
  view.rerender(<MatchResult send={send} room={room} connected={false} />);
  expect(leave.hasAttribute('disabled')).toBe(true);
  expect(leave.getAttribute('data-disabled-reason')).toContain('reconectar');
  expect(rematch.getAttribute('data-disabled-reason')).toContain('reconectar');
  expect(screen.getByText(/Reconectando/)).toBeDefined();
  fireEvent.keyDown(leave, { key: 'Tab' });
  fireEvent.keyDown(title, { key: 'Tab', shiftKey: true });
});
