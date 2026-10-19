import { t } from '../../../../../../shared/i18n';
import { EnergyIcon } from '../../../../../../shared/EnergyIcon';
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
  const reason = canActivate
    ? null
    : t('{0}. Clique para consultar os detalhes do poder.', [state]);

  return (
    <div className="power-card-pocket">
      <button
        type="button"
        className={`power-card power-${power}`}
        aria-label={t('Poder {0}', [name])}
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
          <span
            className="power-card-cost"
            role="img"
            aria-label={t('Custo {0} de energia', [cost])}
          >
            <EnergyIcon /> {cost}
          </span>
        </span>
        <span className="power-card-hint">{hint}</span>
      </button>
      <span className="power-card-state">{state}</span>
    </div>
  );
}
