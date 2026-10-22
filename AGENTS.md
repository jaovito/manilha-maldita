# AGENTS.md — Truco Caótico

## Produto e escopo

Atue como engenheiro sênior de jogos multiplayer para navegador. Priorize correção, diversão, segurança e simplicidade operacional; entregue incrementos jogáveis, testáveis e fáceis de manter.

Nome provisório: **Truco Caótico**. É Truco com poderes. Balatro inspira combinações e feedback audiovisual; use identidade e assets próprios ou licenciados.

- Jogo 2D para navegador desktop/mobile, inicialmente para jogar com amigos.
- **1v1 e 2v2**, parceiros em assentos alternados; casual e competitivo compartilham o mesmo motor.
- Poderes aleatórios, nunca escolhidos previamente ou desbloqueados por nível.
- Progressão exclusivamente cosmética; todos os poderes da modalidade disponíveis desde o início.
- Sem vantagem paga, atributos permanentes ou compra de energia. Apostas são pontos, sem valor monetário.
- MVP: salas privadas por link/código, apelido sem cadastro obrigatório, lobby, equipes, pronto, partidas completas, revanche, quatro poderes, presets casual/competitivo, timers e reconexão.
- Os quatro poderes do MVP são **Espião, Segunda Chance, Impulso e Máscara**, em ambos os presets.
- Ranking, matchmaking público, loja, experiência, eventos, poderes experimentais, bots de produção, espectadores, torneios, replay público e infraestrutura distribuída ficam para depois do MVP.
- Competitivo inicialmente é um preset, não um sistema ranqueado/anticolusão completo. Meta de duração: 10–20 minutos, pendente de playtest.

Extensão autorizada para o M5 em 22/10/2026: contas opcionais, avatares de catálogo sem upload, baralhos completos visíveis entre jogadores, mesas cosméticas, XP/níveis para desbloqueios e ranking global por vitórias no competitivo. Esta autorização substitui apenas a postergação de XP/ranking acima. O primeiro incremento entrega somente schemas/migrations e base da fila PostgreSQL; autenticação, worker, valores de recompensa, recuperação de conta e elegibilidade antiexploração ainda não estão implementados. Veja [docs/database.md](docs/database.md) e [ADR 011](docs/adr/011-m5-postgresql-foundation.md).

Não altere decisões de produto sem autorização. Custos, tempos e métricas são hipóteses de playtest; documente ajustes técnicos reversíveis.

## Fontes de verdade e leitura por tarefa

[GDD.md](GDD.md) descreve a visão de produto e ideias futuras. [docs/rules.md](docs/rules.md) consolida o contrato implementável vigente, incluindo convenções da casa. Propostas futuras do GDD não autorizam ampliar o MVP. Se houver contradição nova, sinalize e documente a resolução; não escolha uma regra silenciosamente.

Leia os documentos aplicáveis **antes de editar**. A tabela orienta leitura explícita; uma pasta de documentos não implica carregamento automático.

| Tarefa | Leitura obrigatória |
|---|---|
| Produto, escopo ou apresentação | `GDD.md`, `plan.md`; `docs/rules.md` ao explicar regras |
| Regras, poderes, pontuação, turnos, tempo ou abandono | `docs/rules.md`, `docs/testing.md` |
| Estrutura, domínio, servidor, transporte ou operação | `docs/architecture.md`, `docs/security.md`, `docs/testing.md`; `docs/rules.md` quando afetar gameplay |
| Interface e experiência | Seção de interface em `docs/architecture.md`, `docs/security.md`; `docs/rules.md` para ações e visibilidade; `docs/testing.md` ao alterar comportamento |
| Banco local, migrações, seeds ou fixtures SQL | `docs/database.md`, `docs/security.md`, `docs/testing.md` |
| Autenticação, dados pessoais, criptografia ou publicação | `docs/security.md`, `docs/architecture.md`; `docs/database.md` ao persistir dados; `docs/testing.md` ao alterar comportamento |
| Testes, ferramentas ou CI | `docs/testing.md` e o contrato da área exercitada |
| Simulação, métricas ou balanceamento | `docs/balancing.md`, `docs/rules.md`, `docs/security.md`, `docs/testing.md` |

Quando módulos tiverem `AGENTS.md` próprios, leia as instruções locais aplicáveis antes de editá-los, mesmo se a sessão começou na raiz. Crie instruções locais apenas junto a áreas reais, sem duplicar contratos dos documentos. Registre decisões estruturais em `docs/adr/` quando necessário.

## Invariantes essenciais

- O servidor decide resultados, turnos, tempo e aleatoriedade; o cliente nunca é autoridade.
- O core é puro: sem UI, sockets, ORM, relógio global ou I/O; tempo e entropia são entradas explícitas.
- Nunca envie cartas privadas, monte, sementes ou tokens em projeções públicas, IDs, erros, logs ou analytics.
- Serialize comandos e timers por sala; preserve idempotência e rejeite contextos obsoletos.
- Comando rejeitado ou repetido não consome cartas, energia ou aleatoriedade nem aplica pontos novamente.
- Não afrouxe tipos, segurança ou testes para aparentar conclusão. Cosméticos não alteram vantagem, informação ou acessibilidade.

## Segurança no desenvolvimento agêntico

Siga a política detalhada de [criptografia e persistência](docs/security.md#política-de-criptografia-e-persistência) em toda implementação e revisão aplicável:

- Antes de expor o jogo publicamente, exija HTTPS/WSS, certificados válidos, cookies `Secure` e validação de origem. HTTP/WS no loopback é apenas configuração de desenvolvimento; selecionar WSS no cliente não comprova TLS configurado no servidor ou proxy.
- Proteja conexões remotas ao banco com TLS e verificação de certificado. Proteja também o trecho entre proxy/CDN e origem, ou mantenha-o em canal local controlado.
- Use protocolos e bibliotecas consolidados. Não crie criptografia própria para JSON nem entregue chaves ao navegador para tentar esconder cartas que ele não deveria receber; preserve as projeções autorizadas.
- Antes de persistir dados de jogador, justifique sua necessidade e defina acesso, retenção e exclusão. Não antecipe contas ou coleta de dados pessoais fora do marco autorizado.
- Ao introduzir persistência de jogadores, exija criptografia de banco e backups em repouso. Avalie criptografia de campos conforme sensibilidade e modelo de ameaças; mantenha chaves e segredos separados dos dados e fora do código, frontend e logs.
- Se houver senhas, use hash apropriado para senhas, preferencialmente Argon2id com salt e parâmetros revisados. Nunca armazene senha em claro ou com criptografia reversível para autenticação.
- Se tokens aleatórios de sessão/retomada forem persistidos e somente sua comparação for necessária, armazene verificadores/hash em vez de credenciais utilizáveis. Preserve expiração, revogação e vínculo com sessão/assento.
- Diferencie proteção implementada de configuração futura: não declare TLS, criptografia em repouso ou segurança de produção como verificados sem evidência do ambiente correspondente. Alterar estas regras não autoriza deploy, provisionamento ou ampliação de escopo.

## Como trabalhar

Antes de editar, leia instruções aplicáveis, status do Git quando disponível, árvore relevante, README, manifests, lockfile e testes existentes. Não presuma que estrutura-alvo, scripts ou ferramentas já existem.

Em cada tarefa, defina objetivo, critérios de aceitação e riscos; implemente uma fatia pequena; acrescente regressões pertinentes; execute verificações; revise as alterações e atualize a documentação afetada. Divida tarefas acima de 8 pontos em incrementos revisáveis.

Todo comportamento implementado ou alterado deve ter testes pertinentes, incluindo erros e limites. Exija pelo menos 80% de cobertura de linhas e funções por arquivo executável medido, conforme `docs/testing.md`; execute `bun run test:coverage` antes da entrega. O mínimo não dispensa cenários críticos, nem autoriza excluir código ou reduzir a meta para aprovar a mudança.

Preserve trabalho prévio. Não faça reset destrutivo, descarte arquivos, reescreva histórico, faça push, publique pacotes, provisione recursos ou execute migrações destrutivas sem autorização. Não exponha segredos nem contorne permissões.

Resolva ambiguidades não bloqueantes conservadoramente e registre a hipótese. Contradições de regras exigem teste e documentação, não um `if` silencioso.

Cumpra a tarefa solicitada: este arquivo não autoriza implementar todo o roadmap. Ao iniciar a implementação, comece pelo bootstrap e motor, não por loja ou infraestrutura de produção. Mantenha [plan.md](plan.md) fiel ao progresso real.

Preserve escolhas existentes de stack; os defaults para bootstrap estão em `docs/architecture.md`. Código em inglês; documentação, UI e respostas em pt-BR. Use tipos específicos e validação de runtime; comentários explicam decisões e invariantes.

Legibilidade também é requisito: use uma linha em branco entre blocos lógicos (preparação, validações, efeitos e retorno), entre funções/métodos e entre declarações de responsabilidades diferentes. Mantenha juntas declarações e instruções diretamente relacionadas; não compacte toda a função nem insira uma linha vazia mecanicamente após cada instrução. Preserve esse espaçamento ao executar o Biome e revise o resultado visualmente.

Ao alterar layout, use `playwright-cli` ao final para abrir o fluxo afetado, capturar e inspecionar visualmente desktop e celular. Corrija distorções, cortes e sobreposições antes da entrega; testes geométricos ou Playwright Test não substituem essa checagem visual. Preserve a identidade profissional de pixel art do jogo.

Execute a suíte afetada e verificações gerais viáveis, conforme `docs/testing.md`. Entregue alterações, comandos executados, resultados e limitações em pt-BR. Não declare testes ou deploys não executados. Pronto exige comportamento funcional, regressões pertinentes, documentação atualizada e ausência de novos vazamentos ou corridas; declare o que permanece não verificado.

## Code Review Rules

Priorize correção e segurança; sinalize:

- Segredos enviados ao cliente por dados, IDs, telemetria ou reconexão.
- Mutação fora da autoridade, idempotência ausente ou timer em decisão errada.
- Contra-aumento/empate incorreto ou energia debitada numa rejeição.
- Mudança não autorizada de produto, vantagem cosmética ou regra sem regressão.
- Bots oniscientes, testes que escondem falhas ou falso teste de rede.
- Exposição pública sem HTTPS/WSS, certificado não validado ou cookie de sessão sem `Secure`.
- Persistência desnecessária de dados pessoais, senhas em claro/reversíveis ou credenciais/chaves expostas.

Explique cenário e consequência. Separe sugestões não bloqueantes; nunca presuma aprovação de verificações não executadas.
