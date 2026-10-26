import { useCallback, useState } from 'react';
import { Avatar } from '../../../../shared/Avatar';
import { t, useLocale } from '../../../../shared/i18n';
import { useRemote } from '../../hooks/use-remote';
import { playerApi } from '../../services/player-api';

export function Ranking() {
  const { locale } = useLocale();
  const [page, setPage] = useState(1);
  const load = useCallback(() => playerApi.ranking(page), [page]);
  const { data, error, reload } = useRemote(load);

  return (
    <section className="player-ranking">
      <div className="ranking-heading">
        <span aria-hidden="true">♛</span>
        <h3>{t('Ranking global')}</h3>
        <p>{t('Vitórias competitivas valem pontos.')}</p>
      </div>
      {error ? (
        <div role="alert">
          {error}
          <button type="button" onClick={reload}>
            {t('Tentar novamente')}
          </button>
        </div>
      ) : !data ? (
        <p role="status">{t('Aguarde…')}</p>
      ) : data.entries.length === 0 ? (
        <p className="player-empty">{t('Ainda não há jogadores pontuando.')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('Posição')}</th>
              <th>{t('Jogador')}</th>
              <th>{t('Pontos')}</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => (
              <tr key={entry.rank}>
                <td>
                  {entry.rank <= 3 ? '♛ ' : ''}
                  {entry.rank}
                </td>
                <td>
                  <Avatar index={entry.avatar.spriteIndex} />
                  <strong>{entry.nickname}</strong>
                </td>
                <td>{BigInt(entry.competitivePoints).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <nav aria-label={t('Ranking global')} className="ranking-pagination">
        <button type="button" disabled={!data || page === 1} onClick={() => setPage(page - 1)}>
          {t('Anterior')}
        </button>
        <span>{t('Página {0}', [page])}</span>
        <button
          type="button"
          disabled={!data?.nextPage}
          onClick={() => {
            if (data?.nextPage) setPage(data.nextPage);
          }}
        >
          {t('Próxima')}
        </button>
      </nav>
    </section>
  );
}
