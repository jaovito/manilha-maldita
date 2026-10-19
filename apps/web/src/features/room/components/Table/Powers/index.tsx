import { t, localized } from '../../../../../shared/i18n';
import { EnergyIcon } from '../../../../../shared/EnergyIcon';
import type { MatchView, RoomView } from '@truco/game-protocol';
import { useId, useState, type RefObject } from 'react';
import { PowerCard } from './Card';
import { availablePower } from './selection';

export const powerNames = localized({
  spy: 'Espião',
  exchange: 'Segunda Chance',
  boost: 'Impulso',
  mask: 'Máscara',
});
const descriptions = localized({
  spy: 'Custo 1 · Descubra uma carta aleatória de um adversário após as trocas.',
  exchange: 'Custo 2 · Troque uma carta própria pelo monte. A escolha é definitiva.',
  boost: 'Custo 2 · Na sua jogada, uma carta comum sobe um nível. Não aceita manilha nem 3.',
  mask: 'Custo 1 · Na sua jogada, esconda uma carta até a resolução da vaza. Mantém a força.',
});

export function TablePowers({
  room,
  match,
  cardRef,
  selected,
  select,
}: {
  room: RoomView;
  match: MatchView;
  cardRef: RefObject<HTMLButtonElement | null>;
  selected: boolean;
  select: (selected: boolean) => void;
}) {
  const [openContext, setOpenContext] = useState<string | null>(null);
  const panelId = useId();
  const powers = match.powers;
  if (!powers) return null;
  const own = powers.players[room.selfSeat];
  const preparing = match.phase.type === 'PREPARATION';
  const power = own?.power;
  const affordable = own && power && own.energy >= (power === 'spy' || power === 'mask' ? 1 : 2);
  const turn = match.phase.type === 'TURN' && match.phase.seat === room.selfSeat;
  const context = `${room.matchId}:${match.hand.number}:${room.decisionId}:${power}:${own?.ready}`;
  const open = openContext === context;
  const turnPower = power === 'boost' || power === 'mask';
  const canActivate = availablePower(room, match) !== null;
  const close = () => {
    setOpenContext(null);
    cardRef.current?.focus();
  };

  return (
    <section
      className="power-dock"
      aria-label={t('Poderes e energia')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          close();
          select(false);
        }
      }}
    >
      {power && !own?.used && (
        <PowerCard
          power={power}
          name={powerNames[power]}
          cost={power === 'spy' || power === 'mask' ? 1 : 2}
          hint={
            {
              spy: t('Veja uma carta aleatória do adversário.'),
              exchange: t('Troque uma carta da mão antes da 1ª vaza.'),
              boost: t('Sua próxima carta comum sobe 1 nível.'),
              mask: t('Sua próxima carta fica oculta até a resolução.'),
            }[power]
          }
          state={
            !affordable
              ? t('Sem energia')
              : room.status !== 'playing'
                ? t('Partida encerrada')
                : room.paused
                  ? t('Pausado')
                  : room.transition
                    ? t('Aguarde a mesa')
                    : selected
                      ? power === 'spy'
                        ? t('Escolha um verso')
                        : t('Escolha sua carta')
                      : preparing
                        ? own?.ready
                          ? t('Pronto')
                          : turnPower
                            ? t('Na sua vez')
                            : t('Preparar')
                        : turn && turnPower
                          ? t('Clique para usar')
                          : turnPower
                            ? t('Aguarde sua vez')
                            : t('Expirou')
          }
          expanded={open}
          selected={selected}
          controls={panelId}
          buttonRef={cardRef}
          canActivate={canActivate}
          onClick={() => {
            if (canActivate) {
              select(!selected);
              setOpenContext(null);
            } else setOpenContext(open ? null : context);
          }}
        />
      )}
      <section className="power-energy" aria-label={t('Energia {0} de 3', [own?.energy ?? 0])}>
        <EnergyIcon />
        <span className="energy-gems" aria-hidden="true">
          {[1, 2, 3].map((level) => (
            <i key={level} data-filled={level <= (own?.energy ?? 0)} />
          ))}
        </span>
        <strong>{own?.energy ?? 0}/3</strong>
      </section>
      {!power && <p className="power-note">{t('Sem poderes nesta mão')}</p>}
      {open && !own?.used && (
        <section className="power-panel" id={panelId} aria-label={t('Detalhes do poder')}>
          <button
            type="button"
            className="power-close"
            aria-label={t('Fechar detalhes do poder')}
            onClick={close}
          >
            ×
          </button>
          <strong>{power ? powerNames[power] : t('Poderes desativados')}</strong>
          {power && <p>{descriptions[power]}</p>}
          {preparing ? (
            <>
              <p>
                {t('Preparação selada · {0}/{1} prontos', [
                  powers.players.filter((player) => player.ready).length,
                  match.playerCount,
                ])}
              </p>
              <p>
                {own?.ready
                  ? t('Seu compromisso está selado.')
                  : t('Clique no poder e escolha diretamente na mesa.')}
              </p>
            </>
          ) : (
            <p>
              {turnPower
                ? t(
                    'Clique na carta de poder na sua vez e depois escolha uma carta da mão. Clique novamente para cancelar.',
                  )
                : t('Este poder só pode ser usado na preparação.')}
            </p>
          )}
          <details>
            <summary>{t('Poderes revelados')}</summary>
            <ul>
              {powers.players.map((player) => (
                <li key={player.seat}>
                  {room.seats[player.seat]?.nickname}:{' '}
                  {player.power
                    ? powerNames[player.power]
                    : match.hand.kind === 'normal'
                      ? t('Poder oculto')
                      : t('Sem poder')}{' '}
                  · {player.energy}/3
                  {player.used ? t(' · usado') : ''}
                </li>
              ))}
              {powers.activations.map((activation) => (
                <li key={`use:${activation.seat}`}>
                  {t('{0} ativou {1} em {2}.', [
                    room.seats[activation.seat]?.nickname ?? t('Jogador'),
                    powerNames[activation.power],
                    room.seats[activation.target]?.nickname ?? t('Jogador'),
                  ])}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </section>
  );
}
