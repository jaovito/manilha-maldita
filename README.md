# Truco Caótico

Base de um jogo de Truco Paulista com poderes para navegador. O projeto usa Bun Workspaces, TypeScript e um backend autoritativo organizado em módulos.

M1 e M2 implementados: motor puro testado e partidas multiplayer 1v1/2v2 com salas privadas, convidados, lobby, apostas, onze, timers, reconexão e revanche. A aplicação tem entrada, lobby e mesa responsiva com direção visual pixel art: feltro, madeira, molduras douradas, retratos e cartas de pergaminho. Poderes entram no M3; áudio e playtests do M4 continuam pendentes. A apresentação conceitual continua em `index.html`, na raiz; a aplicação web é um workspace separado.

Os [assets gerados e seus prompts](apps/web/public/art/README.md) ficam no próprio projeto. A fonte Pixelify Sans é local e acompanha sua licença OFL. Imagens são decorativas; cartas, ações e placares continuam derivados do estado autorizado pelo servidor.

O menu reproduz a composição da referência fornecida, com seis ações numa coluna, logo à esquerda e perfil à direita. O perfil tem apelido editável, criação de sala e entrada por código/link. Jogar, Como jogar, Cosméticos, Configurações e Sair ficam desabilitados e descritos como “Em breve”. Nível/moedas mostram indisponibilidade, sem saldo ou progresso fictício. O lobby reúne configurações, convite com cópia do link e equipes com assentos alternados. A prévia de poderes também permanece desabilitada até o M3; a carta Espião ilustrada no menu é decorativa.

Durante a partida, a mesa ocupa o viewport inteiro, sem rolagem da página. Placar, mão, vira, jogadores e ações se reorganizam conforme largura, altura e orientação; o menu “Sala” reúne os dados do lobby e abre ao terminar para oferecer revanche e saída. Histórico e painel da sala podem rolar internamente.

## Requisitos

- Bun **1.4.3**, fixado em `.bun-version` e `packageManager`.
- Biome reúne lint e formatação; `bun run check:architecture` verifica as fronteiras específicas do projeto.

As dependências diretas têm versões exatas e são reproduzidas pelo único `bun.lock`. As dependências diretas usam as versões estáveis mais recentes publicadas na revisão de 17/10/2026. Atualizações devem passar pelos mesmos checks. Bun 1.4.3 também foi validado instalando os browsers Playwright em um cache vazio, sem a antiga exceção de Node.

```sh
bun install --frozen-lockfile
bun run dev
```

`dev` inicia o backend Bun/Hono em `http://127.0.0.1:3001` e o frontend Vite em `http://127.0.0.1:5173`. Abra o endereço do frontend, informe um apelido, crie a sala e compartilhe o link/código. O apelido fica salvo neste navegador para preencher o campo após recarregar; apagar o campo remove essa preferência. Isso não salva a sessão nem permite recuperar salas após reiniciar o servidor. No lobby, escolha formato/preset, assentos livres e pronto; o anfitrião inicia quando todos estiverem prontos e conectados.

O início exige dois jogadores no 1v1 ou quatro no 2v2, todos conectados e com “Estou pronto” confirmado. Somente o anfitrião inicia. O lobby mostra explicitamente os jogadores/confirmações pendentes e quem precisa reconectar.

Para testar 1v1 ou 2v2 na mesma máquina, use sessões/perfis de navegador distintos. Abas da mesma sessão controlam o mesmo assento: a conexão nova substitui a anterior. Recarregar a página com o link da sala retoma o assento pelo cookie, sem enviar tokens pela URL. Ao fim, o anfitrião abre a revanche; todos confirmam pronto novamente.

O servidor não depende do PostgreSQL para jogar. `bun run dev:server` e `bun run dev:web` iniciam as partes separadamente. `bun run start:server` executa o backend sem watch. O proxy `/api` do Vite/preview mantém HTTP e WebSocket na origem do frontend. Use `/health` na porta 3001 para verificar o processo.

## Estrutura

```text
apps/
  web/                 # React/Vite; lobby, mesa DOM e transporte
  server/              # Hono/Bun; autoridade de salas, clocks e transporte
packages/
  game-core/           # motor puro completo de regras-base, apostas e projeções
  game-protocol/       # schemas Zod dos comandos, snapshots e configurações
tooling/
  architecture/        # regras de importação entre áreas, com parser Oxc
  tests/               # regressões das configurações e do grafo de workspaces
tests/e2e/             # smoke test do HTML servido pelo build
```

Cada workspace declara suas dependências. `game-core` expõe as entradas `./cards`, `./deal`, `./tricks`, `./hands`, `./betting`, `./match` e `./projections` para composição interna do motor; estado privado e identidades físicas não são DTOs de transporte. `game-protocol` expõe somente os schemas/tipos públicos pela entrada raiz; o frontend não importa o core. PixiJS e `game-sim` entram quando o incremento precisar deles.

## Banco de desenvolvimento e testes

PostgreSQL 18.6 via Docker Compose, com instâncias e credenciais locais distintas para desenvolvimento e testes. Desenvolvimento usa volume persistente; testes usam armazenamento temporário.

```sh
bun run db:up
bun run db:migrate
bun run db:seed
bun run test:database
```

Os comandos têm defaults locais e `.env.example` para personalização. O registro de seeds de produto está inicialmente vazio; os testes possuem suas próprias fixtures determinísticas, com repetição e rollback verificados. Não há modelos de produto inventados neste bootstrap. Veja portas, segurança dos destinos e como criar novas migrações/seeds em [docs/database.md](docs/database.md).

A verificação completa (`bun run check`) agora requer Docker/Compose para a suíte de banco real. Pare os serviços quando necessário com `bun run db:down` e `bun run db:test:down`; o volume de desenvolvimento é preservado.

## Comandos

| Comando                    | Finalidade                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| `bun run dev`              | Backend e frontend locais, executados com Bun                                            |
| `bun run build`            | Build do cliente React; backend executa TypeScript com Bun               |
| `bun run lint`             | Biome, hooks e fronteiras de importação                                 |
| `bun run format:check`     | Verificação de formatação                                                |
| `bun run format`           | Formatação dos arquivos de implementação/configuração                    |
| `bun run typecheck`        | TypeScript estrito por ambiente e ferramentas                            |
| `bun run test`             | Testes unitários de tooling e testes de React/DOM em processos separados |
| `bun run test:coverage` | Testes com mínimo de 80% e inventário de fontes sem cobertura |
| `bun run test:integration` | HTTP/WS reais, autenticação, partidas e reconexão em porta efêmera                         |
| `bun run test:e2e:install` | Instala Chromium para Playwright, com Bun                               |
| `bun run test:e2e`         | Partidas 1v1/2v2, reconexão e revanche em Chromium desktop/mobile                     |
| `bun run check`            | Lint, formato, tipos, testes com cobertura e build           |

E2E é separado de `check` e requer o navegador instalado. Os testes mobile usam emulação de dispositivo em Chromium; não comprova compatibilidade com Safari/iOS. Os scripts de testes não usam opção para aceitar ausência de testes.

O Biome cobre os formatos que suporta; Markdown e YAML não recebem formatação automática por esta configuração. A apresentação `index.html` da raiz está excluída para preservar o artefato existente.

## Zed

A configuração em `.zed/settings.json`, baseada no setup de `~/www/betzou`, ativa o Biome para JavaScript/JSX, TypeScript/TSX, JSON/JSONC, CSS e HTML, com formatação ao salvar. ESLint fica desativado neste projeto; os demais servidores de linguagem continuam disponíveis para tipos e navegação.

A extensão Biome já está instalada neste ambiente. Ela encontra a versão local declarada no `package.json` e usa o `biome.json` da raiz, obrigatório por configuração. Ao abrir este repositório em outro computador, instale a extensão Biome no Zed e execute `bun install --frozen-lockfile`.

## Cobertura

`bun run test:coverage` exige pelo menos **80% de linhas e funções por arquivo medido** em unitários, DOM e integração. Também detecta fontes executáveis sem relatório, sem aceitar que um arquivo não importado desapareça da conta. Relatórios textuais e LCOV ficam em `coverage/{server,web,database}`.

`bun run check` já inclui essa exigência, assim como o CI. A meta é um mínimo; todos os cenários críticos continuam obrigatórios. A cobertura inclui o motor de regras-base e suas projeções, além do tooling e da infraestrutura. Veja a política e as exclusões em [docs/testing.md](docs/testing.md).

## Organização dos testes

- Importe `test` e `expect` de `bun:test`; fast-check está disponível para propriedades.
- Unitários do domínio ficam junto ao comportamento em `packages/*/src/**/*.test.ts`. Tipos de produção dos pacotes puros excluem Bun e DOM. O `tsconfig.test.json` já inclui `types: ["bun"]` para esses testes, mantendo o ambiente de produção isolado.
- Componentes podem ter testes em `apps/web/src/**/*.test.tsx`. O workspace web configura Happy DOM e limpeza entre testes; execute com `bun run test:dom` para carregar esse ambiente sem contaminar os testes de servidor.
- Integração de transporte fica em `apps/server/tests/integration`. Além da fixture do runtime, exercita o servidor do produto com sessões e WebSockets independentes.
- Playwright usa `*.e2e.ts` para evitar descoberta pelo runner do Bun. Seu servidor de teste é iniciado e encerrado pelo próprio Playwright.
- Os arquivos `environment.typecheck.ts` são verificações negativas de tipos; não são código da aplicação nem testes executados em runtime.

Os testes de domínio exercitam partidas completas 1v1/2v2, cartas, apostas, onze, pontuação e privacidade; execute `bun test packages/game-core` durante esse desenvolvimento. Os testes PostgreSQL exercitam infraestrutura de persistência. Integração agora conclui partidas no servidor com múltiplos WebSockets reais; Playwright conclui partidas no cliente com contextos de navegador isolados.

## Documentação

Comece por [AGENTS.md](AGENTS.md). Consulte [arquitetura](docs/architecture.md), [regras](docs/rules.md), [segurança](docs/security.md), [testes](docs/testing.md) e [plano](plan.md) conforme a tarefa.

## Motor do M1

A entrada interna `@truco/game-core/match` expõe `startMatch`, `executeCommand` e `dealNextHand`. A aplicação confiável fornece assento autenticado, revisão esperada, iniciador e escolhas de embaralhamento; o cliente nunca controla esses dados de autoridade. Cada transição aceita retorna estado e eventos públicos sem cartas privadas. Rejeições não alteram o estado, e revisões antigas são recusadas antes de qualquer efeito.

Uma mão encerrada permanece em `HAND_END` até o adaptador distribuir outra. `MATCH_END` bloqueia comandos e novas distribuições. `projectPublicView` e `projectPlayerView` são as únicas visões para apresentação; nunca envie o estado interno. Cartas cobertas continuam ocultas para terceiros após o fim da mão/partida. Onze compartilha cartas somente com a equipe autorizada; 11×11 mantém apenas a mão própria.

O M2 usa essas regras-base nas salas privadas e oferece mesa simples no navegador. Poderes e preparação selada entram no M3; não há um preset clássico adicional. A aplicação coordena filas por sala, sessões, ACKs, timers e reconexão. Não há recuperação de partidas após queda do processo.

## Operação local do M2

`.env.example` inclui `HOST`, `PORT`, `ALLOWED_ORIGINS` (lista separada por vírgula, sem wildcard) e `SECURE_COOKIES`. O servidor escuta por padrão em 127.0.0.1:3001 e permite as origens HTTP `127.0.0.1` e `localhost` nas portas 5173/4173/3001. Uma lista explícita em `ALLOWED_ORIGINS` substitui esses defaults; inclua o endereço usado no navegador e reinicie o backend ao alterar a variável. Use o mesmo endereço durante a sessão: cookies de `localhost` e `127.0.0.1` são independentes. O cookie é HttpOnly, SameSite=Strict, válido por 24 horas e restrito a `/api`; em hospedagem com HTTPS configure `SECURE_COOKIES=true` e origens exatas. Não foi realizado deploy/provisionamento.

O estado vivo é exclusivamente em memória: reiniciar o processo perde sessões e salas e é falha técnica, sem atribuir derrota por abandono. Reconexão protege somente ausências durante a vida do processo, com 60 s cumulativos no casual e 30 s no competitivo. Se um parceiro pode responder, a decisão de equipe continua. Esgotada a proteção, volta o tempo restante; carta sem timer, quando o ausente não tem mais proteção, recebe fallback em vez de bloquear a sala.

As salas vazias expiram após 60 s no casual/30 s no competitivo. Limites atuais: 256 salas, três salas por sessão, 64 comandos pendentes por sala e 512 respostas de deduplicação recentes por sala. Veja as regras de transporte, recursos e idempotência na [arquitetura](docs/architecture.md) e na [ADR 006](docs/adr/006-room-authority-and-reconnection.md). O backend não grava payloads, cartas ou tokens em logs.
