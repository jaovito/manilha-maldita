import { useCallback, useEffect, useRef, useState } from 'react';
import { playerError } from '../services/player-api';

/** Only the latest request may publish; unmounted panels discard late responses. */
export function useRemote<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const reload = useCallback(() => {
    const id = ++requestId.current;
    setData(null);
    setError('');

    void load()
      .then((next) => {
        if (id === requestId.current) setData(next);
      })
      .catch((cause) => {
        if (id === requestId.current) setError(playerError(cause));
      });
  }, [load]);

  useEffect(() => {
    reload();
    return () => {
      requestId.current++;
    };
  }, [reload]);

  return { data, error, reload };
}
