# ADR 006 — Salas autoritativas e reconexão do M2

Estado: aceita para o M2, 18/10/2026.

## Contexto

O motor M1 era puro e executava partidas sem rede. Salas privadas 1v1/2v2 exigem identidade de convidado, lobby e um escritor único para partidas, presença, timers e revanche. O MVP não demanda distribuição nem persistência por jogada.

## Decisão

Usar `RoomService` em memória com fila por sala, limitada e recuperável após erros. Hono/Bun fica no bootstrap/adaptadores; tempo, IDs, entropia e agendamento entram por ports. Transporte valida schemas estritos do protocolo; o navegador importa somente seus contratos públicos. O servidor gera o iniciador, os embaralhamentos e as decisões.

Convidados retomam o assento por cookie HttpOnly/SameSite=Strict com credencial criptográfica expirável. O código da sala é convite, nunca identidade. A associação sessão/sala/assento é verificada antes do registro de idempotência e do envio de projeção. Conexão nova substitui a anterior sem disputar reconexão automática.

Separar sequência de snapshots, revisão de lobby e revisão/contexto de gameplay. Cache recente por jogador lógico, partida e comando devolve o ACK original após reconectar; conteúdo diferente com o mesmo ID é rejeitado. Os 512 resultados recentes de cada sala são retidos até evicção/expiração. A proteção contra replay antigo continua pela revisão e decisão mesmo após evicção. Cada envio é projeção autorizada completa e validada por schema.

Relógio de decisão usa tempo explícito e orçamento cumulativo de reconexão, sem recarga entre ausências. Pausas só quando nenhum responsável elegível conectado pode agir; retomar o restante, nunca o prazo inteiro. Terminar ausências sem timer de cartas exige fallback após proteção. Salas totalmente desconectadas expiram em 60 s casual/30 s competitivo sem vencedor. Esses detalhes operacionais não mudam as regras de cartas, apostas ou poderes.

## Consequências

Partidas, lobby e revanche podem ser exercitados por clientes HTTP/WS e contextos de navegador independentes. Há uma mesa DOM funcional para validar M2 antes do acabamento visual. Poderes, energia e preparação continuam no M3; não foi criado um novo preset de produto.

Unitários e integração Bun de servidor compartilham uma execução de cobertura: o bootstrap importa o transporte real, de modo que o relatório mede cada arquivo sobre o conjunto de comportamentos sem impor porcentagens sobre imports parciais de smoke tests. DOM e PostgreSQL permanecem isolados. O mínimo de 80% por arquivo e o inventário de fontes continuam obrigatórios, sem novas exclusões de produto.

O processo é uma autoridade única, com 256 salas, três salas por sessão, filas limitadas, limites de payload/rate e descarte de clientes lentos. Nenhum deploy, recurso remoto ou analytics foi provisionado. Reinício perde sessões e partidas: é falha técnica sem derrota registrada, não reconexão recuperável. Redis, recuperação durável e múltiplas instâncias continuam fora do M2.
