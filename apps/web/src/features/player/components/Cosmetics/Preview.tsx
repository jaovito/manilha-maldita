import type { PlayerCatalog } from '@truco/game-protocol';
import { Avatar } from '../../../../shared/Avatar';
import { t } from '../../../../shared/i18n';
import { CardBack, CardFace } from '../../../../shared/PlayingCard';

export type CosmeticTab = 'avatars' | 'decks' | 'tables';
type Item = PlayerCatalog[CosmeticTab][number];
export function CosmeticPreview({
  tab,
  item,
  compact = false,
}: {
  tab: CosmeticTab;
  item: Item;
  compact?: boolean;
}) {
  return (
    <div className={`cosmetic-art ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      {tab === 'avatars' && 'spriteIndex' in item && <Avatar index={item.spriteIndex} />}
      {tab === 'decks' &&
        'assetKey' in item &&
        ['classic', 'ember', 'arcane'].includes(item.assetKey) && (
          <div className="deck-fan">
            <span>
              <CardBack
                theme={
                  item.assetKey === 'ember'
                    ? 'ember'
                    : item.assetKey === 'arcane'
                      ? 'arcane'
                      : 'classic'
                }
              />
            </span>
            <span>
              <CardFace
                card={{ rank: 'A', suit: 'spades' }}
                theme={
                  item.assetKey === 'ember'
                    ? 'ember'
                    : item.assetKey === 'arcane'
                      ? 'arcane'
                      : 'classic'
                }
              />
            </span>
            <span>
              <CardFace
                card={{ rank: '3', suit: 'hearts' }}
                theme={
                  item.assetKey === 'ember'
                    ? 'ember'
                    : item.assetKey === 'arcane'
                      ? 'arcane'
                      : 'classic'
                }
              />
            </span>
          </div>
        )}
      {tab === 'tables' && 'assetKey' in item && (
        <div className="cosmetic-table" data-table={item.assetKey}>
          <span>♠</span>
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}

export function cosmeticName(name: string): string {
  switch (name) {
    case 'Clássico':
    case 'Brasa':
    case 'Arcano':
    case 'Clássica':
    case 'Vinho':
    case 'Meia-noite':
      return t(name);
    default:
      return name;
  }
}
