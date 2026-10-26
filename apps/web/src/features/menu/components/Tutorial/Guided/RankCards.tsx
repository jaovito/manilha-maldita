import { CardFace } from '../../../../room';
import { t } from '../../../../../shared/i18n';

const ranks = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;

/** Same face renderer and proportions as the table; list order expresses ordinary strength. */
export function RankCards() {
  return (
    <ol className="guided-rank-order" aria-label={t('Ordem crescente de força')}>
      {ranks.map((rank) => (
        <li key={rank}>
          <span
            className="guided-rank-card"
            role="img"
            aria-label={t('{0} de {1}', [rank, t('Ouros ♦')])}
          >
            <CardFace card={{ rank, suit: 'diamonds' }} />
          </span>
        </li>
      ))}
    </ol>
  );
}
