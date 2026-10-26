import { expect, test } from 'bun:test';
import { isLoginName, isPassword } from '../index';

test('login identifiers obey the canonical database contract without coercion', () => {
  for (const value of ['abc', 'player_01', 'a'.repeat(32), 'select', 'drop'])
    expect(isLoginName(value)).toBe(true);

  for (const value of [
    null,
    undefined,
    123,
    {},
    [],
    'ab',
    'a'.repeat(33),
    'Player',
    ' abc',
    'abc ',
    'abc\n',
    'abc\r',
    'abc\u2028',
    "a' OR 1=1--",
    'jogadór',
    'abc\0',
  ])
    expect(isLoginName(value)).toBe(false);
});

test('password lengths count Unicode code points and reject malformed UTF-16', () => {
  for (const value of ['x'.repeat(6), 'x'.repeat(128), '🃏'.repeat(6), '🃏'.repeat(128)])
    expect(isPassword(value)).toBe(true);

  for (const value of [
    null,
    undefined,
    123,
    {},
    [],
    '',
    'x'.repeat(5),
    'x'.repeat(129),
    '🃏'.repeat(5),
    '🃏'.repeat(129),
    `${'x'.repeat(6)}\uD800`,
    `${'x'.repeat(6)}\uDC00`,
  ])
    expect(isPassword(value)).toBe(false);
});

test('passwords accept spaces, punctuation, Unicode and SQL-like text verbatim', () => {
  for (const value of [
    "  ' OR 1=1; --  ",
    ' espaços e símbolos 🃏 ',
    'á'.repeat(6),
    'a\u0301'.repeat(6),
  ])
    expect(isPassword(value)).toBe(true);
});
