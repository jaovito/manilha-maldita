import { useId, type CSSProperties } from 'react';

/** Animate only the flame tip; wax and wick remain fixed in one intact sprite. */
export function ScenicCandle({ className }: { className: string }) {
  const flameFilter = useId();
  const flameStyle = { '--candle-filter': `url(#${flameFilter})` } as CSSProperties;

  return (
    <span className={className} style={flameStyle}>
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
  );
}
