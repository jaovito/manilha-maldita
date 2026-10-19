import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { CardFace } from '.';

test('five has a distinct pixel glyph in both corners without changing card identity', () => {
  const view = render(<CardFace card={{ rank: '5', suit: 'hearts' }} />);
  expect(view.container.querySelectorAll('.card-rank[data-rank="5"]')).toHaveLength(2);
  expect(view.container.querySelector('.card-corner-bottom .card-rank')?.textContent).toBe('5');
  expect(view.container.querySelector('.card-red')).not.toBeNull();

  view.rerender(<CardFace card={{ rank: '6', suit: 'clubs' }} />);
  expect(view.container.querySelectorAll('.card-rank[data-rank="5"]')).toHaveLength(0);
  expect(view.container.querySelector('.card-rank')?.textContent).toBe('6');
  expect(view.container.querySelector('.card-black')).not.toBeNull();
});
