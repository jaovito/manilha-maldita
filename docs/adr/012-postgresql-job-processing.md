# ADR 012 — Consumidor transacional da fila PostgreSQL

Data: 22/10/2026. Estado: aceita para o segundo incremento do M5.

## Contexto

Após validar o setup da ADR 011, o proprietário autorizou prosseguir em incrementos revisáveis. O próximo passo torna operacional o mecanismo da fila, preservando as decisões ainda abertas sobre login, XP, pontos e elegibilidade. O servidor de jogo não deve consumir jobs com um handler vazio nem depender do banco por jogada.

## Decisão

Adicionar módulo `jobs`, com política pura de retentativas, worker de aplicação orientado por ports e adaptador Bun.SQL/PostgreSQL. Sem dependência, migration ou infraestrutura adicional. O adaptador recebe um cliente SQL configurado e um processador obrigatório; o worker recebe scheduler e sink de eventos. Não abrir conexões, instalar timers nem consumir jobs ao importar o módulo.

`enqueue` exige um handle transacional: resultado autoritativo e job podem compartilhar o commit. Repetição por tipo/partida não muda estado, prazo ou limite já registrado. Não criar endpoint público para enfileirar ou confirmar resultados.

Uma operação `runNext` seleciona job vencido com `FOR UPDATE SKIP LOCKED` e mantém o lock durante uma transação curta. Incrementa a tentativa, marca reserva e executa processador em savepoint. Sucesso confirma efeitos e conclusão juntos. Erro reverte o savepoint, preserva somente a tentativa e registra reagendamento/falha com código genérico. Erro na conexão/transação externa reverte também tentativa/reserva: outro consumidor poderá selecionar o job novamente.

Esse modo é restrito a processadores confiáveis com efeitos no mesmo PostgreSQL, usando exclusivamente o handle recebido. Não oferece exactly-once para e-mail, HTTP ou qualquer efeito externo. O handle SQL não é sandbox: o código do processador exige revisão e não pode confirmar/encerrar transações, abrir conexões ou executar I/O externo. Os testes alteram XP apenas como fixture para provar atomicidade; não definem recompensa de produto.

A conclusão atômica não substitui a unicidade de `match_rewards`: o futuro processador deverá deduplicar concessões também pelo participante/partida. Limpeza ou recriação manual de um job não pode autorizar reaplicar uma recompensa já concedida.

Reservas `running` antigas com prazo vencido são recuperadas sob lock. Se o limite já foi alcançado, ficam `failed` sem executar o processador. Como o novo consumidor não publica reserva separada dos efeitos, uma reserva dele não será roubada enquanto estiver em execução: o row lock impede a seleção por outro consumidor. Não misturar este modo com consumidores externos que concluam por token sem revisar o protocolo de fencing/idempotência.

## Limites e operação

- Um job ativo por instância de worker. Várias instâncias usam locks PostgreSQL; não há ordem global garantida.
- Lotes de até 25 operações por wake, máximo configurável 100; ceder ao scheduler entre lotes. Avisos simultâneos são coalescidos. Polling default de 1 s, validado entre 10 ms e 60 s.
- Retry exponencial default 1 s até 60 s, sem jitter nesta escala inicial. A política é copiada/validada e não altera valores de XP/pontos. Jobs só vencem pelo relógio do PostgreSQL, não por timestamp enviado pelo navegador.
- Statement timeout e idle-in-transaction timeout de 5 s, locais à transação. São limites por instrução/inatividade, não orçamento total de uma função JavaScript nem permissão para trabalho longo.
- LISTEN usa conexão dedicada gerenciada por Bun.SQL; avisos e callback de reconexão só acordam o worker. Ele varre no início e periodicamente, sem confiar no payload. A entrega perdida de aviso não remove o job.
- Falha de armazenamento interrompe a rodada e aguarda novo polling/wake; não há loop de retentativa sem espera. Eventos operacionais são apenas `completed`, `retry`, `failed`, `queue_unavailable`, sem dados/erros brutos.
- `stop` cancela timers, remove listener e aguarda a operação em curso. É idempotente; não fecha o cliente SQL, que pertence ao chamador. Falha no unsubscribe é propagada após aguardar a operação.

Não há CLI, flag ou integração no `startServer`: faltam processador de recompensas e persistência autoritativa de término. Nenhum job é concluído automaticamente sem esse processador. Limpeza/retenção, métricas de idade/tamanho da fila e papéis/TLS de produção permanecem fora deste incremento. A recuperação demonstrada começa após o commit do resultado/job; salas em memória continuam sem recuperação após queda.

## Validação requerida

Unitários com scheduler controlado cobrem inicialização, polling, coalescência, concorrência, limites, falhas e shutdown. Integração PostgreSQL cobre resultado/job atômicos, duplicatas, savepoint com erro SQL, rollback de efeitos, prazo e teto de tentativas, consumidores concorrentes e encerramento real apenas da conexão criada pelo teste. Sem testes que simulem rede chamando múltiplos componentes locais.
