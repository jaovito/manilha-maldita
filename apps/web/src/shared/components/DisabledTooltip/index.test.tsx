import { expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DisabledTooltip, disabledHint } from './index';
import { tooltipPosition } from './position';

test('hint attributes use one accessible reason and remove stale reasons for enabled controls', () => {
  expect(disabledHint('Aguarde sua vez.')).toEqual({
    title: 'Aguarde sua vez.',
    'aria-description': 'Aguarde sua vez.',
    'data-disabled-reason': 'Aguarde sua vez.',
  });
  expect(disabledHint(null)).toEqual({
    title: undefined,
    'aria-description': undefined,
    'data-disabled-reason': undefined,
  });
  expect(disabledHint('')).toEqual(disabledHint(undefined));
});

test('position stays inside narrow viewports and chooses below when no space exists above', () => {
  expect(
    tooltipPosition(
      { left: 100, top: 200, bottom: 244, width: 100 },
      { width: 200, height: 50 },
      { width: 500, height: 500 },
    ),
  ).toEqual({ left: 50, top: 140 });
  expect(
    tooltipPosition(
      { left: -10, top: 0, bottom: 44, width: 40 },
      { width: 200, height: 50 },
      { width: 320, height: 568 },
    ),
  ).toEqual({ left: 8, top: 54 });
  expect(
    tooltipPosition(
      { left: 300, top: 500, bottom: 544, width: 40 },
      { width: 200, height: 150 },
      { width: 320, height: 568 },
    ),
  ).toEqual({ left: 112, top: 340 });
  expect(
    tooltipPosition(
      { left: 300, top: 0, bottom: 440, width: 40 },
      { width: 200, height: 150 },
      { width: 320, height: 200 },
    ),
  ).toEqual({ left: 112, top: 42 });
  expect(
    tooltipPosition(
      { left: 0, top: 0, bottom: 100, width: 20 },
      { width: 200, height: 150 },
      { width: 100, height: 100 },
    ),
  ).toEqual({ left: 8, top: 8 });
});

test('disabled controls keep native blocking and show an opaque portal outside clipping parents', () => {
  const click = mock(() => {});
  const view = render(
    <>
      <DisabledTooltip />
      <div style={{ overflow: 'hidden' }}>
        <p id="previous-help">Ajuda existente</p>
        <button
          type="button"
          disabled
          aria-describedby="previous-help"
          {...disabledHint('Aguarde sua vez.')}
          onClick={click}
        >
          <span>Truco</span>
        </button>
      </div>
    </>,
  );
  const button = screen.getByRole('button', { name: 'Truco' });
  fireEvent.pointerOver(button.firstChild ?? button);
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip.textContent).toBe('Aguarde sua vez.');
  expect(button.getAttribute('title')).toBeNull();
  expect(tooltip.parentElement).toBe(document.body);
  expect(button.getAttribute('aria-description')).toBe('Aguarde sua vez.');
  expect(button.getAttribute('aria-describedby')).toContain(tooltip.id);
  expect(button.getAttribute('aria-describedby')).toContain('previous-help');
  fireEvent.pointerOver(button);
  expect(screen.getByRole('tooltip')).toBe(tooltip);
  fireEvent.click(button);
  expect(click).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'a' });
  expect(screen.getByRole('tooltip')).toBe(tooltip);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(button.getAttribute('aria-describedby')).toBe('previous-help');
  expect(button.getAttribute('title')).toBe('Aguarde sua vez.');
  fireEvent.pointerDown(button, { pointerType: 'touch' });
  expect(screen.getByRole('tooltip').textContent).toBe('Aguarde sua vez.');
  fireEvent.pointerOut(button, { pointerType: 'touch', relatedTarget: null });
  expect(screen.getByRole('tooltip').textContent).toBe('Aguarde sua vez.');
  fireEvent.pointerDown(document.body, { pointerType: 'touch' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  view.unmount();
  fireEvent.pointerOver(button);
  fireEvent.pointerDown(button);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('keyboard focus explains unavailable activations, escape closes and listeners clean up', () => {
  const view = render(
    <>
      <DisabledTooltip />
      <button type="button" {...disabledHint('Sem energia. Clique para ver detalhes.')}>
        Poder
      </button>
      <button type="button">Ativo</button>
    </>,
  );
  const power = screen.getByRole('button', { name: 'Poder' });
  act(() => power.focus());
  expect(screen.getByRole('tooltip').textContent).toContain('Sem energia');
  expect(power.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  fireEvent.pointerOut(power, { relatedTarget: screen.getByRole('button', { name: 'Ativo' }) });
  expect(screen.getByRole('tooltip')).toBeDefined();
  fireEvent.pointerOut(power, { relatedTarget: null });
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.pointerOver(power);
  fireEvent.scroll(window);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.pointerOver(power);
  fireEvent.resize(window);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.pointerOver(power);
  act(() => screen.getByRole('button', { name: 'Ativo' }).focus());
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.pointerOver(power);
  view.unmount();
  expect(power.getAttribute('aria-describedby')).toBeNull();
  fireEvent.focusIn(document.body);
  fireEvent.pointerOut(document.body);
  fireEvent.resize(window);
  fireEvent.scroll(window);
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('removed or newly enabled controls cannot leave an obsolete tooltip behind', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');
  let notify = () => {};
  const disconnect = mock(() => {});
  class Observer {
    constructor(callback: () => void) {
      notify = callback;
    }
    observe() {}
    disconnect = disconnect;
  }
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: Observer });
  try {
    const view = render(
      <>
        <DisabledTooltip />
        <button type="button" disabled {...disabledHint('Aguarde.')}>
          Jogar
        </button>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Jogar' });
    fireEvent.pointerOver(button);
    act(() => notify());
    expect(screen.getByRole('tooltip')).toBeDefined();
    view.rerender(
      <>
        <DisabledTooltip />
        <button type="button" disabled {...disabledHint('Reconectando.')}>
          Jogar
        </button>
      </>,
    );
    act(() => notify());
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button.getAttribute('title')).toBe('Reconectando.');
    fireEvent.pointerOver(button);
    view.rerender(
      <>
        <DisabledTooltip />
        <button type="button">Jogar</button>
      </>,
    );
    act(() => notify());
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button.getAttribute('title')).toBeNull();
    view.rerender(
      <>
        <DisabledTooltip />
        <button type="button" disabled {...disabledHint('Aguarde.')}>
          Jogar
        </button>
      </>,
    );
    fireEvent.pointerOver(button);
    expect(screen.getByRole('tooltip')).toBeDefined();
    view.rerender(<DisabledTooltip />);
    act(() => notify());
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerOver(document.createTextNode('sem controle'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'MutationObserver', descriptor);
  }
});

test('connection-level reasons override stale individual actions without exposing snapshot data', () => {
  render(
    <>
      <DisabledTooltip />
      <div aria-disabled="true" {...disabledHint('Aguarde reconectar.')}>
        <button type="button" disabled {...disabledHint('Aguarde sua vez.')}>
          Truco
        </button>
      </div>
    </>,
  );
  fireEvent.pointerOver(screen.getByRole('button', { name: 'Truco' }));
  expect(screen.getByRole('tooltip').textContent).toBe('Aguarde reconectar.');
});

test('hover can cross from origin to tooltip and its contents before dismissal outside', () => {
  const timeoutDescriptor = Object.getOwnPropertyDescriptor(window, 'setTimeout');
  const clearDescriptor = Object.getOwnPropertyDescriptor(window, 'clearTimeout');
  const pending = new Map<number, () => void>();
  let timerId = 0;
  Object.defineProperty(window, 'setTimeout', {
    configurable: true,
    value: (callback: () => void) => {
      const id = ++timerId;
      pending.set(id, callback);
      return id;
    },
  });
  Object.defineProperty(window, 'clearTimeout', {
    configurable: true,
    value: (id: number) => pending.delete(id),
  });
  try {
    const view = render(
      <>
        <DisabledTooltip />
        <button type="button" disabled {...disabledHint('Aguarde sua vez.')}>
          Truco
        </button>
        <div data-testid="outside">Fora</div>
      </>,
    );
    const origin = screen.getByRole('button', { name: 'Truco' });
    const outside = screen.getByTestId('outside');
    fireEvent.pointerOver(outside);
    expect(pending.size).toBe(0);
    fireEvent.pointerOver(origin);
    const tooltip = screen.getByRole('tooltip');
    fireEvent.pointerOut(origin, { relatedTarget: document.body });
    fireEvent.pointerOver(document.body);
    expect(pending.size).toBe(1);
    fireEvent.pointerOver(tooltip);
    expect(pending.size).toBe(0);
    expect(screen.getByRole('tooltip')).toBe(tooltip);
    fireEvent.pointerDown(tooltip);
    fireEvent.focusIn(tooltip);
    expect(screen.getByRole('tooltip')).toBe(tooltip);
    fireEvent.pointerOut(tooltip, { relatedTarget: origin });
    expect(pending.size).toBe(0);
    fireEvent.pointerOver(origin);
    fireEvent.pointerOut(origin, { relatedTarget: tooltip });
    expect(pending.size).toBe(0);
    fireEvent.pointerOver(tooltip);
    fireEvent.scroll(tooltip);
    expect(screen.getByRole('tooltip')).toBe(tooltip);
    fireEvent.pointerOut(tooltip, { relatedTarget: outside });
    fireEvent.pointerOver(outside);
    expect(screen.getByRole('tooltip')).toBe(tooltip);
    expect(pending.size).toBe(1);
    act(() => {
      for (const [id, callback] of pending) {
        pending.delete(id);
        callback();
      }
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerOver(origin);
    fireEvent.pointerOut(origin, { relatedTarget: outside });
    expect(pending.size).toBe(1);
    view.unmount();
    expect(pending.size).toBe(0);
  } finally {
    if (timeoutDescriptor) Object.defineProperty(window, 'setTimeout', timeoutDescriptor);
    else Reflect.deleteProperty(window, 'setTimeout');
    if (clearDescriptor) Object.defineProperty(window, 'clearTimeout', clearDescriptor);
    else Reflect.deleteProperty(window, 'clearTimeout');
  }
});

test('internal tooltip scrolling preserves reading while external scrolling closes it', () => {
  render(
    <>
      <DisabledTooltip />
      <button type="button" disabled {...disabledHint('Aguarde sua vez.')}>
        Truco
      </button>
      <div data-testid="scrollable">Outro painel</div>
    </>,
  );
  const origin = screen.getByRole('button', { name: 'Truco' });
  fireEvent.pointerOver(origin);
  const tooltip = screen.getByRole('tooltip');
  const nestedText = document.createElement('span');
  nestedText.textContent = 'Mais detalhes';
  tooltip.append(nestedText);
  fireEvent.pointerOver(nestedText);
  fireEvent.pointerDown(nestedText, { pointerType: 'touch' });
  fireEvent.scroll(nestedText);
  fireEvent.scroll(tooltip);
  expect(screen.getByRole('tooltip')).toBe(tooltip);
  fireEvent.scroll(screen.getByTestId('scrollable'));
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.pointerOver(origin);
  fireEvent.scroll(window);
  expect(screen.queryByRole('tooltip')).toBeNull();
});
