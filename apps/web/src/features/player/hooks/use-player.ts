import type { PlayerProgress } from '@truco/game-protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpError } from '../../../shared/transport/client';
import { playerApi, playerError } from '../services/player-api';

/** Account state stays in memory; bearer cookies are never read by JavaScript. */
export function usePlayer(enabled: boolean) {
  const [profile, setProfile] = useState<PlayerProgress | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refreshId = useRef(0);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current) return;

    const epoch = generation.current;
    const id = ++refreshId.current;
    setLoading(true);

    try {
      const next = await playerApi.profile();
      if (mounted.current && generation.current === epoch && refreshId.current === id) {
        setProfile(next);
        setError('');
      }
    } catch (cause) {
      if (mounted.current && generation.current === epoch && refreshId.current === id) {
        if (cause instanceof HttpError && cause.status === 401) {
          setProfile(null);
          setError('');
        } else setError(playerError(cause));
      }
    } finally {
      if (mounted.current && generation.current === epoch && refreshId.current === id)
        setLoading(false);
    }
  }, [enabled]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    window.addEventListener('focus', refresh);

    return () => {
      mounted.current = false;
      generation.current++;
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const perform = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (inFlight.current) throw new Error('PLAYER_OPERATION_PENDING');

    inFlight.current = true;
    const epoch = ++generation.current;
    setLoading(false);
    setPending(true);
    setError('');

    try {
      return await operation();
    } catch (cause) {
      if (mounted.current && generation.current === epoch) {
        setError(playerError(cause));
        if (cause instanceof HttpError && cause.code === 'UNAUTHENTICATED') setProfile(null);
      }
      throw cause;
    } finally {
      inFlight.current = false;
      if (mounted.current && generation.current === epoch) setPending(false);
    }
  };
  const update = (next: PlayerProgress | null) => {
    if (mounted.current) setProfile(next);
  };

  return {
    profile,
    pending,
    loading,
    error,
    refresh,
    clearError: () => setError(''),
    async authenticate(mode: 'login' | 'register', body: unknown) {
      await perform(async () => {
        await playerApi.authenticate(mode, body);
        update(await playerApi.profile());
      });
    },
    async select(body: Parameters<typeof playerApi.select>[0]) {
      await perform(async () => update(await playerApi.select(body)));
    },
    async rename(nickname: string) {
      await perform(async () => update(await playerApi.rename(nickname)));
    },
    async recovery(mode: 'recover' | 'recovery-code', body: unknown) {
      return perform(async () => {
        const result = await playerApi.recovery(mode, body);
        if (mode === 'recover') update(null);
        return result.recoveryCode;
      });
    },
    async maintain(mode: 'password' | 'delete', body: unknown) {
      await perform(async () => {
        await playerApi.maintain(mode, body);
        update(null);
      });
    },
    async logout() {
      await perform(async () => {
        await playerApi.logout();
        update(null);
      });
    },
  };
}
export type PlayerController = ReturnType<typeof usePlayer>;
