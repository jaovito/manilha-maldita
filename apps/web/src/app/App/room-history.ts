import type { RefObject } from 'react';
import { t } from '../../shared/i18n';
import type { connectRoom } from '../../shared/transport/client';

type RoomHistoryOptions = {
  connection: RefObject<ReturnType<typeof connectRoom> | null>;
  boundRoom: RefObject<string | null>;
  joining: RefObject<number>;
  reset(): void;
  onExit(code: string): void;
  onError(message: string): void;
  join(code: string): Promise<void>;
};

export function watchRoomHistory(options: RoomHistoryOptions) {
  const restore = () => {
    const candidate = new URL(location.href).searchParams.get('room');
    const next = candidate && /^[A-Z0-9]{6}$/.test(candidate) ? candidate : null;
    options.joining.current++;
    if (next === options.boundRoom.current) {
      if (!next) options.onExit('');
      return;
    }

    options.connection.current?.close();
    options.connection.current = null;
    options.boundRoom.current = null;
    options.reset();
    options.onExit(next ?? '');
    if (next) {
      const restored = options.join(next);
      const epoch = options.joining.current;
      void restored.catch((cause: unknown) => {
        if (options.joining.current !== epoch) return;
        options.onError(cause instanceof Error ? cause.message : t('Falha ao entrar na sala.'));
      });
    }
  };
  window.addEventListener('popstate', restore);

  return () => window.removeEventListener('popstate', restore);
}
