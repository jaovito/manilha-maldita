import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { Table } from '..';
import { playing } from '../index.test';
import { powered } from '../Powers/index.test';
import { explainHand, explainTrick, nextTurnLabel, resolutionFeedback } from './explanation';

type Trick = MatchView['hand']['completedTricks'][number];
function trick(winner: 'A' | 'B' | 'tie', nextLeader = winner === 'B' ? 1 : 0): Trick {
  return {
    leader: 0,
    result: { winner, nextLeader },
    plays: [
      { seat: 0, covered: false, card: { rank: '3', suit: 'hearts' } },
      { seat: 1, covered: false, card: { rank: '4', suit: 'clubs' } },
    ],
  };
}
function resolving(kind: 'deal' | 'trick' | 'hand'): RoomView & { match: MatchView } {
  const base = playing();
  if (!base.match) throw new Error('MISSING_MATCH');

  return {
    ...base,
    transition: { id: `transition_${kind}`, kind, until: Date.now() + 1800 },
    decisionId: null,
    deadline: null,
    match: {
      ...base.match,
      phase:
        kind === 'hand' ? { type: 'HAND_END', winner: 'A', reward: 1 } : { type: 'TURN', seat: 0 },
      hand: { ...base.match.hand, plays: [], completedTricks: kind === 'deal' ? [] : [trick('A')] },
    },
  };
}

test('resolved vaza highlights the authorized winning face, blocks play and explains next leader', () => {
  const room = resolving('trick');
  const send = mock(() => {});
  const view = render(<Table room={room} send={send} />);
  expect(screen.getByText('Sua equipe venceu a vaza 1')).toBeDefined();
  expect(screen.getAllByText('Ana: 3 de Copas ♥ · maior força da vaza.').length).toBeGreaterThan(0);
  expect(view.container.querySelector('[data-winner="true"]')?.textContent).toContain('Ana');
  expect(view.container.querySelector('.own-player .turn-badge')).toBeNull();
  expect((screen.getByRole('button', { name: '3 de Copas ♥' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: '3 de Copas ♥' }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Desistir da partida' }));
  expect(send).toHaveBeenCalledWith({ type: 'SURRENDER' });

  view.rerender(
    <Table room={{ ...room, transition: undefined, decisionId: 'next_turn' }} send={send} />,
  );
  expect(screen.queryByText('Sua equipe venceu a vaza 1')).toBeNull();
  expect(screen.getByText('Você abre a próxima vaza')).toBeDefined();
  expect(view.container.querySelector('.turn-badge')?.textContent).toBe('Sua vez');
  expect((screen.getByRole('button', { name: '3 de Copas ♥' }) as HTMLButtonElement).disabled).toBe(
    false,
  );
});

test('deal blocks preparation and target selection; release restores only legal powers', () => {
  const base = powered('spy');
  const room = {
    ...base,
    transition: resolving('deal').transition,
    decisionId: null,
    deadline: null,
  };
  const send = mock(() => {});
  const view = render(<Table room={room} send={send} />);
  expect(screen.getByText('Distribuindo · mão 2')).toBeDefined();
  expect(
    (screen.getByRole('button', { name: 'Passar preparação' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(view.container.querySelector('.power-card')?.getAttribute('data-can-activate')).toBe(
    'false',
  );
  expect(view.container.querySelectorAll('.deal-card')).toHaveLength(6);
  expect(view.container.querySelectorAll('.seat-active')).toHaveLength(0);
  view.rerender(<Table room={base} send={send} />);
  expect(
    (screen.getByRole('button', { name: 'Passar preparação' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  expect(view.container.querySelector('.power-card')?.getAttribute('data-can-activate')).toBe(
    'true',
  );
});

test('hand result distinguishes win, loss, draw, fold and eleven without revealing remaining cards', () => {
  const room = resolving('hand');
  expect(resolutionFeedback(room)?.title).toBe('Sua equipe venceu a mão · +1 ponto');
  expect(resolutionFeedback({ ...room, selfSeat: 1 })?.title).toBe(
    'Adversários venceram a mão · +1 ponto',
  );
  const match = {
    ...room.match,
    phase: { type: 'HAND_END' as const, winner: 'B' as const, reward: 3 },
  };
  expect(resolutionFeedback({ ...room, match })?.title).toContain('+3 pontos');
  expect(
    explainHand({
      ...match,
      hand: { ...match.hand, betting: { ...match.hand.betting, pendingStake: 6 } },
    }),
  ).toBe('Houve corrida. Vale a aposta já aceita.');
  expect(
    explainHand({ ...match, hand: { ...match.hand, kind: 'eleven', completedTricks: [] } }),
  ).toContain('onze correu');
  const results = (winners: ('A' | 'B' | 'tie')[]) => ({
    ...match,
    hand: { ...match.hand, completedTricks: winners.map((winner) => trick(winner)) },
  });
  expect(explainHand(results(['tie', 'tie', 'tie']))).toContain('sem pontos');
  expect(explainHand(results(['A', 'tie']))).toContain('Uma vitória e um empate');
  expect(explainHand(results(['A', 'B', 'tie']))).toContain('ganhou a primeira');
  expect(explainHand(results(['A', 'A']))).toContain('Duas vazas vencidas');
  expect(
    resolutionFeedback({
      ...room,
      match: {
        ...results(['tie', 'tie', 'tie']),
        phase: { type: 'HAND_END', winner: 'tie', reward: 0 },
      },
    })?.title,
  ).toBe('Mão empatada · sem pontos');
  const view = render(<Table room={{ ...room, match: results(['A', 'A']) }} send={() => {}} />);
  expect(view.container.querySelectorAll('.opponents .card-face')).toHaveLength(0);
});

test('explanations annotate confirmed manilha, boost, mask and ties without deriving winners', () => {
  const room = resolving('trick');
  const match = room.match;
  expect(explainTrick(room, match, trick('tie'))).toContain('Ana continua abrindo');
  const visible = (rank: 'J' | '2', power?: 'boost' | 'mask'): Trick => ({
    ...trick('A'),
    plays: [
      { seat: 0, covered: false, card: { rank, suit: 'clubs' }, ...(power ? { power } : {}) },
    ],
  });
  expect(explainTrick(room, match, visible('J'))).toContain('manilha');
  expect(explainTrick(room, match, visible('2', 'boost'))).toContain('fortalecida por Impulso');
  expect(explainTrick(room, match, visible('2', 'mask'))).toContain('revelada pela Máscara');
  expect(explainTrick(room, match, { ...trick('A'), plays: [{ seat: 0, covered: true }] })).toBe(
    'Ana fez a jogada vencedora e abre a próxima vaza.',
  );
  expect(explainTrick(room, match, { ...trick('B'), plays: [] })).toContain('Jogador');
  expect(nextTurnLabel(room)).toBe('Você abre a próxima vaza');
  expect(nextTurnLabel({ ...room, selfSeat: 1 })).toContain('Ana abre');
  expect(
    nextTurnLabel({ ...room, match: { ...match, phase: { type: 'TURN', seat: 1 } } }),
  ).toContain('Jogador abre');
  const fresh = { ...room, match: { ...match, hand: { ...match.hand, completedTricks: [] } } };
  expect(nextTurnLabel(fresh)).toBe('Escolha uma carta da sua mão');
  expect(nextTurnLabel({ ...fresh, selfSeat: 1 })).toBe('Aguarde a jogada');
  expect(nextTurnLabel({ ...room, match: null })).toBe('');
  expect(nextTurnLabel({ ...room, match: { ...match, phase: { type: 'PREPARATION' } } })).toBe('');
  expect(resolutionFeedback({ ...room, match: null })).toBeNull();
  expect(resolutionFeedback({ ...room, transition: undefined })).toBeNull();
  expect(resolutionFeedback({ ...room, status: 'finished' })).toBeNull();
  expect(resolutionFeedback({ ...fresh, transition: room.transition })).toBeNull();
});
