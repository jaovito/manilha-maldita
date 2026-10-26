import { useId, useState } from 'react';
import { disabledHint } from '../../../../shared/DisabledTooltip';
import { t } from '../../../../shared/i18n';
import type { PlayerController } from '../../hooks/use-player';
import { useRemote } from '../../hooks/use-remote';
import { playerApi } from '../../services/player-api';
import { CosmeticPreview, type CosmeticTab, cosmeticName } from './Preview';

const tabs = ['avatars', 'decks', 'tables'] as const;
const labels = { avatars: 'Avatares', decks: 'Baralhos', tables: 'Mesas' } as const;
export function Cosmetics({
  player,
  onAccount,
}: {
  player: PlayerController;
  onAccount: () => void;
}) {
  const { data: catalog, error, reload } = useRemote(playerApi.catalog);
  const [tab, setTab] = useState<CosmeticTab>('avatars');
  const [picked, setPicked] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const id = useId();
  if (!catalog)
    return (
      <div className="player-empty" role="status">
        {error || t('Carregando coleção…')}
        {error && (
          <button type="button" onClick={reload}>
            {t('Tentar novamente')}
          </button>
        )}
      </div>
    );

  const profile = player.profile;
  const equipped =
    tab === 'avatars'
      ? profile?.appearance.avatar.id
      : tab === 'decks'
        ? profile?.appearance.deck.id
        : profile?.appearance.table.id;
  const items = catalog[tab];
  const selected = items.find((item) => item.id === (picked ?? equipped)) ?? items[0];
  const locked = selected && (!profile || BigInt(profile.level) < BigInt(selected.requiredLevel));
  const switchTab = (next: CosmeticTab) => {
    setTab(next);
    setPicked(null);
    setNotice('');
  };
  const equip = async () => {
    if (!profile || !selected || locked) return;

    try {
      await player.select({
        avatarId: tab === 'avatars' ? selected.id : profile.appearance.avatar.id,
        deckThemeId: tab === 'decks' ? selected.id : profile.appearance.deck.id,
        tableThemeId: tab === 'tables' ? selected.id : profile.appearance.table.id,
      });
      setNotice(t('Visual equipado.'));
    } catch {
      /* The controller exposes a translated operational error. */
    }
  };

  return (
    <>
      <div className="cosmetic-tabs" role="tablist" aria-label={t('Cosméticos')}>
        {tabs.map((name, index) => (
          <button
            key={name}
            id={`${id}-${name}`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            aria-controls={`${id}-collection`}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => switchTab(name)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % 3
                  : event.key === 'ArrowLeft'
                    ? (index + 2) % 3
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 2
                        : null;
              if (next === null) return;
              event.preventDefault();
              const value = tabs[next];
              if (value) {
                switchTab(value);
                document.getElementById(`${id}-${value}`)?.focus();
              }
            }}
          >
            {t(labels[name])}
          </button>
        ))}
      </div>
      <section
        className="wardrobe-workspace"
        role="tabpanel"
        id={`${id}-collection`}
        aria-labelledby={`${id}-${tab}`}
      >
        {selected && (
          <aside className="cosmetic-showcase">
            <span className="eyebrow">{t('Prévia cosmética')}</span>
            <CosmeticPreview tab={tab} item={selected} />
            <h3>{cosmeticName(selected.name)}</h3>
            <p>
              {tab === 'decks'
                ? t('Seu baralho também aparece para os outros jogadores.')
                : tab === 'tables'
                  ? t('A mesa muda apenas para você.')
                  : t('Seu estilo na mesa')}
            </p>
            <span className="unlock-label">{t('Nível {0}', [selected.requiredLevel])}</span>
            {!profile ? (
              <button type="button" onClick={onAccount}>
                {t('Entre para equipar')}
              </button>
            ) : (
              <button
                type="button"
                disabled={Boolean(locked || player.pending || selected.id === equipped)}
                {...disabledHint(
                  locked ? t('Desbloqueia no nível {0}', [selected.requiredLevel]) : null,
                )}
                onClick={() => void equip()}
              >
                {player.pending
                  ? t('Aguarde…')
                  : selected.id === equipped
                    ? t('Equipado')
                    : t('Equipar')}
              </button>
            )}
            {notice && <p role="status">{notice}</p>}
          </aside>
        )}
        <div className="cosmetic-collection">
          <h3>{t(labels[tab])}</h3>
          <p>{t('Escolha seu próximo desbloqueio.')}</p>
          <div className="cosmetic-grid">
            {items.map((item) => {
              const available = profile && BigInt(profile.level) >= BigInt(item.requiredLevel);
              return (
                <button
                  type="button"
                  className="cosmetic-item"
                  key={item.id}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => {
                    setPicked(item.id);
                    setNotice('');
                  }}
                  data-locked={!available}
                >
                  <CosmeticPreview tab={tab} item={item} compact />
                  <strong>{cosmeticName(item.name)}</strong>
                  <span>
                    {item.id === equipped
                      ? `✓ ${t('Equipado')}`
                      : available
                        ? t('Disponível')
                        : `♜ ${t('Nível {0}', [item.requiredLevel])}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
