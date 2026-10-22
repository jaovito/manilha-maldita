# Banco local, migrações e seeds

PostgreSQL 18.6 Alpine em Docker Compose, com Drizzle ORM 0.45.4, Drizzle Kit 0.31.11 e driver SQL nativo de Bun. O setup autorizado do M5 acrescenta schemas e migrations de produto; o servidor ainda não os utiliza e não há banco no caminho das jogadas.

## Desenvolvimento

```sh
# Opcional: personalize as configurações locais antes de subir os containers.
cp .env.example .env
bun run db:up
bun run db:migrate
bun run db:seed
```

Não sobrescreva um `.env` existente. Sem ele, os comandos usam os defaults locais de `.env.example`. Se alterar portas/senhas, mantenha `DATABASE_URL` e `TEST_DATABASE_URL` coerentes com as variáveis do Compose.

- Desenvolvimento: `127.0.0.1:55432`, banco `truco_dev`, usuário `truco`, volume `truco_postgres-data`.
- Testes: `127.0.0.1:55433`, banco `truco_test`, usuário `truco_test`, armazenamento `tmpfs` descartável ao parar o container.
- Ambos só publicam portas no loopback e possuem healthcheck; o Compose espera o PostgreSQL ficar pronto.
- As credenciais do exemplo são fictícias, exclusivamente locais. Nunca as reutilize em produção.

`bun run db:down` para somente o PostgreSQL de desenvolvimento, preservando o volume. `bun run db:test:down` para somente a instância de testes, descartando seu armazenamento temporário. Não há comando de reset destrutivo do banco de desenvolvimento. Não use `docker compose down -v` se quiser preservar dados.

## Estrutura e ciclo de migrações

```text
apps/server/
  drizzle.config.ts
  database/
    target.ts             # seleção explícita e validação do destino local
    connect.ts            # conexão Bun SQL + Drizzle
    schema.ts             # exports para geração Drizzle
    schema/               # contas, catálogos, resultados e jobs
    migrations/           # SQL versionado e metadados do Drizzle
    migrate.ts
    cli.ts
    seeds/
      run.ts              # executor transacional
      registry.ts         # seeds locais de produto, inicialmente vazio
  tests/database/         # guardas e integração real com PostgreSQL
```

As migrations 0000/0001 reservam o namespace `app` e permanecem intactas. A 0002 cria as 11 tabelas do M5 e a 0003 instala a função/trigger da fila. O histórico é gerenciado por Drizzle e não deve ser editado para forçar uma aplicação. `schema.ts` exporta os modelos de `schema/`; o ponto de entrada do gerador já carrega esses arquivos. Triggers e funções SQL permanecem em migration customizada versionada.

Ao introduzir modelos aprovados, declare-os em arquivos de schema por funcionalidade e ajuste o glob em `drizzle.config.ts` quando necessário. Gere SQL com `bun run db:generate --name=descricao`, revise-o e execute `bun run db:migrate`. Novas migrações entram no Git junto com os snapshots e o journal. Não reescreva migrações já aplicadas nem use `push` para contornar revisão.

`bun run db:migrate:test` aplica o mesmo histórico exclusivamente ao banco de testes. Os comandos locais recusam modo produção, hosts remotos, bancos/usuários fora do alvo e parâmetros de conexão que possam redirecionar o destino. `TEST_DATABASE_URL` nunca usa `DATABASE_URL` como fallback. Erros de validação não imprimem a URL nem credenciais. Esses comandos não são um mecanismo de deploy para produção.

## Seeds e fixtures

Cada tarefa de seed declara um `id` e `run(transaction)`. Registre em `developmentSeeds` somente dados determinísticos e fictícios compatíveis com os modelos já existentes. Faça upsert por chaves estáveis para que executar duas vezes produza o mesmo estado, sem duplicatas. Evite aleatoriedade não controlada e datas variáveis em testes.

`runSeeds` rejeita IDs vazios/duplicados e executa o lote inteiro numa transação: se uma tarefa falha, o lote é revertido. Não há truncamento de tabelas, reset automático ou bypass das validações do domínio. Quando os módulos existirem, criação de dados que exija regras de negócio deverá passar por suas operações autorizadas.

O registro deve apenas listar tarefas importadas: implemente suas operações em arquivos separados de seed, que também entram na cobertura. O registro de produto permanece vazio: assets, curva de níveis e política de recompensas ainda não foram configurados. `db:seed` informa isso explicitamente; as fixtures de teste não são adicionadas ao registro.

Os testes de integração criam um schema exclusivo com identificador aleatório, registram duas linhas fictícias determinísticas, verificam repetição sem duplicação e rollback e removem seu próprio schema ao terminar. Assim não dependem de dados do desenvolvedor e podem coexistir sem apagar tabelas alheias. O nome aleatório isola o espaço de teste; o conteúdo das fixtures é fixo.

## Verificação

A suíte do M5 aplica migrations no banco de testes, verifica restrições e exclusão/anonimização, entrega de NOTIFY após commit, ausência de aviso em rollback, persistência sem listener e dois consumidores reais com SKIP LOCKED. O comportamento do worker ainda não existe; essas regressões validam a base SQL, não um serviço de filas completo.

```sh
bun run test:database
bun run test:coverage
bun run check
```

`test:database` sobe apenas o serviço de testes, espera o healthcheck e mede cobertura da infraestrutura de conexão, seleção de destino, migração e seed. `test:coverage` inclui essa suíte e `check` a exige; portanto a verificação completa e o CI precisam de Docker/Compose. Unitários do motor e testes DOM continuam executáveis separadamente sem banco.

A base de testes fica disponível após a execução; pare-a com `db:test:down` quando terminar. Não se interrompe uma instância compartilhada automaticamente. Configurações, CLI e o registro de seeds são infraestrutura fora da métrica de produto; os módulos executáveis de conexão, migração e seed são inventariados e exigem o mínimo de 80% como os demais arquivos medidos.

## Modelos do setup M5

| Tabela | Dados e invariantes |
| --- | --- |
| `accounts` | UUID, login canônico único (`[a-z0-9_]{3,32}`), hash PHC Argon2id, estado e criação. Sem e-mail, documento, nome civil ou senha reversível. Formato do hash não comprova seus parâmetros. |
| `sessions` | Conta, hash SHA-256 hexadecimal de futuro token aleatório, criação, expiração e revogação. Hash único; a validação SQL de formato não substitui geração/validação criptográfica na aplicação. |
| `profiles` | Apelido público e FKs opcionais para avatar, baralho e mesa. `NULL` significa escolha padrão a resolver na aplicação; nenhum catálogo artificial é criado. |
| `avatars` | ID estável, nome, `avatar_url` relativo a `/art/`, nível mínimo, disponibilidade e ordenação. Sem upload ou host externo. A existência do asset e eventuais recortes do atlas serão validados na configuração do catálogo. |
| `deck_themes`, `table_themes` | Catálogos distintos com chave de asset confiável, nível mínimo, disponibilidade e ordenação. Nunca CSS/JavaScript ou URL enviada por jogador. |
| `player_progress` | XP e pontos competitivos acumulados, não negativos, em `bigint`. Nível é derivado da curva futura; não há coluna `level`. Não converter para `number` sem limite seguro; DTO futuro deve definir serialização. |
| `match_results` | Resumo autoritativo por ID de partida, preset, formato, treino, placar, motivo, vencedor, contagens públicas, tempos e versão da política. Sem cartas ou snapshots. |
| `match_participants` | Assento e conta opcional por partida; duplicar conta/assento é proibido. Contexto validado por FK composta. Conta ausente atende convidados/bot e anonimização. Equipe deriva da paridade do assento. |
| `match_rewards` | Uma concessão por participante, XP/pontos e data. FK composta preserva preset/treino; pontos positivos exigem competitivo e não-solo. Vencedor, valor, conta elegível e totalização ainda serão validados pela aplicação. |
| `jobs` | Trabalho `match_rewards` vinculado a resultado, único por tipo/partida. Sem payload JSON, dados de jogador ou credenciais. |

Não há recuperação de conta, política de senha, curva de XP, regra anticolusão, concessão de recompensas ou validação de desbloqueios implementada por estas tabelas. A aplicação é a autoridade; constraints são defesa adicional, não autorização para SQL direto de jogadores. Seleções cosméticas precisarão validar XP/nível e disponibilidade no servidor e preservar o tema do dono nas projeções, sem identificar cartas ocultas.

## Fila de resultados PostgreSQL

Não requer extensão nem configuração global: PostgreSQL 18 já fornece LISTEN/NOTIFY e SKIP LOCKED. A migration 0003 instala trigger `jobs_notify_ready` e função `app.notify_jobs_ready()` com search_path fixo, invoker e EXECUTE revogado de PUBLIC. O canal `truco_jobs_ready` carrega somente string vazia, inclusive em reagendamento; notificações podem ser coalescidas. O consumidor deve drenar a tabela, nunca contar notificações como jobs.

O setup fornece estados `pending`, `running`, `completed`, `failed`, `run_at`, tentativas, limite, prazo/token de reserva, término e código de erro restrito. Default de cinco tentativas e teto técnico de cem são parâmetros reversíveis do setup, não política de recompensa. Índices parciais atendem busca por pendência, reserva expirada e limpeza terminal.

Contrato do worker a implementar:

1. Criar resultado e job em uma transação confiável; rollback não salva nem notifica. Nunca aceitar resultado/recompensa como autoridade do cliente.
2. Escutar por conexão dedicada (ou session pooling); LISTEN não pode depender de transaction pooling. Confirmar a inscrição antes de consultar pendências ao iniciar/reconectar. Fazer polling de segurança mesmo sem notificação.
3. Selecionar lote pequeno de jobs vencidos, `ORDER BY run_at, id FOR UPDATE SKIP LOCKED`, sem manter transação durante espera externa. Esta fila não garante ordem global entre consumidores.
4. Para recompensas só em PostgreSQL, aplicar concessões, incrementos atômicos dos totais e conclusão do job na mesma transação curta. Unicidade impede repetição; atualizar várias contas em ordem estável evita deadlocks desnecessários.
5. Se houver trabalho fora da transação, reservar com token/prazo, confirmar reserva antes de executar e exigir o mesmo token ao concluir. Recuperar reservas expiradas, reagendar com espera crescente, limitar tentativas e inspecionar `failed`. Leases não dispensam idempotência de efeitos.
6. Limitar workers/conexões/lotes e monitorar espera, idade das pendências, falhas, locks e crescimento da tabela. Limpeza, autovacuum e capacidade precisam ser medidos antes de considerar particionamento.

O consumidor, polling, recuperação, limpeza e métricas não fazem parte deste incremento. A fila de comandos/timers por sala permanece em memória. Um resultado só é durável após commit; queda antes disso continua sendo limitação do estado vivo atual.

## Acesso, retenção e exclusão

Somente o backend acessará as tabelas; frontend recebe DTOs por allowlist. O ambiente local mantém a role proprietária anterior, sem alegação de privilégio mínimo de produção. No deploy, separar credencial de migração/DDL e roles de runtime, restringir catálogos/credenciais/resultados por responsabilidade, usar TLS validado e comprovar criptografia de banco/backups em repouso. Nunca publicar as tabelas diretamente como API.

Baseline técnico proposto para os próximos incrementos, sem coleta real nem rotina de limpeza neste setup:

- Conta/perfil/progresso: até solicitação de exclusão; perfil, progresso e sessões são removidos em cascata. O login não é publicado no ranking, somente o apelido.
- Sessões: revogação/expiração pela aplicação; remover registros vencidos ou revogados em até 24 h. Tokens utilizáveis nunca são persistidos.
- Resultados, participantes e recompensas: 90 dias; excluir resultado remove filhos/jobs. Exclusão da conta remove o vínculo do participante (`SET NULL`), preservando somente resumo sem apelido/credencial; outros registros operacionais precisam de revisão no fluxo de exclusão.
- Jobs concluídos: 7 dias; falhos: até 30 dias para diagnóstico com código seguro. Pendências/reservas não são descartadas por idade nem junto de um resultado ainda não processado; alertar e resolver antes da limpeza.

Os prazos são hipóteses reversíveis de minimização e precisam ser operacionalizados antes de ativar persistência real. Após expirar o histórico, os totais de longo prazo permanecem em `player_progress`; não se promete reconstruí-los integralmente a partir de um ledger com retenção finita. A exclusão em backups precisa acompanhar a política do ambiente e não equivale a DELETE imediato em cópias existentes.

Em worktrees, isolar `COMPOSE_PROJECT_NAME`, portas e URLs num `.env` ignorado, sem reutilizar volumes/banco do checkout principal. O banco de testes continua exclusivamente `truco_test`, role `truco_test`, host loopback e armazenamento temporário. Não aplicar migrations novas no banco de desenvolvimento compartilhado sem solicitação.

Referências: [NOTIFY](https://www.postgresql.org/docs/18/sql-notify.html), [LISTEN](https://www.postgresql.org/docs/18/sql-listen.html), [SKIP LOCKED](https://www.postgresql.org/docs/18/sql-select.html).
