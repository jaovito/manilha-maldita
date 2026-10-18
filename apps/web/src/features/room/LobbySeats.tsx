import type { RoomView } from '@truco/game-protocol';
import type { Action } from '../../shared/transport/client';

export function LobbySeats({ room, send }: { room: RoomView; send: (action: Action) => void }) {
  const ownParity = room.selfSeat % 2;

  return (
    <div className="lobby-teams">
      {[ownParity, 1 - ownParity].map((parity) => (
        <section
          key={parity}
          className={`lobby-team ${parity === ownParity ? 'team-own' : 'team-enemy'}`}
          aria-label={parity === ownParity ? 'Sua equipe' : 'Adversários'}
        >
          <div className="team-heading">
            <h4>{parity === ownParity ? 'Sua equipe' : 'Adversários'}</h4>
            <span>Equipe {parity === 0 ? 'A' : 'B'}</span>
          </div>
          <ol className="seat-grid">
            {Array.from({ length: room.seats.length }, (_, seat) => seat)
              .filter((seat) => seat % 2 === parity)
              .map((seat) => {
                const player = room.seats[seat];

                return (
                  <li
                    key={seat}
                    className={`lobby-seat team-${seat % 2 === 0 ? 'a' : 'b'} ${player ? 'is-occupied' : 'is-empty'} ${player?.ready ? 'is-ready' : ''}`}
                  >
                    <div className="seat-portrait">
                      <span
                        aria-hidden="true"
                        className={`avatar avatar-${seat} ${player ? '' : 'avatar-empty'}`}
                      />
                    </div>
                    <div className="seat-info">
                      <strong>
                        Equipe {seat % 2 === 0 ? 'A' : 'B'} · Assento {seat + 1}
                      </strong>
                      <p className="seat-status">
                        {player
                          ? `${player.nickname} · ${player.connected ? 'conectado' : 'desconectado'} · ${player.ready ? 'pronto' : 'aguardando'}`
                          : 'Livre'}
                      </p>
                      {player && (
                        <div className="seat-badges">
                          {seat === room.selfSeat && (
                            <span className="seat-badge self-badge">Você</span>
                          )}
                          {seat === room.hostSeat && (
                            <span className="seat-badge host-badge">Anfitrião</span>
                          )}
                          {player.ready && <span className="seat-badge ready-badge">Pronto</span>}
                        </div>
                      )}
                    </div>
                    <div className="seat-actions">
                      {room.status === 'lobby' && seat === room.selfSeat && player && (
                        <button
                          className="seat-ready-toggle"
                          type="button"
                          aria-pressed={player.ready}
                          onClick={() => send({ type: 'READY', ready: !player.ready })}
                        >
                          {player.ready ? 'Cancelar pronto' : 'Estou pronto'}
                        </button>
                      )}
                      {room.status === 'lobby' && player === null && (
                        <button type="button" onClick={() => send({ type: 'SET_SEAT', seat })}>
                          Sentar no assento {seat + 1}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </div>
  );
}
