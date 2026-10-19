import { expect, mock, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { Table } from '..';
import { playing } from '../index.test';

test('masked and covered plays have distinct public backs without concealed identities', () => {
  const state = playing();
  if (!state.match) throw new Error('Missing match');
  const send = mock(() => {});
  const masked = {
    ...state,
    match: {
      ...state.match,
      hand: {
        ...state.match.hand,
        plays: [{ seat: 1, covered: false as const, power: 'mask' as const }],
      },
    },
  };
  const view = render(<Table room={masked} send={send} />);
  const back = screen.getByRole('img', { name: 'Carta mascarada' });
  expect(back.textContent).toContain('Vale força');
  expect(back.getAttribute('aria-description')).toContain('mantém a força');
  expect(back.querySelector('.card-face')).toBeNull();
  expect(back.querySelector('.card-rank')).toBeNull();
  expect(back.querySelector('.card-back-masked')).not.toBeNull();

  view.rerender(<Table room={state} send={send} />);
  const covered = screen.getByRole('img', { name: 'Carta coberta' });
  expect(covered.textContent).toContain('Sem força');
  expect(covered.querySelector('.card-back-covered')).not.toBeNull();
  expect(covered.querySelector('.card-back-masked')).toBeNull();

  view.rerender(
    <Table
      room={{
        ...masked,
        match: {
          ...masked.match,
          hand: {
            ...masked.match.hand,
            plays: [
              { seat: 1, covered: false, power: 'mask', card: { rank: 'K', suit: 'spades' } },
            ],
          },
        },
      }}
      send={send}
    />,
  );
  const revealed = screen.getByRole('img', { name: 'K de Espadas ♠' });
  expect(revealed.querySelector('.card-face')).not.toBeNull();
  expect(revealed.querySelector('.card-back')).toBeNull();
  expect(revealed.getAttribute('aria-description')).toContain('mantém a força');
  expect(send).not.toHaveBeenCalled();
});
