import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { Table } from './index';
import { playing } from './index.test';

test('room themes follow the viewer and card owner without changing concealed markup or vira', () => {
  const room = playing();
  room.tableTheme = { id: 'burgundy', assetKey: 'burgundy' };
  room.seats = [
    {
      seat: 0,
      nickname: 'Ana',
      connected: true,
      ready: true,
      appearance: {
        avatar: { id: 'avatar-2', avatarUrl: '/art/avatars-pixel.png', spriteIndex: 1 },
        deck: { id: 'ember', assetKey: 'ember' },
      },
    },
    {
      seat: 1,
      nickname: 'Bia',
      connected: true,
      ready: true,
      appearance: {
        avatar: { id: 'avatar-3', avatarUrl: '/art/avatars-pixel.png', spriteIndex: 2 },
        deck: { id: 'arcane', assetKey: 'arcane' },
      },
    },
  ];
  const view = render(<Table room={room} send={() => {}} />);
  expect(view.container.querySelector('.table-scenery')?.getAttribute('data-table')).toBe(
    'burgundy',
  );
  expect(view.container.querySelector('.hand-cards .card-face')?.getAttribute('data-deck')).toBe(
    'ember',
  );
  expect(view.container.querySelector('.seat-cards .card-back')?.getAttribute('data-deck')).toBe(
    'arcane',
  );
  expect(view.container.querySelector('.played-card .card-back')?.getAttribute('data-deck')).toBe(
    'arcane',
  );
  expect(view.container.querySelector('.vira-panel .card-face')?.getAttribute('data-deck')).toBe(
    'classic',
  );
  expect(view.container.querySelectorAll('.seat-cards .card-rank')).toHaveLength(0);
  expect(
    view.container.querySelector('.own-player .player-avatar')?.getAttribute('data-avatar'),
  ).toBe('1');
  expect(
    view.container.querySelector('.player-seat .player-avatar')?.getAttribute('data-avatar'),
  ).toBe('2');
  view.rerender(
    <Table
      room={{ ...room, tableTheme: { id: 'midnight', assetKey: 'midnight' } }}
      send={() => {}}
    />,
  );
  expect(view.container.querySelector('.table-scenery')?.getAttribute('data-table')).toBe(
    'midnight',
  );
  expect(view.container.querySelector('.hand-cards .card-face')?.getAttribute('data-deck')).toBe(
    'ember',
  );
});
