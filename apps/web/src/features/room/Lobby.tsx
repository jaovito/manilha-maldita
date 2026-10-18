import type { RoomView } from '@truco/game-protocol';
import type { Action } from '../../shared/transport/client';
import { LobbySettings } from './LobbySettings';
import { LobbySeats } from './LobbySeats';
import { RoomInvite } from './RoomInvite';
import { LobbyIcon } from './LobbyIcon';

export function Lobby({ room, send }: { room: RoomView; send: (action: Action) => void }) {
  const host = room.selfSeat === room.hostSeat;
  const missing = room.seats.filter((player) => player === null).length;
  const occupants = room.seats.flatMap((player) => (player === null ? [] : [player]));
  const disconnected = occupants.filter((player) => !player.connected);
  const unready = occupants.filter((player) => player.connected && !player.ready);
  const canStart = missing === 0 && disconnected.length === 0 && unready.length === 0;

  return (
    <section className={`room-lobby ${room.match ? 'compact-lobby' : ''}`} aria-label="Lobby">
      <div className="lobby-workbench">
        <div className="lobby-left-column">
          <div className="lobby-heading">
            <p className="eyebrow">SALA PRIVADA · {room.code}</p>
            <h2 aria-label={`Sala ${room.code}`}>{host ? 'Criar sala' : 'Sala privada'}</h2>
          </div>
          <div className="lobby-config-column">
            <LobbySettings room={room} send={send} />
            <div className="lobby-option-row room-link-panel">
              <LobbyIcon name="key" />
              <div className="option-caption">
                <strong>Link da sala</strong>
                <small>Compartilhe para convidar amigos</small>
              </div>
              <RoomInvite code={room.code} />
            </div>
            <div className="lobby-option-row room-privacy">
              <LobbyIcon name="lock" />
              <div className="option-caption">
                <strong>Privada</strong>
                <small>Quem tiver o link pode entrar</small>
              </div>
              <label className="pixel-switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked="true"
                  aria-label="Sala privada"
                  checked
                  disabled
                  readOnly
                />
                <span aria-hidden="true" />
                <small>Sim</small>
              </label>
            </div>
          </div>
          <section className="lobby-powers" aria-label="Sistema de poderes">
            <div className="power-fan" aria-hidden="true">
              <span className="fan-card">♥</span>
              <span className="fan-card fan-spy">
                <LobbyIcon name="eye" />
                ESPIÃO
              </span>
              <span className="fan-card">♠</span>
            </div>
            <div>
              <h3>Sistema de poderes</h3>
              <p>Habilidades especiais para mudar o rumo da partida.</p>
              <button className="power-preview" type="button" disabled>
                <LobbyIcon name="cards" />
                Ver poderes · Em breve
              </button>
            </div>
          </section>
        </div>
        <div className="lobby-right-column">
          <div className="lobby-players-column">
            <h3>
              <LobbyIcon name="players" />
              Jogadores da sala
            </h3>
            <LobbySeats room={room} send={send} />
            {room.status === 'lobby' && (
              <div className="lobby-notice">
                <h4>Convide seus amigos para entrar na sala!</h4>
                <div
                  className="lobby-requirements"
                  id="start-requirements"
                  role="status"
                  aria-live="polite"
                >
                  {missing > 0 && (
                    <p>
                      {missing === 1 ? 'Falta 1 jogador' : `Faltam ${missing} jogadores`} para
                      completar a sala {room.config.format}.
                    </p>
                  )}
                  {disconnected.map((player) => (
                    <p key={player.seat}>Aguardando a reconexão de {player.nickname}.</p>
                  ))}
                  {unready.map((player) => (
                    <p key={player.seat}>
                      {player.seat === room.selfSeat
                        ? 'Você ainda precisa'
                        : `${player.nickname} ainda precisa`}{' '}
                      clicar em “Estou pronto”.
                    </p>
                  ))}
                  {canStart && <p>Todos estão conectados e prontos.</p>}
                  {!host && <p>Somente o anfitrião pode iniciar a partida.</p>}
                </div>
                {missing > 0 && (
                  <details className="invite-help">
                    <summary>Como convidar seus amigos?</summary>
                    <p className="invite-hint">
                      Compartilhe o link acima com outro jogador. Para testar na mesma máquina, use
                      perfis de navegador diferentes ou uma janela normal e outra anônima. Abas da
                      mesma sessão controlam o mesmo assento.
                    </p>
                  </details>
                )}
              </div>
            )}
          </div>
          <div className="actions lobby-actions">
            {room.status !== 'playing' && (
              <button
                className="button-quiet leave-room"
                type="button"
                aria-label="Sair da sala"
                onClick={() => send({ type: 'LEAVE' })}
              >
                <LobbyIcon name="back" />
                Voltar
              </button>
            )}
            {room.status === 'lobby' && host && (
              <button
                className="button-primary"
                type="button"
                disabled={!canStart}
                aria-describedby="start-requirements"
                onClick={() => send({ type: 'START_MATCH' })}
              >
                <LobbyIcon name="play" />
                Iniciar partida
              </button>
            )}
            {room.status === 'finished' && host && (
              <button
                className="button-primary"
                type="button"
                onClick={() => send({ type: 'REMATCH' })}
              >
                <LobbyIcon name="play" />
                Revanche
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
