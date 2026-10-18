# ADR 004 — PostgreSQL local e infraestrutura de seeds

- Estado: aceita conforme solicitação do proprietário.
- Data: 2026-10-18.

## Decisão

Preparar PostgreSQL 18.6 Alpine via Compose, com desenvolvimento persistente e testes em outra instância, usuário, banco e porta, com tmpfs. Ambos usam loopback e healthcheck. Usar Drizzle ORM 0.45.4 e Kit 0.31.11, versões estáveis atuais, com SQL nativo de Bun.

Manter migrações e ferramentas locais no backend, sem acoplar o core ao banco ou criar modelos de produto. A primeira migração cria somente o namespace app. Seeds recebem tarefas explícitas, IDs únicos e transação; tarefas devem usar chaves estáveis/upsert. O registro de desenvolvimento permanece vazio até os modelos serem definidos. Testes criam e removem schemas próprios com fixtures fictícias.

Ferramentas locais recusam produção e destinos fora dos bancos/roles locais designados. Testes nunca fazem fallback para DATABASE_URL. Não criar reset destrutivo ou truncamento do banco de desenvolvimento.

## Consequências

A verificação completa inclui integração real PostgreSQL e cobertura mínima, exigindo Docker/Compose no desenvolvimento e CI. Testes do motor continuam independentes. A base de testes é compartilhável com isolamento por schema; não se encerra automaticamente serviço que possa estar em uso. CI remoto permanece não verificado até publicação.
