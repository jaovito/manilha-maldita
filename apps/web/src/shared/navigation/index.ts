import { useCallback, useEffect, useState } from 'react';

const pages = ['menu', 'join', 'tutorial', 'settings', 'cosmetics', 'account', 'ranking'] as const;
export type MenuPage = (typeof pages)[number];

function readRoute(url = new URL(location.href)) {
  const hash = url.hash.slice(1);
  const page = pages.find((value) => value === hash) ?? 'menu';
  const code = url.searchParams.get('room');

  return { page, roomCode: code && /^[A-Z0-9]{6}$/.test(code) ? code : null };
}

/** History contains public screen/room locations only, never credentials or gameplay state. */
export function useBrowserNavigation() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const restore = () => setRoute(readRoute());
    window.addEventListener('popstate', restore);

    return () => window.removeEventListener('popstate', restore);
  }, []);

  const navigate = useCallback((page: MenuPage, roomCode: string | null, replace = false) => {
    const url = new URL('/', location.origin);
    if (roomCode) url.searchParams.set('room', roomCode);
    if (page !== 'menu') url.hash = page;
    if (url.href === location.href) return;

    const state = replace ? null : { trucoParent: location.href };
    history[replace ? 'replaceState' : 'pushState'](state, '', url);
    setRoute(readRoute(url));
  }, []);

  const back = useCallback(() => {
    const parent: unknown = history.state?.trucoParent;
    if (typeof parent === 'string') {
      try {
        const url = new URL(parent);
        if (url.origin === location.origin && url.pathname === '/') {
          history.back();
          return;
        }
      } catch {
        // Unknown history state must not navigate to an arbitrary origin.
      }
    }
    navigate('menu', new URL(location.href).searchParams.get('room'), true);
  }, [navigate]);

  return { route, navigate, back };
}
