import { type MatchReward, matchRewardSchema } from '@truco/game-protocol';
import { useEffect, useState } from 'react';
import { t } from '../../../../../../../shared/i18n';
import { request } from '../../../../../../../shared/transport/client';

const MAX_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 1500;

type Props = {
  matchId: string;
  eligibility: 'eligible' | 'guest' | 'development' | undefined;
  completed: boolean;
};

export function MatchRewards({ matchId, eligibility, completed }: Props) {
  const [reward, setReward] = useState<MatchReward>({ status: 'pending' });
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (eligibility !== 'eligible' || !completed) return;

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    if (retry > 0) setReward({ status: 'pending' });
    setFailed(false);
    setWaiting(true);

    const load = async () => {
      try {
        const result = matchRewardSchema.parse(
          await request<unknown>(`/accounts/matches/${encodeURIComponent(matchId)}/rewards`),
        );
        if (cancelled) return;

        setReward(result);
        if (result.status === 'pending' && ++attempts < MAX_ATTEMPTS) {
          timer = window.setTimeout(load, POLL_INTERVAL_MS);
          return;
        }
      } catch {
        if (cancelled) return;

        setFailed(true);
      }
      setWaiting(false);
    };
    void load();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [matchId, eligibility, completed, retry]);

  const explanation = !completed
    ? t('Partidas interrompidas não concedem recompensas.')
    : eligibility === 'guest'
      ? t('Entre na conta antes de começar uma partida para ganhar XP.')
      : eligibility === 'development'
        ? t('Partidas alteradas pelas ferramentas de desenvolvimento não concedem XP.')
        : eligibility !== 'eligible' || reward.status === 'none'
          ? t('Esta partida não concede recompensas.')
          : null;

  return (
    <section className="match-rewards" aria-label={t('Recompensas da partida')} aria-live="polite">
      <strong>
        {reward.status === 'granted' && !explanation
          ? t('Você recebeu')
          : t('Recompensas da partida')}
      </strong>
      {explanation ? (
        <p>{explanation}</p>
      ) : reward.status === 'granted' ? (
        <div className="match-reward-values">
          <span>
            <b>+{reward.xp} XP</b>
            <small>{t('Experiência recebida')}</small>
          </span>
          <span>
            <b>+{reward.competitivePoints}</b>
            <small>{t('Pontos de ranking')}</small>
          </span>
        </div>
      ) : (
        <>
          <p>
            {failed
              ? t('Não foi possível confirmar as recompensas agora.')
              : t('Recompensas em processamento. Seu progresso será atualizado automaticamente.')}
          </p>
          {!waiting && (
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              {t('Consultar novamente')}
            </button>
          )}
        </>
      )}
    </section>
  );
}
