import type { MatchView, RoomView } from '@truco/game-protocol';
import { useId, useState, type RefObject } from 'react';
import { PowerCard } from './Card';
import { availablePower } from './selection';

export const powerNames = {
  spy: 'Espião',
  exchange: 'Segunda Chance',
  boost: 'Impulso',
  mask: 'Máscara',
};
const descriptions = {
  spy: 'Custo 1 · Descubra uma carta aleatória de um adversário após as trocas.',
  exchange: 'Custo 2 · Troque uma carta própria pelo monte. A escolha é definitiva.',
  boost: 'Custo 2 · Na sua jogada, uma carta comum sobe um nível. Não aceita manilha nem 3.',
  mask: 'Custo 1 · Na sua jogada, esconda uma carta até a resolução da vaza. Mantém a força.',
};

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
      aria-label="Poderes e energia"
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
              spy: 'Veja uma carta do adversário.',
              exchange: 'Troque uma carta da mão.',
              boost: 'Uma carta comum sobe um nível.',
              mask: 'Oculte sua próxima jogada.',
            }[power]
          }
          state={
            !affordable
              ? 'Sem energia'
              : room.status !== 'playing'
                ? 'Partida encerrada'
                : room.paused
                  ? 'Pausado'
                  : selected
                    ? power === 'spy'
                      ? 'Escolha um verso'
                      : 'Escolha sua carta'
                    : preparing
                      ? own?.ready
                        ? 'Pronto'
                        : turnPower
                          ? 'Na sua vez'
                          : 'Preparar'
                      : turn && turnPower
                        ? 'Clique para usar'
                        : turnPower
                          ? 'Aguarde sua vez'
                          : 'Expirou'
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
      <section className="power-energy" aria-label={`Energia ${own?.energy ?? 0} de 3`}>
        <span aria-hidden="true">ϟ</span>
        <span className="energy-gems" aria-hidden="true">
          {[1, 2, 3].map((level) => (
            <i key={level} data-filled={level <= (own?.energy ?? 0)} />
          ))}
        </span>
        <strong>{own?.energy ?? 0}/3</strong>
      </section>
      {!power && <p className="power-note">Sem poderes nesta mão</p>}
      {open && !own?.used && (
        <section className="power-panel" id={panelId} aria-label="Detalhes do poder">
          <button
            type="button"
            className="power-close"
            aria-label="Fechar detalhes do poder"
            onClick={close}
          >
            ×
          </button>
          <strong>{power ? powerNames[power] : 'Poderes desativados'}</strong>
          {power && <p>{descriptions[power]}</p>}
          {preparing ? (
            <>
              <p>
                Preparação selada · {powers.players.filter((player) => player.ready).length}/
                {match.playerCount} prontos
              </p>
              <p>
                {own?.ready
                  ? 'Seu compromisso está selado.'
                  : 'Clique no poder e escolha diretamente na mesa.'}
              </p>
            </>
          ) : (
            <p>
              {turnPower
                ? 'Clique na carta de poder na sua vez e depois escolha uma carta da mão. Clique novamente para cancelar.'
                : 'Este poder só pode ser usado na preparação.'}
            </p>
          )}
          <details>
            <summary>Poderes revelados</summary>
            <ul>
              {powers.players.map((player) => (
                <li key={player.seat}>
                  {room.seats[player.seat]?.nickname}:{' '}
                  {player.power
                    ? powerNames[player.power]
                    : match.hand.kind === 'normal'
                      ? 'Poder oculto'
                      : 'Sem poder'}{' '}
                  · {player.energy}/3
                  {player.used ? ' · usado' : ''}
                </li>
              ))}
              {powers.activations.map((activation) => (
                <li key={`use:${activation.seat}`}>
                  {room.seats[activation.seat]?.nickname} ativou {powerNames[activation.power]} em{' '}
                  {room.seats[activation.target]?.nickname}.
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </section>
  );
}
