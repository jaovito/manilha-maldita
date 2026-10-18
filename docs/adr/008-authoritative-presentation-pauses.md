# ADR 008 — Pausas de apresentação controladas pelo servidor

Status: aceito para o incremento inicial do M4, autorizado pelo pedido de animações e tempo legível entre resultados e nova vez.

## Contexto

O servidor publicava diretamente a decisão seguinte à vaza e distribuía outra mão no mesmo comando que encerrava a anterior. Os jogadores não tinham um intervalo estável para observar resultado, placar ou por que alguém iniciaria novamente. Esperar animação ou ACK do cliente permitiria prolongar a partida e produzir relógios diferentes entre jogadores.

## Decisão

A autoridade da sala introduz pausas fixas de apresentação: distribuição **900 ms**, resultado de vaza **1.800 ms** e resultado de mão **2.400 ms**. São defaults operacionais reversíveis de playtest; não alteram força, pontos, sorteio, orçamento de reconexão nem os tempos disponíveis para decisões. O cliente não pode modificar ou confirmar sua duração.

`RoomView.transition` é opcional e contém somente `{ id, kind: 'deal' | 'trick' | 'hand', until }`. O identificador é opaco e `until` é um instante do relógio do servidor em milissegundos. Ausência indica que não há pausa de apresentação. Enquanto presente, `decisionId` e `deadline` são nulos; `paused` continua reservado à proteção de reconexão. A interface deve bloquear ações de gameplay nesse intervalo e pode apresentar animação, texto e áudio derivados da projeção autorizada. SYNC, reconexão e desistência continuam disponíveis; sair de uma partida sem desistir continua proibido.

A vaza resolvida permanece em `completedTricks`; o turno indicado na fase é o próximo, ainda sem decisão aberta. Em `HAND_END`, a mão encerrada, suas cartas autorizadas e seu resultado permanecem projetados; somente ao fim desse intervalo ocorre o sorteio da mão seguinte e uma nova pausa `deal`. Ao atingir doze, `MATCH_END` permanece visível e não distribui outra mão. Nenhuma dessas pausas revela cartas cobertas, remanescentes ou Máscara sem vaza resolvida.

Comandos, callbacks e presença passam pela mesma fila da sala. O agendamento identifica tanto a decisão quanto a transição, rejeitando callbacks de contextos substituídos. Nenhuma proteção é debitada durante a apresentação; ausências só passam a consumir orçamento quando a próxima decisão abre. Reconectar não altera o fim da pausa. Um callback atrasado abre a decisão com seu tempo completo no instante processado: não aplica timeout retroativo a um jogador que ainda não recebeu decisão acionável. Desistência, encerramento anormal e revanche removem a transição.

## Validação e limites

Testes com relógio falso cobrem fronteiras, callback atrasado/obsoleto, idempotência, rejeições, entropia diferida, placar estável, reconexão sem consumo antecipado e desistência em cada pausa. Integração HTTP/WS real aguarda as transições, preservando sessões independentes e partidas completas. Os valores exigem playtests humanos; a entrega não comprova balanceamento, duração final de partidas, recuperação após reinício nem infraestrutura de produção.
