import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { Candlelight } from './index';

test('candle overlays follow each background without adding accessible content or controls', () => {
  const view = render(<Candlelight variant="menu" />);

  for (const variant of ['menu', 'lobby', 'table'] as const) {
    view.rerender(<Candlelight variant={variant} />);
    const layer = view.container.querySelector(`.candlelight-${variant}`);
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(layer?.querySelectorAll('.candlelight-flame')).toHaveLength(1);
    expect(layer?.querySelectorAll('.candlelight-glow')).toHaveLength(1);
    expect(layer?.textContent).toBe('');
    expect(view.queryAllByRole('button')).toHaveLength(0);
  }
});
