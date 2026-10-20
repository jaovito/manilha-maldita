import { expect, test } from 'bun:test';
import { WSContext } from 'hono/ws';
import { sendSocketMessage } from '../../src/modules/transport/adapters/outbound/socket-publisher';

const message = { type: 'ACK', commandId: 'test', ok: true, sequence: 1 } as const;
test('output authenticates expiry, validates the envelope and bounds native output', () => {
  const sent: string[] = [];
  const closed: (number | undefined)[] = [];
  function socket(buffer: unknown = 0, readyState: 0 | 1 | 2 | 3 = 1) {
    return new WSContext({
      readyState,
      raw: { getBufferedAmount: () => buffer },
      send(data) {
        sent.push(String(data));
      },
      close(code) {
        closed.push(code);
      },
    });
  }
  sendSocketMessage(socket(), message, false);
  expect(sent).toEqual([JSON.stringify(message)]);
  sendSocketMessage(socket(), message, true);
  expect(closed.pop()).toBe(1008);
  sendSocketMessage(socket(65537), message, false);
  expect(closed.pop()).toBe(1009);
  sendSocketMessage(socket('invalid'), message, false);
  expect(closed.pop()).toBe(1009);
  sendSocketMessage(socket(), { ...message, sequence: -1 }, false);
  expect(closed.pop()).toBe(1011);
  sendSocketMessage(socket(0, 3), message, false);
  expect(sent).toHaveLength(1);
  const plain = new WSContext({
    readyState: 1,
    send(data) {
      sent.push(String(data));
    },
    close() {},
  });
  sendSocketMessage(plain, message, false);
  expect(sent).toHaveLength(2);
});
