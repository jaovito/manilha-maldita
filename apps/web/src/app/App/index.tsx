import { GameSettings, LanguageSelect } from '../../shared/Settings';
import { t, useLocale } from '../../shared/i18n';
import { defaultRoomConfig, nicknameSchema, type RoomView } from '@truco/game-protocol';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { EntryMenu, Welcome } from '../../features/menu';
import { Lobby, Table, MatchResult } from '../../features/room';
import { RoomMenu } from '../../features/room/components/RoomMenu';
import { MenuScenery } from '../../shared/MenuScenery';
import { DisabledTooltip, disabledHint } from '../../shared/DisabledTooltip';
import { AudioControls, useGameFeedback } from '../../shared/feedback';
import { loadNickname, saveNickname } from '../../shared/preferences/nickname';
import { type Action, connectRoom, envelope, request } from '../../shared/transport/client';

const DevTools = import.meta.env?.DEV
  ? lazy(() => import('../../features/room/components/DevTools'))
  : null;

export function App() {
  const { locale } = useLocale();
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const [soloEnabled, setSoloEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    request<{ solo?: unknown }>('/features')
      .then((features) => {
        if (active) setSoloEnabled(features.solo === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const { preferences, changePreferences, observe, reset } = useGameFeedback();
  const [nickname, setNickname] = useState(loadNickname);
  const [nicknameConfirmed, setNicknameConfirmed] = useState(() => Boolean(loadNickname()));
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
    if (nicknameConfirmed) saveNickname(value);
  };

  const confirmNickname = () => {
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) return;

    setNickname(parsed.data);
    saveNickname(parsed.data);
    setNicknameConfirmed(true);
  };

  const receiveRoom = useCallback(
    (next: RoomView) => {
      observe(next);
      setRoom(next);
    },
    [observe],
  );
  const connectionStatus = useCallback(
    (active: boolean) => {
      if (!active) reset();
      setConnected(active);
    },
    [reset],
  );

  const join = useCallback(
    async (roomCode: string) => {
      await request(`/rooms/${encodeURIComponent(roomCode)}/join`, {});
      connection.current?.close();
      setRoom(null);
      reset();
      history.replaceState(null, '', `/?room=${encodeURIComponent(roomCode)}`);
      connection.current = connectRoom(roomCode, receiveRoom, connectionStatus, setError);
    },
    [connectionStatus, receiveRoom, reset],
  );

  useEffect(() => {
    let mounted = true;

    request<{ nickname: unknown }>('/guest')
      .then(async (guest) => {
        const parsed = nicknameSchema.safeParse(guest.nickname);
        if (!mounted || !parsed.success) return;

        if (!nicknameEdited.current) {
          setNickname(parsed.data);
          saveNickname(parsed.data);
          setNicknameConfirmed(true);

          const invitation = new URLSearchParams(location.search).get('room');
          if (invitation) {
            await join(invitation);
            if (!mounted) connection.current?.close();
          }
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

  const enter = async (create: boolean, solo = false) => {
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
        ? await request<{ code: string }>('/rooms', {
            config: defaultRoomConfig,
            ...(solo ? { solo: true } : {}),
          })
        : { code: code.trim().toUpperCase() };
      await join(next.code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Falha ao entrar na sala.'));
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
      <DisabledTooltip />
      {settingsOpen && (
        <GameSettings onClose={() => setSettingsOpen(false)}>
          <AudioControls preferences={preferences} onChange={changePreferences} />
        </GameSettings>
      )}
      {((!room && !nicknameConfirmed) || (room && room.status !== 'playing')) && (
        <button
          className="game-settings-trigger"
          type="button"
          onClick={() => setSettingsOpen(true)}
        >
          {t('Configurações')}
        </button>
      )}
      {!room?.match && <MenuScenery lobby={Boolean(room)} />}
      {!room?.match && <AudioControls preferences={preferences} onChange={changePreferences} />}
      <header className="app-header">
        <div className="brand">
          <h1 aria-label="Manilha Maldita">
            <img className="brand-logo" src="/art/layers/logo.png" alt="Manilha Maldita" />
          </h1>
        </div>
        <div className="header-meta">
          <p className="eyebrow">
            {t('SALA PRIVADA ·')} {room ? room.config.format : '1v1 / 2v2'}
          </p>
          {room ? (
            <p
              className={`connection-chip ${connected ? 'is-connected' : 'is-reconnecting'}`}
              role="status"
            >
              <span aria-hidden="true" className="connection-dot" />
              {connected ? t('Conectado') : t('Reconectando… Ações aguardam conexão.')}
            </p>
          ) : (
            <span className="status-chip">{t('Jogue com seus amigos')}</span>
          )}
        </div>
      </header>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {!room && !nicknameConfirmed ? (
        <Welcome
          nickname={nickname}
          invitation={Boolean(code)}
          onChange={changeNickname}
          onContinue={confirmNickname}
        />
      ) : !room ? (
        <EntryMenu
          nickname={nickname}
          code={code}
          busy={busy}
          onNicknameChange={changeNickname}
          onCodeChange={setCode}
          onEnter={enter}
          soloEnabled={soloEnabled}
          onPlay={() => void enter(true, true)}
          onSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <div
          data-sequence={room.sequence}
          aria-disabled={!connected}
          {...disabledHint(!connected ? t('Aguarde reconectar para usar as ações da sala.') : null)}
          className={`room-stage ${!connected ? 'disconnected' : ''}`}
        >
          {room.match && (
            <div className="table-surface" inert={room.status === 'finished'}>
              <Table room={room} send={send} />
            </div>
          )}
          <MatchResult room={room} send={send} connected={connected} />
          {room.match ? (
            room.status === 'playing' && (
              <RoomMenu room={room} connected={connected} send={send}>
                <LanguageSelect />
                <AudioControls preferences={preferences} onChange={changePreferences} />
                {DevTools && room.devTools && room.solo && (
                  <Suspense fallback={<p>{t('Carregando ferramentas…')}</p>}>
                    <DevTools
                      key={`${room.matchId}:${room.match?.hand.number}`}
                      room={room}
                      send={send}
                      connected={connected}
                    />
                  </Suspense>
                )}
              </RoomMenu>
            )
          ) : (
            <Lobby room={room} send={send} />
          )}
        </div>
      )}
    </main>
  );
}
