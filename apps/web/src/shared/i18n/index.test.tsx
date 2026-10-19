import { expect, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { catalogs, loadLocale, useLocale } from './index';

function Example() {
  const { locale, changeLocale } = useLocale();
  return (
    <button type="button" onClick={() => changeLocale('en')}>
      {locale}
    </button>
  );
}

test('catalogs keep lesson identity, answers and power costs aligned in both languages', () => {
  expect(catalogs.en.tutorial.lessons.map((lesson) => lesson.id)).toEqual(
    catalogs['pt-BR'].tutorial.lessons.map((lesson) => lesson.id),
  );
  for (const catalog of Object.values(catalogs)) {
    expect(catalog.tutorial.powers.map(({ id, cost }) => [id, cost])).toEqual([
      ['spy', 1],
      ['exchange', 2],
      ['boost', 2],
      ['mask', 1],
    ]);
    for (const lesson of catalog.tutorial.lessons) {
      expect(lesson.choices[lesson.answer]).toBeTruthy();
      expect(lesson.explanation.length).toBeGreaterThan(20);
    }
  }
});

test('invalid preferences fall back to Portuguese; blocked storage never blocks translation', () => {
  localStorage.setItem('truco.locale', 'unknown');
  expect(loadLocale()).toBe('pt-BR');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('blocked');
    },
  });
  try {
    expect(loadLocale()).toBe('pt-BR');
    render(<Example />);
    fireEvent.click(screen.getByRole('button', { name: 'pt-BR' }));
    expect(screen.getByRole('button', { name: 'en' })).toBeDefined();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
  }
});

test('all game translations preserve interpolation slots and resolve lazy labels in both languages', async () => {
  const { gameEnglish } = await import('./game');
  const { t, changeLocale } = await import('./index');
  const { suits, cardLabel } = await import('../../features/room/utils/cards');
  const { powerNames } = await import('../../features/room/components/Table/Powers');
  const { powerInstructions } = await import(
    '../../features/room/components/Table/Powers/selection'
  );
  for (const key of Object.keys(gameEnglish) as (keyof typeof gameEnglish)[]) {
    expect([...gameEnglish[key].matchAll(/\{\d+\}/g)].map(([slot]) => slot).sort()).toEqual(
      [...key.matchAll(/\{\d+\}/g)].map(([slot]) => slot).sort(),
    );
    changeLocale('en');
    expect(t(key)).toBe(gameEnglish[key]);
    changeLocale('pt-BR');
    expect(t(key)).toBe(key);
  }
  changeLocale('en');
  expect(cardLabel({ rank: 'A', suit: 'clubs' })).toBe('A of Clubs ♣');
  expect(Object.values(suits)).toEqual(['Diamonds ♦', 'Spades ♠', 'Hearts ♥', 'Clubs ♣']);
  expect(Object.values(powerNames)).toEqual(['Spy', 'Second Chance', 'Boost', 'Mask']);
  expect(Object.values(powerInstructions).every((message) => message.includes('Choose'))).toBe(
    true,
  );
  expect(t('{0} ativou {1} em {2}.', ['Espião', 'Spy', '<Ana>'])).toBe(
    'Espião activated Spy on <Ana>.',
  );
  expect(t('Energia {0} de 3', [0])).toBe('Energy 0 of 3');
  changeLocale('pt-BR');
});

test('a read-only preference store keeps changes in memory', async () => {
  const { changeLocale, t } = await import('./index');
  localStorage.setItem('truco.locale', 'pt-BR');
  loadLocale();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.getItem(key),
      setItem: () => {
        throw new Error('quota');
      },
    },
  });
  try {
    changeLocale('en');
    expect(loadLocale()).toBe('en');
    expect(t('Criar sala')).toBe('Create room');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    changeLocale('pt-BR');
  }
});
