import { ScenicCandle } from '../../../../../shared/ScenicCandle';

/** Static decoration is independent of players, private cards and match lifecycle. */
export function TableScenery() {
  return (
    <div className="table-scenery" aria-hidden="true">
      <div className="table-floor" />
      <div className="table-felt" />
      <div className="table-rail" />
      {['left', 'right', 'top', 'bottom'].map((side) => (
        <img
          key={side}
          className={`table-ornament ornament-${side}`}
          src="/art/table-layers/ornament.png"
          alt=""
        />
      ))}
      <div className="table-corner-props props-nw">
        <img className="table-cloth" src="/art/table-layers/cloth.png" alt="" />
        <ScenicCandle className="table-candle prop-candle" />
        <img className="table-coins" src="/art/layers/coins.png" alt="" />
      </div>
      <div className="table-corner-props props-ne">
        <img className="table-cloth" src="/art/table-layers/cloth.png" alt="" />
        <img className="table-mate" src="/art/layers/mate.png" alt="" />
      </div>
      <div className="table-corner-props props-sw">
        <img className="table-cloth" src="/art/table-layers/cloth.png" alt="" />
        <img className="table-deck" src="/art/layers/deck.png" alt="" />
      </div>
      <div className="table-corner-props props-se">
        <img className="table-cloth" src="/art/table-layers/cloth.png" alt="" />
        <img className="table-deck" src="/art/layers/deck.png" alt="" />
        <img className="table-coins" src="/art/layers/coins.png" alt="" />
      </div>
    </div>
  );
}
