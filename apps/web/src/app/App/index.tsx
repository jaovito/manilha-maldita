import { defaultRoomConfig, nicknameSchema, type RoomView } from '@truco/game-protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EntryMenu } from '../../features/menu';
import { Lobby, Table } from '../../features/room';
import { loadNickname, saveNickname } from '../../shared/preferences/nickname';
import { type Action, connectRoom, envelope, request } from '../../shared/transport/client';

export function App() {
  const [nickname, setNickname] = useState(loadNickname);
  const nicknameEdited = useRef(false);
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') ?? '');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const connection = useRef<ReturnType<typeof connectRoom> | null>(null);

  const changeNickname = (value: string) => {
    nicknameEdited.current = true;
    setNickname(value);
    saveNickname(value);
  };

  const join = useCallback(async (roomCode: string) => {
    await request(`/rooms/${encodeURIComponent(roomCode)}/join`, {});
    connection.current?.close();
    setRoom(null);
    history.replaceState(null, '', `/?room=${encodeURIComponent(roomCode)}`);
    connection.current = connectRoom(roomCode, setRoom, setConnected, setError);
  }, []);

  useEffect(() => {
    let mounted = true;

    request<{ nickname: unknown }>('/guest')
      .then(async (guest) => {
        const parsed = nicknameSchema.safeParse(guest.nickname);
        if (!mounted || !parsed.success) return;

        if (!nicknameEdited.current) {
          setNickname(parsed.data);
          saveNickname(parsed.data);
        }
        const invitation = new URLSearchParams(location.search).get('room');
        if (invitation) {
          await join(invitation);
          if (!mounted) connection.current?.close();
        }
      })
      .catch(() => {
        /* A saved nickname is only a preference; entering obtains a session. */
      });

    return () => {
      mounted = false;
      connection.current?.close();
    };
  }, [join]);

  const enter = async (create: boolean) => {
    setBusy(true);
    setError('');

    try {
      const guest = await request<{ nickname: unknown }>('/guest', { nickname });
      const parsed = nicknameSchema.safeParse(guest.nickname);
      if (parsed.success) {
        setNickname(parsed.data);
        saveNickname(parsed.data);
      }

      const next = create
        ? await request<{ code: string }>('/rooms', { config: defaultRoomConfig })
        : { code: code.trim().toUpperCase() };
      await join(next.code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao entrar na sala.');
    } finally {
      setBusy(false);
    }
  };

  const send = (action: Action) => {
    if (!room) return;

    setError('');
    if (action.type !== 'LEAVE') {
      connection.current?.send(envelope(room, action));
      return;
    }
    connection.current?.send(envelope(room, action), () => {
      connection.current?.close();
      connection.current = null;
      setRoom(null);
      setConnected(false);
      history.replaceState(null, '', '/');
    });
  };

  return (
    <main
      className={`app-shell ${!room ? 'entry-shell' : room.match ? 'game-shell' : 'lobby-shell'}`}
    >
      <header className="app-header">
        <div className="brand">
          <span className="brand-suits" aria-hidden="true">
            ♥ ♠ ♦ ♣
          </span>
          <h1 aria-label="Truco Caótico">
            <span className="brand-main">TRUCO</span>
            <span className="brand-ribbon">CAÓTICO</span>
          </h1>
        </div>
        <div className="header-meta">
          <p className="eyebrow">SALA PRIVADA · {room ? room.config.format : '1v1 / 2v2'}</p>
          {room ? (
            <p
              className={`connection-chip ${connected ? 'is-connected' : 'is-reconnecting'}`}
              role="status"
            >
              <span aria-hidden="true" className="connection-dot" />
              {connected ? 'Conectado' : 'Reconectando… Ações aguardam conexão.'}
            </p>
          ) : (
            <span className="status-chip">Jogue com seus amigos</span>
          )}
        </div>
      </header>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {!room ? (
        <EntryMenu
          nickname={nickname}
          code={code}
          busy={busy}
          onNicknameChange={changeNickname}
          onCodeChange={setCode}
          onEnter={enter}
        />
      ) : (
        <div
          data-sequence={room.sequence}
          aria-disabled={!connected}
          className={`room-stage ${!connected ? 'disconnected' : ''}`}
        >
          {room.match && <Table room={room} send={send} />}
          {room.match ? (
            <details className="room-menu" open={room.status === 'finished'}>
              <summary>Sala · {room.code}</summary>
              {room.outcome && (
                <p className="room-result">
                  {room.outcome.winner
                    ? `Equipe ${room.outcome.winner} venceu a partida.`
                    : 'Partida sem vencedor.'}
                </p>
              )}
              <Lobby room={room} send={send} />
            </details>
          ) : (
            <Lobby room={room} send={send} />
          )}
        </div>
      )}
    </main>
  );
}
