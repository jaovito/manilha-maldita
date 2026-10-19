import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RoomView } from '@truco/game-protocol';
import { playing } from '../index.test';
import { TableActions } from './index';

function actions(room: RoomView) {
  if (!room.match) throw new Error('MISSING_MATCH');
  return (
    <TableActions
      room={room}
      match={room.match}
      covered={false}
      setCovered={() => {}}
      send={() => {}}
    />
  );
}

test('Truco explains the precise blocking rule and clears the hint when available', () => {
  const base = playing();
  if (!base.match) throw new Error('MISSING_MATCH');
  const view = render(actions(base));
  const raise = () => screen.getByRole('button', { name: 'Pedir Truco / aumentar' });
  expect(raise().getAttribute('data-disabled-reason')).toBeNull();
  view.rerender(actions({ ...base, match: { ...base.match, phase: { type: 'TURN', seat: 1 } } }));
  expect(raise().getAttribute('data-disabled-reason')).toContain('na sua vez');
  view.rerender(
    actions({ ...base, match: { ...base.match, hand: { ...base.match.hand, kind: 'eleven' } } }),
  );
  expect(raise().getAttribute('data-disabled-reason')).toContain('onze');
  view.rerender(
    actions({
      ...base,
      match: {
        ...base.match,
        hand: { ...base.match.hand, betting: { ...base.match.hand.betting, acceptedStake: 12 } },
      },
    }),
  );
  expect(raise().getAttribute('data-disabled-reason')).toContain('limite de 12');
  view.rerender(
    actions({
      ...base,
      match: {
        ...base.match,
        hand: { ...base.match.hand, betting: { ...base.match.hand.betting, lastRaisingTeam: 'A' } },
      },
    }),
  );
  expect(raise().getAttribute('data-disabled-reason')).toContain('própria proposta');
  view.rerender(actions({ ...base, paused: true }));
  expect(raise().getAttribute('data-disabled-reason')).toContain('pausada');
  expect(
    screen
      .getByRole('button', { name: 'Desistir da partida' })
      .getAttribute('data-disabled-reason'),
  ).toContain('reconexão');
  view.rerender(actions(base));
  expect(raise().getAttribute('aria-description')).toBeNull();
});

test('betting cap, preparation, covered cards and transitions retain native action blocking', () => {
  const base = playing();
  if (!base.match) throw new Error('MISSING_MATCH');
  const send = mock(() => {});
  const covered = mock(() => {});
  const response = {
    ...base.match,
    phase: { type: 'RAISE_RESPONSE' as const },
    hand: {
      ...base.match.hand,
      betting: {
        ...base.match.hand.betting,
        lastRaisingTeam: 'B' as const,
        pendingStake: 12 as const,
      },
    },
  };
  const view = render(
    <TableActions room={base} match={response} covered={false} setCovered={covered} send={send} />,
  );
  const counter = screen.getByRole('button', { name: /SEEEIS!|NOOVE!|DOOOZE!!|Limite de 12/ });
  expect(counter.getAttribute('data-disabled-reason')).toContain('aceitar ou correr');
  fireEvent.click(counter);
  expect(send).not.toHaveBeenCalled();
  expect(
    screen
      .getByLabelText('Jogar coberta (a partir da segunda vaza)')
      .getAttribute('data-disabled-reason'),
  ).toContain('segunda vaza');
  const preparation = { ...base.match, phase: { type: 'PREPARATION' as const } };
  view.rerender(
    <TableActions
      room={{ ...base, transition: { id: 'deal_one', kind: 'deal', until: 100 } }}
      match={preparation}
      covered={false}
      setCovered={covered}
      send={send}
    />,
  );
  const pass = screen.getByRole('button', { name: 'Passar preparação' });
  expect(pass.getAttribute('data-disabled-reason')).toContain('distribuição');
  fireEvent.click(pass);
  expect(send).not.toHaveBeenCalled();
  view.rerender(
    actions({ ...base, match: { ...base.match, hand: { ...base.match.hand, kind: 'decisive' } } }),
  );
  expect(
    screen
      .getByLabelText('Jogar coberta (a partir da segunda vaza)')
      .getAttribute('data-disabled-reason'),
  ).toContain('decisiva');
  view.rerender(
    actions({
      ...base,
      match: {
        ...base.match,
        phase: { type: 'TURN', seat: 1 },
        hand: {
          ...base.match.hand,
          completedTricks: [{ leader: 0, plays: [], result: { winner: 'A', nextLeader: 0 } }],
        },
      },
    }),
  );
  expect(
    screen
      .getByLabelText('Jogar coberta (a partir da segunda vaza)')
      .getAttribute('data-disabled-reason'),
  ).toContain('Aguarde sua vez');
});
