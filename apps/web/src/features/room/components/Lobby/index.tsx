import { t } from '../../../../shared/i18n';
import type { RoomView } from '@truco/game-protocol';
import { disabledHint } from '../../../../shared/DisabledTooltip';
import type { Action } from '../../../../shared/transport/client';
import { LobbyIcon } from './Icon';
import { RoomInvite } from './Invite';
import { LobbySeats } from './Seats';
import { LobbySettings } from './Settings';

export function Lobby({ room, send }: { room: RoomView; send: (action: Action) => void }) {
  const host = room.selfSeat === room.hostSeat;
  const missing = room.seats.filter((player) => player === null).length;
  const occupants = room.seats.flatMap((player) => (player === null ? [] : [player]));
  const disconnected = occupants.filter((player) => !player.connected);
  const unready = occupants.filter((player) => player.connected && !player.ready);
  const canStart = missing === 0 && disconnected.length === 0 && unready.length === 0;
  const startReason =
    missing > 0
      ? t('{0} para completar a sala {1}.', [
          missing === 1 ? t('Falta 1 jogador') : t('Faltam {0} jogadores', [missing]),
          room.config.format,
        ])
      : disconnected.length > 0
        ? t('Aguarde todos os jogadores reconectarem.')
        : unready.length > 0
          ? t('Todos os jogadores precisam confirmar Estou pronto.')
          : null;

  return (
    <section className={`room-lobby ${room.match ? 'compact-lobby' : ''}`} aria-label="Lobby">
      <div className="lobby-workbench">
        <div className="lobby-left-column">
          <div className="lobby-heading">
            <p className="eyebrow">
              {t('SALA PRIVADA ·')} {room.code}
            </p>
            <h2 aria-label={t('Sala {0}', [room.code])}>
              {host ? t('Criar sala') : t('Sala privada')}
            </h2>
          </div>
          <div className="lobby-config-column">
            <LobbySettings room={room} send={send} />
            <div className="lobby-option-row room-link-panel">
              <LobbyIcon name="key" />
              <div className="option-caption">
                <strong>{t('Link da sala')}</strong>
                <small>{t('Compartilhe para convidar amigos')}</small>
              </div>
              <RoomInvite code={room.code} />
            </div>
          </div>
          <section className="lobby-powers" aria-label={t('Sistema de poderes')}>
            <div className="power-fan" aria-hidden="true">
              <span className="fan-card">♥</span>
              <span className="fan-card fan-spy">
                <LobbyIcon name="eye" />
                {t('ESPIÃO')}
              </span>
              <span className="fan-card">♠</span>
            </div>
            <div>
              <h3>{t('Sistema de poderes')}</h3>
              <p>{t('Habilidades especiais para mudar o rumo da partida.')}</p>
              <details className="power-catalog">
                <summary className="power-preview">
                  <LobbyIcon name="cards" /> {t('Ver poderes')}
                </summary>
                <p>
                  {t(
                    'Energia: 2 no início, +1 por mão comum após a primeira, máximo 3. Um uso por jogador/mão. Onze e decisiva não têm poderes nem regeneração.',
                  )}
                </p>
                <ul>
                  <li>
                    {t(
                      'Espião · 1 energia · Preparação: descobre uma carta aleatória de um adversário após as trocas.',
                    )}
                  </li>
                  <li>
                    {t(
                      'Segunda Chance · 2 energias · Preparação: troca uma carta própria pelo monte, sem reposição.',
                    )}
                  </li>
                  <li>
                    {t(
                      'Impulso · 2 energias · Sua jogada: sobe uma carta comum um nível. Não aceita manilha, coberta ou 3.',
                    )}
                  </li>
                  <li>
                    {t(
                      'Máscara · 1 energia · Sua jogada: oculta uma carta até resolver a vaza, preservando sua força. Não combina com coberta.',
                    )}
                  </li>
                </ul>
                <p>
                  {t(
                    'Na preparação, confirme um poder ou passe. As escolhas ficam seladas até todos responderem; timeout passa. O passe preserva poderes de turno. Casual sorteia individualmente; competitivo espelha poderes entre equipes.',
                  )}
                </p>
              </details>
            </div>
          </section>
        </div>
        <div className="lobby-right-column">
          <div className="lobby-players-column">
            <h3>
              <LobbyIcon name="players" />
              {t('Jogadores da sala')}
            </h3>
            <LobbySeats room={room} send={send} />
          </div>
          {room.status === 'lobby' && (
            <p className="lobby-start-status" id="start-requirements" role="status">
              {host
                ? (startReason ?? t('Todos estão conectados e prontos.'))
                : t('Somente o anfitrião pode iniciar a partida.')}
            </p>
          )}
          <div className="actions lobby-actions">
            {room.status !== 'playing' && (
              <button
                className="button-quiet leave-room"
                type="button"
                aria-label={t('Sair da sala')}
                onClick={() => send({ type: 'LEAVE' })}
              >
                <LobbyIcon name="back" />
                {t('Voltar')}
              </button>
            )}
            {room.status === 'lobby' && host && (
              <button
                className="button-primary"
                type="button"
                disabled={!canStart}
                {...disabledHint(startReason)}
                aria-describedby="start-requirements"
                onClick={() => send({ type: 'START_MATCH' })}
              >
                <LobbyIcon name="play" />
                {t('Iniciar partida')}
              </button>
            )}
            {room.status === 'finished' && host && (
              <button
                className="button-primary"
                type="button"
                onClick={() => send({ type: 'REMATCH' })}
              >
                <LobbyIcon name="play" />
                {t('Revanche')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
