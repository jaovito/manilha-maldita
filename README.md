# Truco Caótico

Base de um jogo de Truco Paulista com poderes para navegador. O projeto usa Bun Workspaces, TypeScript e um backend autoritativo organizado em módulos.

M1, M2 e M3 implementados: motor puro testado e partidas multiplayer 1v1/2v2 com salas privadas, convidados, lobby, apostas, onze, timers, reconexão e revanche. A aplicação tem entrada, lobby e mesa responsiva com direção visual pixel art: feltro, madeira, molduras douradas, retratos e cartas de pergaminho. Energia, preparação selada e os quatro poderes funcionam nos dois presets. O M4 está em andamento, com animações, áudio e pausas para compreender resultados; revisão ampla de acessibilidade e playtests humanos continuam pendentes. A apresentação conceitual continua em `index.html`, na raiz; a aplicação web é um workspace separado.

Os [assets gerados e seus prompts](apps/web/public/art/README.md) ficam no próprio projeto. A fonte Pixelify Sans é local e acompanha sua licença OFL. Imagens são decorativas; cartas, ações e placares continuam derivados do estado autorizado pelo servidor.

No primeiro acesso sem apelido válido, uma tela de boas-vindas pede como seus amigos vão chamar você. Confirme por Enter ou Continuar; o apelido só fica salvo após essa confirmação. Um convite recebido permanece preenchido para entrar na sala. Apelido já salvo ou recuperado de uma sessão válida pula essa etapa; o perfil permite editar depois. Falha de armazenamento não impede continuar nesta visita.

Botões indisponíveis ficam com 25% de opacidade e sem brilho de hover. Passe o mouse ou toque para ver um tooltip com o motivo do bloqueio; permissões, jogadores pendentes, fase e turno têm explicações próprias. Cartas continuam legíveis enquanto jogar está bloqueado.

O menu reproduz a composição da referência fornecida, com seis ações numa coluna, logo à esquerda e perfil à direita. O perfil tem apelido editável, criação de sala e entrada por código/link. Jogar, Como jogar, Cosméticos, Configurações e Sair ficam desabilitados e descritos como “Em breve”. Nível/moedas mostram indisponibilidade, sem saldo ou progresso fictício. O lobby reúne configurações, convite com cópia do link e equipes com assentos alternados. O lobby permite consultar os quatro poderes; a carta Espião ilustrada no menu é decorativa.

Durante a partida, a mesa ocupa o viewport inteiro, sem rolagem da página. O status fica no topo, junto ao placar, e um selo “Sua vez” acompanha o avatar próprio apenas quando é possível jogar. As ações da direita são compactas; jogar uma carta é feito diretamente na mão. Faces e versos mantêm a proporção 2:3 na mão, nos assentos, na mesa e na vira, variando apenas o tamanho. Placar, mão, vira, jogadores e ações se reorganizam conforme largura, altura e orientação; o menu “Sala” oferece som e identificação da sala, sem configurações congeladas. O encerramento tem apresentação e menu próprios. Histórico e painel da sala podem rolar internamente.

A distribuição tem 0,9 s de apresentação com versos animados. Resultados de vaza ficam visíveis por 1,8 s; resultados de mão, por 2,4 s antes da próxima distribuição. A região do placar mostra temporariamente o resultado e sua explicação, preservando as cartas resolvidas na mesa; a carta vencedora recebe destaque. Ao continuar, o status informa quem abre a próxima vaza. Cada novo turno próprio também apresenta **SUA VEZ!** em uma faixa grande no centro por 2,4 s; ela desaparece ao jogar ou perder a vez e não bloqueia cliques, teclado ou o timer. Atualizações da sala e retomada da mesma jogada após negociação não repetem o anúncio. O servidor controla os intervalos entre resultados e só depois inicia o tempo de decisão. Reconectar não prolonga a apresentação.

Efeitos sonoros próprios acompanham cliques, menus, cartas, poderes confirmados, turno, distribuição e resultado. “Som” oferece volume e desligamento no menu/lobby e dentro de “Sala” durante a partida; começa após interação com a página. Preferências ficam no navegador, sem cartas ou snapshots. Movimento reduzido desativa carteado, chama animada das velas e efeitos de movimento; avisos textuais e o intervalo para ler resultados permanecem. O [roteiro de playtest do M4](docs/playtest-m4.md) registra o que ainda precisa de avaliação humana.

Vitória, derrota e empate têm sons diferentes para cada perspectiva. Ao resolver uma vaza ou mão, o centro informa “VOCÊ VENCEU!” / “VOCÊ PERDEU” no 1v1 e “SEU TIME VENCEU!” / “SEU TIME PERDEU” no 2v2. Ao concluir a partida, o resultado ocupa o centro da mesa por 5 s antes de mostrar ações. A vitória natural com 12 pontos destaca “VOCÊ VENCEU!!” ou “SEU TIME VENCEU!!”, com entrada animada e confetes quadrados nas cores do jogo. Depois aparece somente um menu de resultado com placar, motivo, Revanche, Voltar ao lobby e Sair da sala. Revanche e retorno ao lobby dependem do anfitrião e levam à confirmação de pronto de todos; nenhuma partida reinicia automaticamente. Configurações e convite só aparecem no lobby. Movimento reduzido conserva o resultado estático e oculta os confetes; reconexão e SYNC não repetem a celebração.

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

## URL do backend no frontend

Copie `apps/web/.env.example` para `apps/web/.env.local` e configure a origem pública do backend, sem `/api`:

```dotenv
VITE_BACKEND_URL=https://api.seu-dominio.com
```

A variável configura as requisições HTTP e o WebSocket (`https` → `wss`, `http` → `ws`). Vazia, mantém `/api` na origem atual e o proxy local. Reinicie o Vite após alterar; em hospedagem, configure no serviço do **frontend antes de executar `bun run build`** e gere um novo build. Variáveis `VITE_*` são públicas no bundle: não coloque credenciais nelas. O arquivo `.env.example` da raiz configura o backend/banco; o arquivo em `apps/web` configura o Vite.

No backend, inclua a origem exata do frontend em `ALLOWED_ORIGINS`; o CORS permite cookies somente para essa lista. A sessão mantém `SameSite=Strict`: para acesso direto, use o mesmo site nos dois serviços (por exemplo, `jogo.seu-dominio.com` e `api.seu-dominio.com`, ambos HTTPS). Se estiverem em sites diferentes, use um proxy `/api` na origem do frontend e deixe `VITE_BACKEND_URL` vazia. Configure `SECURE_COOKIES=true` no backend em HTTPS.

## Estrutura

```text
apps/
  web/                 # React/Vite; lobby, mesa DOM e transporte
  server/              # Hono/Bun; autoridade de salas, clocks e transporte
packages/
  game-core/           # motor puro completo de regras-base, apostas e projeções
  game-protocol/       # schemas Zod dos comandos, snapshots e configurações
  game-sim/            # simulações pareadas com políticas de visão limitada
tooling/
  architecture/        # regras de importação entre áreas, com parser Oxc
  tests/               # regressões das configurações e do grafo de workspaces
tests/e2e/             # smoke test do HTML servido pelo build
```

No frontend, `app` reúne montagem, `App/` e estilos globais; cada feature agrupa `components`, `pages` e utilitários conforme necessário. `pages` contém apenas páginas e seus testes; componentes e estilos de página ficam nas pastas `components` e `styles` da feature. Componentes usam pastas com `index.tsx`, testes e estilos próximos; filhos exclusivos, como `Lobby/Icon`, ficam no componente pai. O manifesto `app/styles/index.css` preserva a ordem da cascata. Veja a árvore e as responsabilidades na [arquitetura](docs/architecture.md#frontend-funcionalidades-e-separação-de-estados).

Cada workspace declara suas dependências. `game-core` expõe as entradas `./cards`, `./deal`, `./tricks`, `./hands`, `./betting`, `./match` e `./projections` para composição interna do motor; estado privado e identidades físicas não são DTOs de transporte. `game-protocol` expõe somente os schemas/tipos públicos pela entrada raiz; o frontend não importa o core. `game-sim` executa cenários sintéticos com o mesmo core; PixiJS continua previsto para quando necessário.

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

O M2 usa essas regras-base nas salas privadas e oferece mesa simples no navegador. Poderes e preparação selada foram acrescentados no M3; não há um preset clássico adicional. A aplicação coordena filas por sala, sessões, ACKs, timers e reconexão. Não há recuperação de partidas após queda do processo.

## Operação local do M2

`.env.example` inclui `HOST`, `PORT`, `ALLOWED_ORIGINS` (lista separada por vírgula, sem wildcard) e `SECURE_COOKIES`. O servidor escuta por padrão em 127.0.0.1:3001 e permite as origens HTTP `127.0.0.1` e `localhost` nas portas 5173/4173/3001. Uma lista explícita em `ALLOWED_ORIGINS` substitui esses defaults; inclua o endereço usado no navegador e reinicie o backend ao alterar a variável. Use o mesmo endereço durante a sessão: cookies de `localhost` e `127.0.0.1` são independentes. O cookie é HttpOnly, SameSite=Strict, válido por 24 horas e restrito a `/api`; em hospedagem com HTTPS configure `SECURE_COOKIES=true` e origens exatas. Não foi realizado deploy/provisionamento.

O estado vivo é exclusivamente em memória: reiniciar o processo perde sessões e salas e é falha técnica, sem atribuir derrota por abandono. Reconexão protege somente ausências durante a vida do processo, com 60 s cumulativos no casual e 30 s no competitivo. Se um parceiro pode responder, a decisão de equipe continua. Esgotada a proteção, volta o tempo restante; carta sem timer, quando o ausente não tem mais proteção, recebe fallback em vez de bloquear a sala.

As salas vazias expiram após 60 s no casual/30 s no competitivo. Limites atuais: 256 salas, três salas por sessão, 64 comandos pendentes por sala e 512 respostas de deduplicação recentes por sala. Veja as regras de transporte, recursos e idempotência na [arquitetura](docs/architecture.md) e na [ADR 006](docs/adr/006-room-authority-and-reconnection.md). O backend não grava payloads, cartas ou tokens em logs.

## Poderes e simulação (M3)

Toda mão comum começa em preparação selada, sem abrir um painel automaticamente: o poder aparece como uma carta ilustrada no canto da mesa. Clique no poder e depois diretamente em um verso adversário para Espião ou numa carta da sua mão para Segunda Chance; você também pode passar. O clique no alvo envia uma intenção; cartas e energia mudam quando todos responderem ou o prazo expirar. Na sua vez, clicar na carta de Impulso/Máscara seleciona o efeito; clicar novamente cancela. Depois escolha uma carta da mão: poder e jogada são enviados juntos. As cartas elegíveis são destacadas e uma orientação curta indica o próximo clique. Esc ou clicar novamente no poder cancela a seleção. Após o servidor confirmar o uso, a carta de poder desaparece até a próxima mão; a reserva de energia e o resultado privado do Espião continuam visíveis. Os detalhes abrem por clique, fecham pelo botão ou Esc e mostram poderes revelados/ativações; poderes não usados de outros assentos aparecem como “Poder oculto”, inclusive os do parceiro. A face observada pelo Espião aparece na mão adversária somente para quem o usou; depois de uma jogada do alvo, permanece como memória da preparação até a mesma carta ser revelada numa jogada ou a mão ficar vazia, sem rastrear cartas ocultas. No celular, detalhes permitem rolagem interna. A carta mascarada é distinta de coberta e só revela sua identidade aos demais ao resolver a vaza.

Energia inicial 2, teto 3 e regeneração +1 por mão comum após a primeira. Cada jogador tem no máximo um uso por mão. Onze/decisiva não sorteiam poderes nem regeneram energia. Casual permite ajustar a preparação (default 15 s); competitivo fixa 10 s. O catálogo e custos estão em [docs/rules.md](docs/rules.md).

```sh
bun run simulate 30        # 30 cenários por estrato, com/sem poderes e troca de assentos
bun run simulate 100 1234  # tamanho e seed sintética local de reprodução
```

A ferramenta produz JSON agregado por formato, preset e política conservadora/agressiva/probabilística, com incerteza aproximada e contagens separadas de atribuição/uso. Não usa sessões reais nem bots oniscientes. Veja o [relatório inicial](docs/simulation-m3.md), a [metodologia](docs/balancing.md) e a [ADR 007](docs/adr/007-sealed-powers-and-simulation.md). Os resultados não comprovam equilíbrio ou diversão.
