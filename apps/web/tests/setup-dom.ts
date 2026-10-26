import { afterEach } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/' });
const { cleanup } = await import('@testing-library/react');
const browserStorage = localStorage;
afterEach(() => {
  cleanup();
  browserStorage.clear();
  history.replaceState(null, '', 'http://localhost/');
});
