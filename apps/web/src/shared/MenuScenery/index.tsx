import { t } from '../i18n';
import { EnergyIcon } from '../EnergyIcon';
import { ScenicCandle } from '../ScenicCandle';

/** Decorative layers never receive or encode match state. */
export function MenuScenery({ lobby = false }: { lobby?: boolean }) {
  return (
    <div className="menu-scenery" data-lobby={lobby} aria-hidden="true">
      {['nw', 'ne', 'sw', 'se'].map((corner) => (
        <img
          key={corner}
          className={`scene-corner corner-${corner}`}
          src={`/art/layers/border-${corner}.png`}
          alt=""
        />
      ))}
      {['top', 'left', 'right', 'bottom'].map((side) => (
        <img
          key={side}
          className={`scene-crest crest-${side}`}
          src={`/art/layers/crest-${side}.png`}
          alt=""
        />
      ))}
      <ScenicCandle className="scene-prop prop-candle" />
      {['mate', 'coins', 'deck'].map((prop) => (
        <img
          key={prop}
          className={`scene-prop prop-${prop}`}
          src={`/art/layers/${prop}.png`}
          alt=""
        />
      ))}
      <div className="scene-edge-props">
        <img className="edge-deck-left" src="/art/layers/deck.png" alt="" />
        <img className="edge-deck-bottom" src="/art/layers/deck.png" alt="" />
        <img className="edge-coins-right" src="/art/layers/coins.png" alt="" />
        <img className="edge-deck-top" src="/art/layers/deck.png" alt="" />
      </div>
      {!lobby && (
        <div className="scene-cards">
          <img
            className="scene-playing-card scene-card-one"
            src="/art/layers/seven-hearts.png"
            alt=""
          />
          <img
            className="scene-playing-card scene-card-two"
            src="/art/layers/ace-spades.png"
            alt=""
          />
          <div className="scene-power-card power-card power-spy">
            <span className="power-card-title">{t('Espião')}</span>
            <span className="power-card-illustration">
              <span className="power-card-art" />
              <span className="power-card-cost">
                <EnergyIcon /> 1
              </span>
            </span>
            <span className="power-card-hint">{t('Veja uma carta aleatória do adversário.')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
