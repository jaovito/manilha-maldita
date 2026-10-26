import { type ComponentProps, type LazyExoticComponent, Suspense } from 'react';
import { Lobby, MatchResult, Table } from '../../features/room';
import { RoomMenu } from '../../features/room/components/RoomMenu';
import { disabledHint } from '../../shared/DisabledTooltip';
import { AudioControls } from '../../shared/feedback';
import { t } from '../../shared/i18n';
import { LanguageSelect } from '../../shared/Settings';

type Props = Omit<ComponentProps<typeof RoomMenu>, 'children'> &
  ComponentProps<typeof AudioControls> & {
    developmentTools: LazyExoticComponent<
      typeof import('../../features/room/components/DevTools')['default']
    > | null;
  };

export function GameRoomMenu({
  room,
  connected,
  send,
  preferences,
  onChange,
  developmentTools: DevTools,
}: Props) {
  return (
    <RoomMenu room={room} connected={connected} send={send}>
      <LanguageSelect />
      <AudioControls preferences={preferences} onChange={onChange} />
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
  );
}

export function GameRoomStage({
  room,
  connected,
  send,
  preferences,
  onChange,
  developmentTools,
}: Props) {
  return (
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
          <GameRoomMenu
            developmentTools={developmentTools}
            room={room}
            connected={connected}
            send={send}
            preferences={preferences}
            onChange={onChange}
          />
        )
      ) : (
        <Lobby room={room} send={send} />
      )}
    </div>
  );
}
