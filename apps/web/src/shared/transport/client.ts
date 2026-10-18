import {
  type ClientMessage,
  type RoomView,
  type ServerMessage,
  serverMessageSchema,
} from '@truco/game-protocol';

const httpErrors = new Map([
  ['FORBIDDEN_ORIGIN', 'Este endereço não está autorizado pelo servidor. Confira a URL do jogo.'],
  ['UNAUTHENTICATED', 'Sua sessão expirou. Recarregue a página e tente novamente.'],
  ['ROOM_CAPACITY', 'O servidor está cheio. Tente novamente em alguns instantes.'],
  ['SESSION_CAPACITY', 'Você atingiu o limite de salas. Saia de uma sala anterior para continuar.'],
  ['ROOM_NOT_FOUND', 'Sala não encontrada. Confira o código ou peça um novo convite.'],
  ['ROOM_FULL', 'Esta sala está cheia. Peça outro convite.'],
  ['ROOM_CLOSED', 'Esta sala não aceita mais jogadores. Peça um novo convite.'],
  ['RATE_LIMITED', 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.'],
]);

export async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.',
    );
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code =
      payload !== null && typeof payload === 'object' && 'code' in payload
        ? payload.code
        : undefined;
    if (path === '/guest' && code === 'SESSION_CAPACITY')
      throw new Error('O servidor está cheio. Tente novamente em alguns instantes.');
    if (path === '/guest' && code === 'INVALID_MESSAGE')
      throw new Error(
        'Use um apelido de até 24 caracteres com letras, números, espaços, _, . ou -.',
      );

    const message = typeof code === 'string' ? httpErrors.get(code) : undefined;

    throw new Error(message ?? 'Não foi possível concluir. Confira os dados e tente novamente.');
  }

  return response.json();
}

export type Action = ClientMessage['action'];
export function envelope(room: RoomView, action: Action): ClientMessage {
  const gameplay = [
    'PLAY_CARD',
    'REQUEST_RAISE',
    'RESPOND_RAISE',
    'DECIDE_ELEVEN',
    'SURRENDER',
  ].includes(action.type);
  return {
    protocol: 1,
    commandId: crypto.randomUUID(),
    matchId: room.matchId,
    decisionId: gameplay ? room.decisionId : null,
    expectedRevision: gameplay ? (room.match?.revision ?? null) : room.roomRevision,
    action,
  };
}

export function connectRoom(
  code: string,
  receive: (room: RoomView) => void,
  status: (connected: boolean) => void,
  error: (message: string) => void,
) {
  let socket: WebSocket;
  let stopped = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sequence = -1;
  let latest: RoomView | null = null;
  const pending = new Map<string, () => void>();

  const synchronize = () => {
    if (stopped || latest === null || socket.readyState !== WebSocket.OPEN) return;

    // Refresh only the authorized snapshot; never retry a player's earlier intention.
    socket.send(JSON.stringify(envelope(latest, { type: 'SYNC' })));
  };

  const resume = () => {
    if (document.visibilityState === 'visible') synchronize();
  };

  window.addEventListener('focus', synchronize);
  document.addEventListener('visibilitychange', resume);

  const open = () => {
    socket = new WebSocket(
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/rooms/${encodeURIComponent(code)}/ws`,
    );
    socket.onopen = () => {
      attempts = 0;
      status(true);
    };
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = serverMessageSchema.parse(JSON.parse(String(event.data)));
      } catch {
        error('Resposta inválida do servidor.');
        return;
      }
      if (message.type === 'SNAPSHOT' && message.room.sequence > sequence) {
        sequence = message.room.sequence;
        latest = message.room;
        receive(message.room);
      } else if (message.type === 'ACK') {
        const accepted = pending.get(message.commandId);
        pending.delete(message.commandId);
        accepted?.();
      } else if (message.type === 'ERROR') {
        if (message.commandId !== null) pending.delete(message.commandId);
        if (
          [
            'CONNECTION_REPLACED',
            'SESSION_EXPIRED',
            'UNAUTHENTICATED',
            'NOT_MEMBER',
            'ROOM_NOT_FOUND',
          ].includes(message.code)
        )
          stopped = true;
        error(
          message.code === 'CONNECTION_REPLACED'
            ? 'Esta mesa foi aberta em outra aba. Recarregue para retomar aqui.'
            : `Ação recusada: ${message.code}`,
        );
      }
    };
    socket.onclose = (event) => {
      if (event?.reason === 'LEFT_ROOM') stopped = true;
      pending.clear();
      status(false);
      if (!stopped && attempts < 8) timer = setTimeout(open, Math.min(500 * 2 ** attempts++, 8000));
      else if (!stopped)
        error('Reconexão interrompida. Recarregue a página para tentar novamente.');
    };
    socket.onerror = () => status(false);
  };
  open();
  return {
    send(message: ClientMessage, accepted?: () => void) {
      if (socket.readyState !== WebSocket.OPEN) {
        error('Sem conexão. Aguarde a reconexão.');
        return;
      }
      if (accepted) pending.set(message.commandId, accepted);
      socket.send(JSON.stringify(message));
    },
    close() {
      stopped = true;
      window.removeEventListener('focus', synchronize);
      document.removeEventListener('visibilitychange', resume);
      pending.clear();
      clearTimeout(timer);
      socket.onclose = null;
      socket.onmessage = null;
      socket.onopen = null;
      socket.onerror = null;
      socket.close();
    },
  };
}
