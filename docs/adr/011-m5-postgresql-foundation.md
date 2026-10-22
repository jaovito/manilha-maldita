# ADR 011 — Base de persistência do M5 e fila PostgreSQL

Data: 22/10/2026. Estado: aceita para o setup autorizado; integrações posteriores pendentes.

## Contexto

O proprietário autorizou contas opcionais, catálogo de avatares sem upload, baralhos e mesas cosméticos, desbloqueios por nível e ranking global por vitórias competitivas. Pediu incrementos pequenos para revisão, começando por tabelas, migrations e configuração da fila. PostgreSQL/Drizzle já existem; estado vivo e autoridade das salas ficam em memória.

## Decisão

- Criar 11 tabelas no namespace `app`, separadas por funcionalidade, com geração Drizzle e migration SQL customizada para notificações.
- Não integrar ainda autenticação, sessões persistidas, cosméticos, progressão ou jobs ao runtime. Não criar endpoints para escrever XP/pontos nem consumidores fictícios.
- Persistir XP/pontos como `bigint`; calcular nível no servidor, sem coluna independente ou inventário para desbloqueios exclusivamente por nível.
- Separar credenciais/perfil/progresso. Reservar apenas login canônico e hash Argon2id: e-mail/recuperação seguem sem decisão. A restrição PHC valida formato, não segurança criptográfica dos parâmetros.
- Referenciar estilos por chave de assets confiáveis; avatares têm caminho local `avatar_url`. Catálogos não recebem uploads, CSS, código ou URLs arbitrárias. Seeds ficam vazios até existir catálogo aprovado.
- Registrar somente resumo de resultado, participante/assento e recompensa. Não persistir mãos, sementes, tokens utilizáveis ou snapshots JSON. Uma conta só ocupa um assento por resultado; uma recompensa por participante implica uma por conta/partida.
- Repetir preset/formato/solo nas referências compostas evita forjar contexto para pontos competitivos. A aplicação ainda deverá validar vencedor, elegibilidade, valor e atualização atômica dos totais.
- Usar `app.jobs` como fila durável e outbox local, com FK para resultado, unicidade por resultado/tipo, índices de pendências e leases, limites de tentativas e estados coerentes. Não adicionar `pg_partman`, Redis nem broker.
- Trigger invoker com `search_path=pg_catalog`, sem EXECUTE público, emite apenas `pg_notify('truco_jobs_ready', '')` para INSERT/reagendamento pendente. NOTIFY é wake-up após commit; polling e recuperação pelo worker são obrigatórios no próximo incremento.

## Consequências

Resultado e job poderão ser gravados na mesma transação PostgreSQL; o job não depende da entrega da notificação. Workers usarão `FOR UPDATE SKIP LOCKED` e transações curtas. A entrega será repetível e efeitos devem ser idempotentes. Leases/tokens estão reservados para tarefas que precisem sair da transação; não prometem recuperação automática enquanto não houver worker.

Não é necessário alterar Compose ou parâmetros globais: LISTEN/NOTIFY e SKIP LOCKED são nativos. O futuro listener requer conexão dedicada/session pooling, não transaction pooling. Trabalho de login/Argon2 não pertence a esta fila nem deve persistir senhas. A fila atual por sala não muda.

As migrations são aditivas e não escrevem dados de jogadores. O ambiente local mantém seu modelo anterior de confiança (role local proprietária). Privilégios mínimos, TLS e criptografia em repouso de banco/backups exigem configuração e evidência do futuro ambiente; não são comprovados pelo schema. Retenção e fronteiras de segurança estão em `docs/database.md` e `docs/security.md`.

Recuperação de conta, valores de XP/pontos, curva de níveis, regras contra combinação de resultados e concessão a convidados/treino permanecem pendentes. Ausência de recuperação de estado vivo após queda continua válida: a fila só protege resultados depois do commit.
