import { t } from '../i18n';
import { EnergyIcon } from '../EnergyIcon';
import { useId } from 'react';
import type { CSSProperties } from 'react';

/** Decorative layers never receive or encode match state. */
export function MenuScenery({ lobby = false }: { lobby?: boolean }) {
  const flameFilter = useId();
  const flameStyle = { '--candle-filter': `url(#${flameFilter})` } as CSSProperties;

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
      <span className="scene-prop prop-candle" style={flameStyle}>
        <svg className="prop-candle-art" viewBox="0 0 477 512" focusable="false" aria-hidden="true">
          <defs>
            <filter
              id={flameFilter}
              primitiveUnits="userSpaceOnUse"
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.015 0.045"
                numOctaves="1"
                seed="7"
                result="noise"
              />
              <feFlood
                floodColor="white"
                x="-48"
                y="-52"
                width="573"
                height="190"
                result="upperFlame"
              />
              <feGaussianBlur in="upperFlame" stdDeviation="20" result="softFalloff" />
              <feFlood
                floodColor="white"
                x="-48"
                y="-52"
                width="573"
                height="257"
                result="flameBounds"
              />
              <feComposite in="softFalloff" in2="flameBounds" operator="in" result="falloff" />
              <feComposite in="noise" in2="falloff" operator="in" result="flameNoise" />
              <feFlood floodColor="rgb(50% 50% 50%)" result="neutral" />
              <feComposite in="flameNoise" in2="neutral" operator="over" result="displacement" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="displacement"
                result="movingFlame"
                scale="0"
                xChannelSelector="R"
                yChannelSelector="G"
              >
                <animate
                  attributeName="scale"
                  values="0;80;-40;60;0"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </feDisplacementMap>
              <feComposite in="movingFlame" in2="falloff" operator="in" result="animatedTip" />
              <feComposite in="SourceGraphic" in2="falloff" operator="out" result="stillCandle" />
              <feMerge>
                <feMergeNode in="stillCandle" />
                <feMergeNode in="animatedTip" />
              </feMerge>
            </filter>
          </defs>
          <image
            className="prop-candle-body"
            href="/art/layers/candle.png"
            width="477"
            height="512"
          />
        </svg>
        <span className="prop-candle-glow" />
      </span>
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
