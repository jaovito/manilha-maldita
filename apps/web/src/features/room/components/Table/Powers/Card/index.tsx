import type { Ref } from 'react';
import { disabledHint } from '../../../../../../shared/DisabledTooltip';

export function PowerCard({
  power,
  name,
  cost,
  hint,
  state,
  expanded,
  selected,
  onClick,
  controls,
  buttonRef,
  canActivate,
}: {
  power: 'spy' | 'exchange' | 'boost' | 'mask';
  name: string;
  cost: number;
  hint: string;
  state: string;
  expanded: boolean;
  selected: boolean;
  onClick: () => void;
  controls: string;
  buttonRef: Ref<HTMLButtonElement>;
  canActivate: boolean;
}) {
  const reason = canActivate ? null : `${state}. Clique para consultar os detalhes do poder.`;

  return (
    <div className="power-card-pocket">
      <button
        type="button"
        className={`power-card power-${power}`}
        aria-label={`Poder ${name}`}
        {...disabledHint(reason)}
        aria-description={reason ?? state}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-pressed={selected}
        data-can-activate={canActivate}
        data-selected={selected}
        ref={buttonRef}
        onClick={onClick}
      >
        <span className="power-card-title">{name}</span>
        <span className="power-card-illustration">
          <span className="power-card-art" aria-hidden="true" />
          <span className="power-card-cost" role="img" aria-label={`Custo ${cost} de energia`}>
            <span aria-hidden="true">ϟ</span> {cost}
          </span>
        </span>
        <span className="power-card-hint">{hint}</span>
        <span className="power-card-state">{state}</span>
      </button>
    </div>
  );
}
