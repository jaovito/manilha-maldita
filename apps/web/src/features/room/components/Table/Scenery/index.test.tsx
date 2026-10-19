import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { TableScenery } from './index';

test('table layers retain the complete decoration without controls or match data', () => {
  const view = render(<TableScenery />);
  const scene = view.container.querySelector('.table-scenery');

  expect(scene?.getAttribute('aria-hidden')).toBe('true');
  for (const layer of ['floor', 'felt', 'rail']) {
    expect(scene?.querySelectorAll(`.table-${layer}`)).toHaveLength(1);
  }
  expect(scene?.querySelectorAll('.table-ornament')).toHaveLength(4);
  expect(scene?.querySelectorAll('.table-corner-props')).toHaveLength(4);
  expect(scene?.querySelectorAll('.table-cloth')).toHaveLength(4);
  expect(scene?.querySelectorAll('.table-deck')).toHaveLength(2);
  expect(scene?.querySelectorAll('.table-coins')).toHaveLength(2);
  expect(scene?.querySelectorAll('.table-mate')).toHaveLength(1);
  expect(scene?.querySelectorAll('.prop-candle-body')).toHaveLength(1);
  expect(scene?.textContent).toBe('');
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();

  const candle = scene?.querySelector('.prop-candle-body') ?? null;
  view.rerender(<TableScenery />);
  expect(view.container.querySelector('.prop-candle-body')).toBe(candle);
});
