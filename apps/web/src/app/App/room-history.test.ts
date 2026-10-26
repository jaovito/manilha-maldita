import { expect, mock, test } from 'bun:test';
import { watchRoomHistory } from './room-history';

function fixture() {
  const close = mock(() => {});
  return {
    close,
    connection: { current: { close, send: mock(() => {}) } },
    boundRoom: { current: 'ABC123' as string | null },
    joining: { current: 0 },
    reset: mock(() => {}),
    onExit: mock((_code: string) => {}),
    onError: mock((_error: string) => {}),
    join: mock(async (_code: string) => {}),
  };
}
function pop(url: string) {
  history.replaceState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

test('Back closes the room connection without sending surrender or leave, Forward rejoins', async () => {
  const options = fixture();
  const send = options.connection.current.send;
  const unsubscribe = watchRoomHistory(options);
  pop('/?room=ABC123#settings');
  expect(options.close).not.toHaveBeenCalled();
  pop('/');
  expect(options.close).toHaveBeenCalledTimes(1);
  expect(send).not.toHaveBeenCalled();
  expect(options.reset).toHaveBeenCalledTimes(1);
  expect(options.onExit).toHaveBeenLastCalledWith('');
  expect(options.connection.current).toBeNull();
  pop('/?room=ABC123');
  expect(options.join).toHaveBeenCalledWith('ABC123');
  await Promise.resolve();
  unsubscribe();
  pop('/');
  expect(options.join).toHaveBeenCalledTimes(1);
});

test('history rejects malformed room locations and reports failed restoration without raw objects', async () => {
  for (const cause of [new Error('Room is unavailable'), null]) {
    const options = fixture();
    options.join = mock(async () => {
      throw cause;
    });
    const unsubscribe = watchRoomHistory(options);
    pop('/?room=invalid');
    expect(options.join).not.toHaveBeenCalled();
    pop('/?room=DEF456');
    await Promise.resolve();
    expect(options.onError).toHaveBeenCalledWith(
      cause instanceof Error ? cause.message : 'Falha ao entrar na sala.',
    );
    unsubscribe();
  }
});

test('a failed historical restore cannot report an error after a later navigation', async () => {
  const options = fixture();
  let reject = (_cause: Error) => {};
  const pending = new Promise<void>((_resolve, fail) => {
    reject = fail;
  });
  options.join = mock(() => pending);
  const unsubscribe = watchRoomHistory(options);
  pop('/?room=DEF456');
  pop('/');
  reject(new Error('obsolete failure'));
  await Promise.resolve();
  expect(options.onError).not.toHaveBeenCalled();
  unsubscribe();
});
