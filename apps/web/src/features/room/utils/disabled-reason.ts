import type { RoomView } from '@truco/game-protocol';

export function gameplayDisabledReason(room: RoomView): string | null {
  if (room.status !== 'playing')
    return 'A partida terminou. Use o menu de resultado para continuar.';
  if (room.paused) return 'A partida está pausada enquanto um jogador reconecta.';
  if (room.transition?.kind === 'deal') return 'Aguarde a distribuição das cartas.';
  if (room.transition) return 'Aguarde a apresentação do resultado antes de continuar.';

  return null;
}
