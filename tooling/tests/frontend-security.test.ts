import { expect, test } from 'bun:test';
import workspaceDeployment from '../../apps/web/vercel.json';
import config from '../../apps/web/vite.config';
import rootDeployment from '../../vercel.json';

test('both supported Vercel roots deny framing on every path', () => {
  expect(rootDeployment).toEqual(workspaceDeployment);
  expect(workspaceDeployment.headers).toEqual([
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
  ]);
});

test('development and built preview apply the deployed framing policy', () => {
  const expected = {
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
  };

  expect(config.server?.headers).toEqual(expected);
  expect(config.preview?.headers).toEqual(expected);
});
