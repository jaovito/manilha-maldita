import { afterEach } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
const { cleanup } = await import('@testing-library/react');
const browserStorage = localStorage;
afterEach(() => {
  cleanup();
  browserStorage.clear();
});
