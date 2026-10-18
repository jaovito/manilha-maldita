import { expect, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

// Test fixture only: validates JSX, React rendering, events and DOM cleanup.
function CounterFixture() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}

test('the configured DOM harness renders React and processes interactions', () => {
  render(<CounterFixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Count: 0' }));
  expect(screen.getByRole('button').textContent).toBe('Count: 1');
});

test('the configured cleanup isolates successive tests', () => {
  expect(document.body.querySelector('button')).toBeNull();
});
