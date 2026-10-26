import type { PlayerProgress } from '@truco/game-protocol';
import { Avatar } from '../../../../shared/Avatar';
import { t, useLocale } from '../../../../shared/i18n';

export function PlayerSummary({ profile }: { profile: PlayerProgress }) {
  const { locale } = useLocale();

  return (
    <div className="player-summary">
      <Avatar index={profile.appearance.avatar.spriteIndex} />
      <div>
        <strong>{profile.nickname}</strong>
        <p>
          {t('Nível {0}', [profile.level])} ·{' '}
          {t('{0} XP', [BigInt(profile.xp).toLocaleString(locale)])}
        </p>
      </div>
      <span className="player-points">
        ♛ {t('{0} pontos', [BigInt(profile.competitivePoints).toLocaleString(locale)])}
      </span>
    </div>
  );
}
