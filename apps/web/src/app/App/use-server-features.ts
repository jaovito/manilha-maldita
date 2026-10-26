import { useEffect, useState } from 'react';
import { request } from '../../shared/transport/client';

export function useServerFeatures() {
  const [accountsEnabled, setAccountsEnabled] = useState(false);
  const [soloEnabled, setSoloEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    request<{ solo?: unknown; accounts?: unknown }>('/features')
      .then((features) => {
        if (active) {
          setSoloEnabled(features.solo === true);
          setAccountsEnabled(features.accounts === true);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return { accountsEnabled, soloEnabled };
}
