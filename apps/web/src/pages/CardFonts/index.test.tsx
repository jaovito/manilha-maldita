import { expect, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { CardFonts } from './index';

test('font comparison shows every Truco card for each candidate without the game account flow', () => {
  const view = render(<CardFonts />);
  expect(screen.getAllByRole('img')).toHaveLength(240);
  expect(screen.getAllByRole('region', { name: /^40 cartas/ })).toHaveLength(6);
  expect(screen.getByRole('img', { name: '5 de ouros, Jersey 10' })).toBeDefined();
  expect(screen.getByRole('img', { name: 'Q de paus, Tiny5' })).toBeDefined();
  expect(view.container.querySelectorAll('.card-face[data-deck="classic"]')).toHaveLength(240);
  expect(screen.getByRole('link', { name: '← Voltar ao jogo' }).getAttribute('href')).toBe('/');
});

test('font, theme and size filters retain all forty cards and can restore the comparison', () => {
  const view = render(<CardFonts />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Fonte' }), {
    target: { value: 'atkinson' },
  });
  expect(screen.getAllByRole('img')).toHaveLength(40);
  expect(screen.getByRole('heading', { level: 2, name: 'Atkinson Hyperlegible' })).toBeDefined();
  fireEvent.change(screen.getByRole('combobox', { name: 'Tema da carta' }), {
    target: { value: 'arcane' },
  });
  expect(view.container.querySelectorAll('.card-face[data-deck="arcane"]')).toHaveLength(40);
  fireEvent.change(screen.getByRole('combobox', { name: 'Tema da carta' }), {
    target: { value: 'ember' },
  });
  expect(view.container.querySelectorAll('.card-face[data-deck="ember"]')).toHaveLength(40);
  fireEvent.change(screen.getByRole('combobox', { name: 'Tamanho da carta' }), {
    target: { value: '76' },
  });
  expect(
    view.container.querySelector('main')?.style.getPropertyValue('--comparison-card-width'),
  ).toBe('76px');
  fireEvent.change(screen.getByRole('combobox', { name: 'Fonte' }), {
    target: { value: 'all' },
  });
  expect(screen.getAllByRole('img')).toHaveLength(400);
  fireEvent.change(screen.getByRole('combobox', { name: 'Fonte' }), { target: { value: 'pixel' } });
  expect(screen.getAllByRole('img')).toHaveLength(240);
  for (const name of ['Jersey 10', 'Tiny5', 'Micro 5', 'VT323'])
    expect(screen.getByRole('heading', { level: 2, name })).toBeDefined();
});
