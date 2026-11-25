import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MenuScenery } from './index';

test('scenery is inaccessible decoration with independent layers and no controls', () => {
  const view = render(<MenuScenery />);
  const scene = view.container.firstElementChild;

  expect(scene?.getAttribute('aria-hidden')).toBe('true');
  expect(view.container.querySelectorAll('.scene-corner')).toHaveLength(4);
  expect(view.container.querySelectorAll('.scene-edge-props img')).toHaveLength(4);
  for (const corner of ['nw', 'ne', 'sw', 'se']) {
    expect(view.container.querySelector(`.corner-${corner}`)?.getAttribute('src')).toBe(
      `/art/layers/border-${corner}.png`,
    );
  }
  expect(view.container.querySelectorAll('.scene-crest')).toHaveLength(4);
  expect(view.container.querySelectorAll('.scene-prop')).toHaveLength(4);
  expect(view.container.querySelectorAll('.scene-playing-card')).toHaveLength(2);
  const candle = view.container.querySelector('.prop-candle');
  expect(candle?.querySelector('.prop-candle-body')?.getAttribute('href')).toBe(
    '/art/layers/candle.png',
  );
  expect(candle?.querySelectorAll('image')).toHaveLength(1);
  expect(candle?.querySelector('.prop-candle-fire')).toBeNull();
  expect(candle?.querySelector('feDisplacementMap')?.getAttribute('in')).toBe('SourceGraphic');
  expect(candle?.querySelector('animate')?.getAttribute('attributeName')).toBe('scale');
  expect(candle?.querySelectorAll('.prop-candle-glow')).toHaveLength(1);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('img')).toBeNull();

  view.rerender(<MenuScenery lobby />);
  expect(view.container.querySelector('.scene-cards')).toBeNull();
  expect(view.container.querySelectorAll('.scene-corner')).toHaveLength(4);
});
