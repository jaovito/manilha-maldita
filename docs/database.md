# Banco local, migrações e seeds

PostgreSQL 18.6 Alpine em Docker Compose. Drizzle ORM 0.45.4 e Drizzle Kit 0.31.11 são versões estáveis atuais; o driver é o SQL nativo de Bun. Isso prepara persistência futura sem colocar banco no caminho das jogadas ou criar modelos de produto antecipadamente.

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
    schema.ts             # namespace app; tabelas futuras por funcionalidade
    migrations/           # SQL versionado e metadados do Drizzle
    migrate.ts
    cli.ts
    seeds/
      run.ts              # executor transacional
      registry.ts         # seeds locais de produto, inicialmente vazio
  tests/database/         # guardas e integração real com PostgreSQL
```

A migração inicial cria apenas o namespace `app`. Não há tabelas de usuários, inventário ou partidas. O histórico de migrações é gerenciado por Drizzle e não deve ser editado para forçar uma aplicação.

Ao introduzir modelos aprovados, declare-os em arquivos de schema por funcionalidade e ajuste o glob em `drizzle.config.ts` quando necessário. Gere SQL com `bun run db:generate --name=descricao`, revise-o e execute `bun run db:migrate`. Novas migrações entram no Git junto com os snapshots e o journal. Não reescreva migrações já aplicadas nem use `push` para contornar revisão.

`bun run db:migrate:test` aplica o mesmo histórico exclusivamente ao banco de testes. Os comandos locais recusam modo produção, hosts remotos, bancos/usuários fora do alvo e parâmetros de conexão que possam redirecionar o destino. `TEST_DATABASE_URL` nunca usa `DATABASE_URL` como fallback. Erros de validação não imprimem a URL nem credenciais. Esses comandos não são um mecanismo de deploy para produção.

## Seeds e fixtures

Cada tarefa de seed declara um `id` e `run(transaction)`. Registre em `developmentSeeds` somente dados determinísticos e fictícios compatíveis com os modelos já existentes. Faça upsert por chaves estáveis para que executar duas vezes produza o mesmo estado, sem duplicatas. Evite aleatoriedade não controlada e datas variáveis em testes.

`runSeeds` rejeita IDs vazios/duplicados e executa o lote inteiro numa transação: se uma tarefa falha, o lote é revertido. Não há truncamento de tabelas, reset automático ou bypass das validações do domínio. Quando os módulos existirem, criação de dados que exija regras de negócio deverá passar por suas operações autorizadas.

O registro deve apenas listar tarefas importadas: implemente suas operações em arquivos separados de seed, que também entram na cobertura. O registro de produto está vazio porque os modelos ainda não foram definidos; `db:seed` informa isso explicitamente. As fixtures de teste não são adicionadas a esse registro.

Os testes de integração criam um schema exclusivo com identificador aleatório, registram duas linhas fictícias determinísticas, verificam repetição sem duplicação e rollback e removem seu próprio schema ao terminar. Assim não dependem de dados do desenvolvedor e podem coexistir sem apagar tabelas alheias. O nome aleatório isola o espaço de teste; o conteúdo das fixtures é fixo.

## Verificação

```sh
bun run test:database
bun run test:coverage
bun run check
```

`test:database` sobe apenas o serviço de testes, espera o healthcheck e mede cobertura da infraestrutura de conexão, seleção de destino, migração e seed. `test:coverage` inclui essa suíte e `check` a exige; portanto a verificação completa e o CI precisam de Docker/Compose. Unitários do motor e testes DOM continuam executáveis separadamente sem banco.

A base de testes fica disponível após a execução; pare-a com `db:test:down` quando terminar. Não se interrompe uma instância compartilhada automaticamente. Configurações, CLI e o registro de seeds são infraestrutura fora da métrica de produto; os módulos executáveis de conexão, migração e seed são inventariados e exigem o mínimo de 80% como os demais arquivos medidos.
