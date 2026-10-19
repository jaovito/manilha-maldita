import { t } from '../../../../../shared/i18n';
import { normalizeConfig, type RoomConfig, type RoomView } from '@truco/game-protocol';
import { useId } from 'react';
import { disabledHint } from '../../../../../shared/DisabledTooltip';
import type { Action } from '../../../../../shared/transport/client';
import { LobbyIcon } from '../Icon';

export function LobbySettings({ room, send }: { room: RoomView; send: (action: Action) => void }) {
  const editable = room.selfSeat === room.hostSeat && room.status === 'lobby';
  const group = useId();
  const lockedReason = editable
    ? null
    : room.status !== 'lobby'
      ? t('As configurações ficam bloqueadas durante e após a partida.')
      : t('Somente o anfitrião pode alterar as configurações da sala.');
  const configure = (config: RoomConfig) =>
    send({ type: 'CONFIGURE', config: normalizeConfig(config) });

  return (
    <fieldset
      className="lobby-settings"
      disabled={!editable}
      {...disabledHint(lockedReason)}
      aria-describedby={!editable ? `${group}-locked` : undefined}
    >
      <legend>{t('Configurações da sala')}</legend>
      {!editable && (
        <p className="settings-locked-note" id={`${group}-locked`}>
          <LobbyIcon name="lock" />
          {t('Somente leitura')}
        </p>
      )}
      <div className="lobby-option-row">
        <LobbyIcon name="players" />
        <div className="option-caption">
          <strong>{t('Modo')}</strong>
          <small>{t('Número de jogadores')}</small>
        </div>
        <div className="pixel-options" role="radiogroup" aria-label={t('Formato')}>
          {(['1v1', '2v2'] as const).map((format) => (
            <label key={format}>
              <input
                type="radio"
                name={`${group}-format`}
                value={format}
                checked={room.config.format === format}
                {...disabledHint(lockedReason)}
                onChange={() => configure({ ...room.config, format })}
              />
              <span>{format}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="lobby-option-row">
        <LobbyIcon name="swords" />
        <div className="option-caption">
          <strong>{t('Estilo')}</strong>
          <small>{t('Tipo de partida')}</small>
        </div>
        <div className="pixel-options" role="radiogroup" aria-label={t('Preset')}>
          {(['casual', 'competitive'] as const).map((preset) => (
            <label key={preset}>
              <input
                type="radio"
                name={`${group}-preset`}
                value={preset}
                checked={room.config.preset === preset}
                {...disabledHint(lockedReason)}
                onChange={() => configure({ ...room.config, preset })}
              />
              <span>{preset === 'casual' ? t('Casual') : t('Competitivo')}</span>
            </label>
          ))}
        </div>
      </div>
      <details className="lobby-clock-options">
        <summary>
          <LobbyIcon name="clock" />
          {t('Ajustes de tempo')}
        </summary>
        {room.config.preset === 'casual' && editable ? (
          <div className="clock-fields">
            <label>
              {t('Tempo de preparação')}
              <select
                value={room.config.preparationTimeoutMs}
                onChange={(event) =>
                  configure({ ...room.config, preparationTimeoutMs: Number(event.target.value) })
                }
              >
                <option value={15000}>{t('15 segundos')}</option>
                <option value={10000}>{t('10 segundos')}</option>
                <option value={30000}>{t('30 segundos')}</option>
              </select>
            </label>
            <label>
              {t('Tempo de carta')}
              <select
                value={room.config.cardTimeoutMs ?? 0}
                onChange={(event) =>
                  configure({ ...room.config, cardTimeoutMs: Number(event.target.value) || null })
                }
              >
                <option value={30000}>{t('30 segundos')}</option>
                <option value={20000}>{t('20 segundos')}</option>
                <option value={0}>{t('Sem relógio de cartas')}</option>
              </select>
            </label>
            <label>
              {t('Tempo de resposta')}
              <select
                value={room.config.responseTimeoutMs}
                onChange={(event) =>
                  configure({ ...room.config, responseTimeoutMs: Number(event.target.value) })
                }
              >
                <option value={20000}>{t('20 segundos')}</option>
                <option value={15000}>{t('15 segundos')}</option>
              </select>
            </label>
          </div>
        ) : (
          <p className="clock-summary">
            {room.config.cardTimeoutMs === null
              ? t('Sem relógio de cartas')
              : t('Carta: {0} segundos', [room.config.cardTimeoutMs / 1000])}{' '}
            {t('· Resposta:')} {room.config.responseTimeoutMs / 1000} {t('segundos · Preparação:')}{' '}
            {room.config.preparationTimeoutMs / 1000} {t('segundos')}
          </p>
        )}
      </details>
    </fieldset>
  );
}
