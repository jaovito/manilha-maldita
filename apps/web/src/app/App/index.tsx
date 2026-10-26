import { defaultRoomConfig, nicknameSchema, type RoomView } from '@truco/game-protocol';
import { lazy, useCallback, useEffect, useRef, useState } from 'react';
import { EntryMenu, Welcome } from '../../features/menu';
import { PlayerPanel, usePlayer } from '../../features/player';
import { DisabledTooltip } from '../../shared/DisabledTooltip';
import { AudioControls, useGameFeedback } from '../../shared/feedback';
import { t, useLocale } from '../../shared/i18n';
import { MenuScenery } from '../../shared/MenuScenery';
import { useBrowserNavigation } from '../../shared/navigation';
import { loadNickname, saveNickname } from '../../shared/preferences/nickname';
import { GameSettings } from '../../shared/Settings';
import { type Action, connectRoom, envelope, request } from '../../shared/transport/client';

import { GameRoomStage } from './RoomStage';
import { watchRoomHistory } from './room-history';
import { useServerFeatures } from './use-server-features';

const DevTools = import.meta.env?.DEV
  ? lazy(() => import('../../features/room/components/DevTools'))
  : null;

export function App() {
  const { locale } = useLocale();
  const { navigate, back, route } = useBrowserNavigation();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const { accountsEnabled, soloEnabled } = useServerFeatures();
  const player = usePlayer(accountsEnabled);
  const playerSection = ['cosmetics', 'ranking', 'account'].includes(route.page)
    ? (route.page as 'cosmetics' | 'ranking' | 'account')
    : null;
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
  const boundRoom = useRef<string | null>(null);
  const joining = useRef(0);
  const entryIntent = useRef(0);

  useEffect(() => {
    if (!player.profile) return;
    setNickname(player.profile.nickname);
    setNicknameConfirmed(true);
    saveNickname(player.profile.nickname);
  }, [player.profile]);
  const refreshProgress = player.refresh;
  useEffect(() => {
    if (room?.status !== 'finished' || !room.matchId || !accountsEnabled) return;
    void refreshProgress();
    const retries = [1000, 3000, 6000].map((delay) =>
      setTimeout(() => {
        void refreshProgress();
      }, delay),
    );

    return () => {
      for (const timer of retries) clearTimeout(timer);
    };
  }, [room?.status, room?.matchId, accountsEnabled, refreshProgress]);

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
      const epoch = ++joining.current;
      await request(`/rooms/${encodeURIComponent(roomCode)}/join`, {});
      if (epoch !== joining.current) return;

      connection.current?.close();
      setRoom(null);
      reset();
      boundRoom.current = roomCode;
      navigate('menu', roomCode);
      connection.current = connectRoom(roomCode, receiveRoom, connectionStatus, setError);
    },
    [connectionStatus, receiveRoom, reset, navigate],
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
      entryIntent.current++;
      joining.current++;
      connection.current?.close();
    };
  }, [join]);

  useEffect(
    () =>
      watchRoomHistory({
        connection,
        boundRoom,
        joining,
        reset,
        join,
        onError: setError,
        onExit: (next) => {
          entryIntent.current++;
          setBusy(false);
          setRoom(null);
          setConnected(false);
          setCode(next);
          setError('');
        },
      }),
    [join, reset],
  );

  const enter = async (create: boolean, solo = false) => {
    const epoch = joining.current;
    const intent = ++entryIntent.current;
    setBusy(true);
    setError('');

    try {
      const guest = await request<{ nickname: unknown }>('/guest', { nickname });
      if (intent !== entryIntent.current) return;
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
      if (epoch !== joining.current) return;
      await join(next.code);
    } catch (cause) {
      if (intent === entryIntent.current)
        setError(cause instanceof Error ? cause.message : t('Falha ao entrar na sala.'));
    } finally {
      if (intent === entryIntent.current) setBusy(false);
    }
  };

  const send = (action: Action) => {
    if (!room) return;

    setError('');
    if (action.type !== 'LEAVE') {
      connection.current?.send(envelope(room, action));
      return;
    }
    const leave = () => {
      connection.current?.close();
      connection.current = null;
      reset();
      setRoom(null);
      setConnected(false);
      setCode('');
      boundRoom.current = null;
      joining.current++;
      navigate('menu', null, true);
    };

    // A finished match cannot hold navigation hostage to an unavailable ACK.
    if (room.status === 'finished') {
      try {
        if (connected) connection.current?.send(envelope(room, action));
      } finally {
        leave();
      }
      return;
    }

    connection.current?.send(envelope(room, action), leave);
  };

  return (
    <main
      className={`app-shell ${!room ? 'entry-shell' : room.match ? 'game-shell' : 'lobby-shell'}`}
    >
      <DisabledTooltip />
      {playerSection && (
        <PlayerPanel
          key={playerSection}
          initial={playerSection}
          player={player}
          nickname={nickname}
          onClose={() => {
            back();
            player.clearError();
          }}
        />
      )}
      {!room && !nicknameConfirmed && accountsEnabled && (
        <button
          type="button"
          className="welcome-account"
          onClick={() => navigate('account', route.roomCode)}
        >
          {t('Entrar na conta')}
        </button>
      )}
      {route.page === 'settings' && (
        <GameSettings onClose={() => back()}>
          <AudioControls preferences={preferences} onChange={changePreferences} />
        </GameSettings>
      )}
      {((!room && !nicknameConfirmed) || (room && room.status !== 'playing')) && (
        <button
          className="game-settings-trigger"
          type="button"
          onClick={() => navigate('settings', route.roomCode)}
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
          page={
            route.page === 'join' || route.page === 'tutorial'
              ? route.page
              : code && route.roomCode
                ? 'join'
                : 'menu'
          }
          onNavigate={(page) => {
            if (page === 'menu') back();
            else navigate(page, null);
          }}
          profile={player.profile}
          {...(accountsEnabled
            ? {
                onAccount: () => navigate('account', route.roomCode),
                onCosmetics: () => navigate('cosmetics', route.roomCode),
                onRanking: () => navigate('ranking', route.roomCode),
              }
            : {})}
          nickname={nickname}
          code={code}
          busy={busy}
          onNicknameChange={changeNickname}
          onCodeChange={setCode}
          onEnter={enter}
          soloEnabled={soloEnabled}
          onPlay={() => void enter(true, true)}
          onSettings={() => navigate('settings', route.roomCode)}
        />
      ) : (
        <GameRoomStage
          developmentTools={DevTools}
          room={room}
          connected={connected}
          send={send}
          preferences={preferences}
          onChange={changePreferences}
        />
      )}
    </main>
  );
}
