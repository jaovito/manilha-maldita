# Arquitetura e operação

Leia ao trabalhar em estrutura, domínio, servidor, transporte, interface ou operação. Os caminhos abaixo são uma estrutura-alvo; não pressupõem implementação existente. Consulte também [segurança](security.md), [regras](rules.md) e [verificação](testing.md) conforme a mudança.

## Stack e organização

Decisão aprovada: monólito modular em TypeScript, com Bun no workspace e no backend, Clean Architecture nas dependências e DDD no domínio. Os defaults para implementação são:

| Área | Default |
|---|---|
| Linguagem/workspace | TypeScript estrito, Bun workspaces, um único `bun.lock` |
| Runtime | Bun, com versão fixada para desenvolvimento e CI |
| Frontend | React + Vite executado com Bun; PixiJS na implementação da mesa/efeitos |
| Backend | Bun + Hono + adaptador WebSocket para Bun |
| Contratos | Schemas de runtime, preferencialmente Zod, com tipos derivados |
| Testes | Bun Test para unitários/integração, fast-check para propriedades e Playwright para E2E |
| Persistência | PostgreSQL + Drizzle; infraestrutura local preparada, sem banco por jogada |
| Estado vivo no MVP | Memória, uma autoridade por sala |

Use Bun para instalação, scripts e execução das ferramentas do front e do back. O frontend entregue roda no navegador; não importe APIs de Bun no código destinado ao browser. Execute Vite explicitamente com Bun (`bunx --bun vite` e `bunx --bun vite build`). Mantenha typecheck separado: executar/transpilar TypeScript não comprova a correção dos tipos.

Preserve as escolhas aprovadas; mudanças futuras de runtime, ORM, framework ou gerenciador precisam de justificativa ligada à tarefa. Não mantenha dois gerenciadores/lockfiles, introduza Go sem necessidade medida ou torne Redis/banco obrigatório por jogada. Fixe versões e scripts no bootstrap; não invente versões nem atualize dependências alheias à tarefa. Ferramentas que exigirem outro runtime precisam de exceção documentada e validada, sem fallback silencioso.

Estrutura-alvo; crie módulos somente quando necessários:

```text
AGENTS.md
GDD.md                 # visão de produto e propostas futuras
apps/
  web/                 # lobby, UI, renderização, transporte do cliente
  server/              # HTTP/WS, sessões, salas, timers, adaptadores
packages/
  game-core/           # domínio, estados, regras, poderes, projeções puras
  game-protocol/       # schemas, comandos e DTOs de transporte
  game-sim/            # simulações e políticas de bots
docs/
  rules.md
  architecture.md
  security.md
  testing.md
  balancing.md
  adr/                 # decisões estruturais, quando necessárias
plan.md
```

O core não importa UI, frameworks, sockets, ORM ou relógio global. Poderes começam como submódulo; extração futura não pode criar ciclos. Protocolo reutiliza tipos seguros, nunca o estado autoritativo inteiro como DTO.

Use domínio puro, aplicação/orquestração e adaptadores. Evite repositórios genéricos, containers de DI, microsserviços, event sourcing persistente e engines de plugins sem demanda concreta.

## Backend: módulos, Clean Architecture e DDD

Organize primeiro por funcionalidade; dentro de cada módulo, separe domínio, aplicação e adaptadores conforme houver necessidade. Evite pastas globais de controllers, services e repositories reunindo funcionalidades diferentes.

```text
apps/server/src/
  bootstrap/                 # configuração e montagem do processo
  modules/
    rooms/
      domain/                # estado da sala, membros e configuração
      application/
        use-cases/           # membership, lobby, match e solo
        services/            # fila e ciclo de vida; lobby, match, membership, solo e messaging
        ports/               # entrada, repositório, publicação e runtime
        dto/                 # comandos, projeções internos e mappers de saída
        state/               # envelope operacional da sala
      adapters/
        inbound/             # validação dos contratos públicos
        outbound/            # repositório em memória e runtime
      composition.ts         # montagem das dependências do módulo
    sessions/
      domain/entities/       # identidade convidada e validade
      application/
        use-cases/           # emitir, consultar e renomear sessão
        ports/               # armazenamento, relógio e credenciais
      adapters/outbound/     # memória e geração criptográfica
      composition.ts
    matches/
      domain/                # política pura de tempo/reconexão
    transport/
      adapters/
        inbound/http/        # controllers e middleware de segurança
        inbound/websocket/   # handler de conexão e mensagens
        outbound/            # serialização e limites de saída
      composition.ts         # montagem dos handlers Hono
```

Crie somente módulos e camadas exercitados pelo incremento atual. `matches` usa o domínio de `packages/game-core`; não duplique esse domínio em `apps/server`. A autoridade da sala coordena lobby e partida pela mesma fila, inclusive início e revanche; não crie escritores independentes para o mesmo estado. A separação implementada e os limites do repositório em memória estão registrados na [ADR 010](adr/010-explicit-clean-architecture.md).

Dentro de `application`, o primeiro nível expressa responsabilidade arquitetural; funcionalidades agrupam arquivos dentro de `use-cases` e `services`. Não mantenha `lobby`, `match` ou `solo` como pastas irmãs dessas responsabilidades. `services` contém coordenação compartilhada, consultas de presença e preparação da entropia recebida por port; `state` contém apenas a estrutura operacional. `dto/mappers` constrói projeções autorizadas e traduz erros seguros para saída. A operação de desenvolvimento que reinicia a mão é um caso de uso em `use-cases/solo`, com suas restrições de ambiente e autorização preservadas.

A aplicação conhece o domínio e define os contratos de que precisa para efeitos externos. Adaptadores implementam esses contratos e dependem da aplicação/domínio, nunca o inverso. `bootstrap` conecta as implementações concretas por parâmetros ou construtores, sem container de DI obrigatório. Hono e APIs de Bun ficam nas bordas.

A partida é a fronteira de consistência das regras: carta, energia, aposta e resolução relacionadas são atualizadas numa única transição aceita. Use o vocabulário partida/mão/vaza; agregados e objetos de valor podem ser representados por tipos e funções puras. DDD não exige uma classe `Match` concentrando todo o comportamento nem uma classe para cada valor.

```text
packages/game-core/src/
  cards/                     # identidades, distribuição e força
  tricks/                    # resolução de vazas
  betting/                   # negociação de apostas
  hands/                     # encerramento e mãos especiais
  powers/                    # sorteio, energia e habilidades
  match/                     # fases e composição das transições
  projections/               # visões autorizadas de cada destinatário
```

O fluxo de um comando é: adaptador valida mensagem e sessão → aplicação entra na fila da sala e verifica contexto/idempotência → core executa a transição → aplicação confirma o estado e agenda efeitos → projeções autorizadas são enviadas a cada destinatário. Confirmação em memória não implica persistência durável nem recuperação após queda.

### Patterns e SOLID

- Responsabilidade única: cada módulo/arquivo tem um conceito coeso e um motivo claro para mudar; extraia comportamento, não fragmentos arbitrários.
- Inversão de dependências: crie ports pequenos para fronteiras reais, como relógio, entropia, agendamento e armazenamento. Não gere uma interface para cada função nem repositories para cartas/vazas.
- Máquina de estados: fases explícitas e tratamento exaustivo dos comandos permitidos.
- Eventos de domínio: fatos aceitos alimentam projeções e auditoria; informação privada mantém destinatários e canal próprios. Eventos não tornam event sourcing persistente obrigatório.
- Strategy: use quando existirem políticas distintas, como sorteio independente/espelhado e políticas de simulação. Funções tipadas bastam; não antecipe engines de plugins.
- Prefira composição a herança. Interfaces segregadas descrevem o que o consumidor usa; implementações alternativas devem preservar o mesmo contrato e invariantes.

## Frontend: funcionalidades e separação de estados

```text
apps/web/src/
  app/
    main.tsx                 # montagem da aplicação
    App/                     # composição e seus testes
    styles/                  # estilos globais e ordem da cascata
  features/
    menu/
      index.ts               # API pública da feature
      pages/EntryMenu/
        index.tsx
        index.test.tsx
      components/            # Profile, Icon e seus estilos
      styles/                # estilos da página e adaptações
    room/
      index.ts               # API pública da feature
      components/
        Lobby/
          index.tsx
          index.test.tsx
          Icon/
          Settings/
          Seats/
          Invite/
        Table/
          index.tsx
          index.test.tsx
          Actions/
          Card/
          History/
          Powers/
          Seats/
          styles/
      utils/                 # formatação de cartas da feature
  shared/
    preferences/             # preferência local de apelido
    transport/               # HTTP/WS compartilhado pela entrada e sala
```

Componentes, hooks, estilos e testes ficam próximos da funcionalidade que os utiliza. Componentes usam uma pasta por responsabilidade, com `index.tsx`, `index.test.tsx` quando houver testes próprios e `styles.css` quando houver estilos; filhos exclusivos ficam dentro do componente pai. Testes de comportamento podem ter nomes específicos, como `viewport.test.tsx`. Estilos responsivos extensos ficam em `styles/` junto ao componente. `pages` contém apenas páginas e seus testes; componentes ficam em `components` da feature, e estilos de página ficam em `styles` da feature. `utils` e `services` são criados apenas quando existe responsabilidade concreta, sem pastas vazias antecipadas. Cada feature expõe uma API pública pequena; outras features não importam seus arquivos internos. Código exclusivo de uma feature continua nela. Promova algo a `shared` quando houver reutilização concreta e responsabilidade estável.

Separe estado confirmado pelo servidor (cartas visíveis, turno, energia e placar), estado local da interface (seleção, painéis e preferências) e estado de animação. Uma seleção pode ser imediata; resultado, gasto e pontuação dependem da confirmação do servidor. Não mantenha uma segunda cópia autoritativa da partida no cliente.

React coordena interface e estado de apresentação; PixiJS recebe dados autorizados e emite intenções de interação. Não replique as regras no renderizador nem faça o servidor depender da duração de animações. O cliente importa contratos públicos de `game-protocol`; o pacote não exporta o estado secreto ou o baralho ordenado. Importações de `game-core` pelo cliente, se necessárias, devem usar uma API explicitamente segura, sem carregar estado autoritativo.

O transporte compartilhado resolve HTTP e WS a partir de `VITE_BACKEND_URL`, uma origem pública HTTP(S) opcional definida no ambiente do build Vite ou em `apps/web/.env.local`. Sem valor, usa `/api` e a origem da página, preservando o proxy de desenvolvimento/preview. Caminhos, credenciais e query na configuração são rejeitados. HTTP inclui cookies; CORS é limitado a `ALLOWED_ORIGINS`, GET/POST e Content-Type. O handshake WS continua com validação explícita de origem. Acesso direto entre origens exige o mesmo site por causa do cookie SameSite=Strict; entre sites diferentes, use proxy na origem do frontend. Veja o exemplo no [README](../README.md#url-do-backend-no-frontend).

## Tamanho, navegação e fronteiras

Os limites abaixo orientam código de produção escrito à mão, incluindo componentes e hooks. Contagem de linhas é um sinal de revisão; a extração precisa preservar coesão e ter responsabilidade clara.

| Sinal | Ação |
|---|---|
| Arquivo acima de 300 linhas | Revisar responsabilidades e oportunidades de extração |
| Arquivo chegando a 450 linhas | Extrair partes coesas antes de ampliar o comportamento |
| Arquivo com 500 ou mais linhas | Refatorar antes de concluir; exceção exige justificativa explícita na revisão |
| Pasta com cerca de 15 arquivos diretamente nela | Avaliar agrupamento por conceito; não criar subpastas artificiais para cumprir contagem |
| Testes extensos | Separar por comportamento, mantendo proximidade com a área testada |
| Arquivos gerados e lockfile | Excluídos dos limites; não editar/dividir geração para satisfazer métricas |

Use nomes de domínio como `resolve-trick.ts`, `accept-raise.ts` e `project-player-view.ts`. Evite arquivos genéricos `utils.ts`, `helpers.ts` ou `services.ts`, e divisões mecânicas `part-1`/`part-2`. Não imponha um arquivo por função ou por interface.

Módulos/pacotes expõem entradas públicas explícitas; evite cadeias de barrels e importações profundas de implementações alheias. Dependências devem ser acíclicas. Não crie dependência do core no protocolo de transporte para fechar ciclos; traduza mensagens em comandos de domínio na aplicação.

No bootstrap, configure verificação de fronteiras de imports no lint: domínio sem runtime/framework/I/O, browser sem adapters do servidor e módulos sem acesso aos internos de outros módulos. Regras de tamanho entram como alertas/revisão com as exceções acima, sem declarar verificações existentes antes de implementá-las. Consulte [testing.md](testing.md) para os checks do incremento.

## Motor de estado, comandos e aleatoriedade

Modele fases explícitas: `LOBBY`, `DEALING`, `ELEVEN_DECISION`, `PREPARATION`, `TURN`, `RAISE_RESPONSE`, `TRICK_RESOLUTION`, `HAND_END`, `MATCH_END`. Após aposta, retome o turno salvo. Use uniões discriminadas; evite flags que permitam estados contraditórios.

O core executa partidas sem navegador, rede, banco ou relógio real. Uma transição recebe estado, comando autorizado e contexto confiável e retorna estado, eventos e efeitos. Tempo e entropia são entradas explícitas; proíba `Math.random()`, `Date.now()`, I/O e timers no domínio. Testes usam relógio falso e entropia determinística.

Em produção, o adaptador gera aleatoriedade criptograficamente segura e sem viés; não embaralhe por comparador aleatório. Registre resultados necessários à reprodução em trilha privada, com versão das regras. Nunca aceite sementes ou resultados do cliente nem publique a ordem do baralho.

Valide antes de sortear/debitar. Comando inválido ou repetido não avança estado, gerador, pontos ou energia. Conserve as 40 cartas entre mãos, vira, monte, mesa e descartes, sem duplicação de identidade.

Resolução e projeção são funções separadas. Compartilhar algoritmos não autoriza compartilhar dados secretos. A UI pode indicar ações disponíveis, mas o servidor revalida cada comando.

## Multiplayer e concorrência

### Uma autoridade por sala

Serialize comandos, timers e transições por sala. Não dependa apenas do event loop: operações assíncronas não podem permitir leitura e gravação concorrentes do mesmo estado. No MVP, uma fila por sala no processo é suficiente; não adicione um lock distribuído sem necessidade.

Identidade vem da sessão autenticada, inclusive para convidados. `playerId`, `teamId`, turno e permissão enviados pelo cliente não concedem autoridade.

O envelope deve identificar protocolo, sala, partida, comando e contexto de decisão, com `commandId`, `matchId`, `decisionId` e a versão esperada quando aplicável. Tipos de payload devem ser específicos por comando/poder, sem um objeto genérico cheio de opcionais.

- Faça parsing e validação de runtime antes de entrar no domínio.
- Para comandos de turno, valide a versão de gameplay esperada e o contexto.
- Para preparação simultânea e respostas de equipe, valide `decisionId`, fase e compromisso/resposta ainda aberto. Não invalide uma intenção apenas porque outro jogador ficou pronto ou um evento de presença ocorreu.
- Separe presença de versão de gameplay. Não esconda conflitos reais flexibilizando toda validação de versão.
- Uma decisão aceita fecha seu contexto; comandos atrasados não podem atingir a próxima vaza ou uma revanche.

### Idempotência e sincronização

Deduplicação por identidade lógica do jogador, partida e `commandId`, com política de tamanho e retenção. A chave sobrevive à reconexão; não depende do ID do socket. Autentique antes de acessar o registro. Para o mesmo ID e payload, devolva o resultado original; para ID reaproveitado com payload diferente, rejeite. Consulte duplicatas antes de rejeitar uma versão antiga, pois o ACK original pode ter se perdido.

Eventos/snapshots precisam de ordenação e versão. O cliente ignora duplicatas e solicita ressincronização quando houver lacuna. Uma rejeição por estado obsoleto orienta atualizar a projeção; não reproduza automaticamente uma intenção em um turno novo.

Confirmações do cliente ou fim de animação não fazem o servidor avançar regras. Animações acompanham eventos aceitos. Em reconexão, descarte animações incompatíveis e reconstrua a interface a partir do snapshot autorizado.

Snapshots completos filtrados são aceitáveis no MVP; diffs são otimização posterior. Não use broadcasting do estado interno seguido de filtragem no navegador.

## Interface e experiência de jogo

Na tela de resultado, sair é uma navegação local: fecha o socket, cancela reconexões e limpa sala, convite na URL e estado de feedback. Se houver conexão, o cliente envia `LEAVE` antes de fechar, sem aguardar ACK. Sem conexão, “Voltar ao menu” e “Sair da sala” continuam disponíveis para qualquer jogador; revanche e retorno ao lobby continuam dependendo do servidor e das permissões do anfitrião. Isso não altera abandono, pontuação ou remoção autoritativa de membros. Durante lobby/partida em andamento, a saída mantém o fluxo de confirmação existente.

Em celulares (até 600 px) e paisagem baixa (até 500 px de altura), o histórico começa recolhido numa aba lateral de 44 px com seta. O botão abre/fecha o pergaminho; Escape recolhe mantendo foco no mesmo controle. O conteúdo fechado fica oculto também para tecnologias assistivas. O painel aberto limita sua altura à tela e mantém rolagem interna, acompanhando novas ações somente enquanto o leitor estiver no final. Desktop mantém o histórico visível.

O pergaminho mantém a proporção original 614:768, com `background-size: contain` e amostragem pixelada. O viewport define seu tamanho; conteúdo vazio, novas ações, textos longos e expansão dos detalhes não mudam a moldura. A lista interna rola dentro das margens reservadas às dobras, sem deformar ou fatiar a arte. O aviso de histórico vazio também pertence à área interna de leitura.

O histórico combina ações públicas com a observação privada do próprio Espião, identificada por “Só você”. A carta vem exclusivamente de `match.powers.intel` da projeção autorizada e só acompanha a ativação do próprio assento com o alvo correspondente. Continua como registro do que foi visto mesmo depois da jogada; uma nova mão usa somente o novo snapshot, sem guardar cartas no navegador. Parceiro, alvo e demais jogadores recebem apenas as ativações públicas, sem essa observação privada.

Jogadas confirmadas animam a face autorizada da origem na mão até o slot da mesa por 380 ms, usando Web Animations. O clique local apenas registra geometria; rejeição não inicia movimento. Adversários partem de um verso anônimo, sem identificar a carta privada. Cobertas e máscaras preservam a representação já autorizada. Primeira carga, troca de mão/partida e retomada após pausa não reproduzem jogadas antigas; SYNC repetido não duplica o voo. Movimento reduzido desativa o deslocamento. O destaque de vencedor e os efeitos do poder iniciam ao pousar, dentro da pausa autoritativa existente.

O título e o valor da aposta ocupam áreas proporcionais dentro do medalhão, com folga para sua borda circular também em telas compactas.

O baralho da distribuição e a origem dos voos acompanham o eixo das cartas jogadas. Em telas acima de 600 px, a mão local compartilha esse eixo horizontal: centro da arena no 1v1 e eixo da composição no 2v2. Em retrato compacto, a mão mantém o espaço lateral reservado aos poderes.

Cartas comuns usam uma composição única proporcional à largura da própria face (unidades cqw), incluindo naipe, números, margens e moldura. O contexto muda apenas o tamanho externo; mão, mesa, vira e faces observadas mantêm o mesmo desenho.

O botão de Truco centraliza ícone e texto como um único bloco, com compensação óptica da fonte pixelada; a mesma composição atende aos contra-aumentos. “Passar preparação” também centraliza seu texto com compensação óptica, sem depender de padding assimétrico.

Na mesa, avatar e moldura do nome compartilham espaçamento de 12 px no desktop e 8 px nas telas compactas. Nomes têm largura intrínseca limitada pela coluna, sem margens automáticas que afastem a moldura do avatar; em retrato, os versos ficam acima da identidade.

A seleção “Jogar coberta” vale para uma jogada: expira quando o snapshot confirma a redução da mão do jogador. Comandos rejeitados e atualizações sem consumo de carta preservam a seleção; outra mão ou partida começa desmarcada.

O menu principal fica em `features/menu/pages/EntryMenu`. `shared/MenuScenery` compõe as camadas decorativas de menu e lobby: feltro repetível no shell, quatro cantos, quatro segmentos do símbolo central, vela, cuia, moedas, baralho e cartas do menu. PNGs com alpha preservam proporção; CSS define âncoras e tamanhos limitados, sem esticar uma imagem única. Logo Manilha Maldita e demais assets derivam da referência anterior, com procedência e prompts em `public/art/layers/README.md`. O perfil e navegação são HTML. A decoração não recebe estado de partida, não captura ponteiro/foco e fica oculta da árvore acessível. Animações CSS de cartas respeitam movimento reduzido. Em retrato, elementos secundários cedem espaço e o conteúdo pode rolar; em paisagem baixa, os controles ficam compactos. Criação/ingresso e recursos futuros desabilitados preservam os fluxos existentes.

O lobby compõe `LobbySettings`, `LobbySeats` e `RoomInvite`: configurações editáveis somente pelo anfitrião, equipes relativas ao jogador e cópia do link público exclusivamente após clique. Clipboard indisponível ou rejeitado recebe orientação de cópia manual, sem falso sucesso. O código continua sendo convite, não credencial. As artes do menu não incorporam textos, ações, nível, moeda ou informações da partida.

Sem apelido local válido, `Welcome` (`features/menu/components/Welcome`) pede um apelido antes do menu. O campo recebe foco e aceita Enter; validade e limites usam o schema público do protocolo. `App` separa rascunho e confirmação: só salva o primeiro apelido ao confirmar, sem criar convidado nem entrar em sala. Um código de convite permanece no estado e reaparece no painel de ingresso. Valor local válido pula a etapa; a sessão recuperada também a dispensa. A confirmação fica válida por esta visita mesmo com storage bloqueado, e apagar o campo depois no perfil não interrompe o menu atual.

O apelido digitado é uma preferência local validada em `shared/preferences/nickname`, restaurada no primeiro render e salva ao editar o perfil após confirmação. O cliente consulta a sessão pelo cookie e usa seu apelido confirmado quando o usuário ainda não iniciou uma edição; uma resposta atrasada não sobrescreve o campo em uso nem entra automaticamente num convite enquanto o usuário escolhe outro apelido. Ao entrar, a resposta da sessão confirma o apelido salvo. A preferência não autentica, não retoma assentos e não grava tokens; falhas do armazenamento são toleradas. Retenção e exclusão estão em [security.md](security.md).

Na sala, a composição segue a referência de criação: coluna esquerda com título, configurações em linhas com ícones, link de convite com cópia e prévia decorativa; coluna direita com equipes, uma mensagem curta de condição de início e ações inferiores. Molduras SVG com recorte em nove partes preservam os ornamentos ao redimensionar. As colunas se empilham em telas estreitas. `Lobby/styles/scene.css`, `Lobby/Settings/styles.css`, `Lobby/Seats/styles.css` e `Lobby/styles/responsive.css` e `Lobby/styles/desktop.css` separam composição, controles, jogadores e adaptações.

Modo/preset usam radios nativos com aparência segmentada, seleção confirmada pelo snapshot e teclado preservado; convidados recebem o fieldset desabilitado. Temporizadores ficam em uma seção expansível e respeitam o preset. Sala privada e poderes aleatórios são invariantes e não aparecem como controles desabilitados. Não há opção de sala pública nem chat funcional; o catálogo explica os quatro poderes. Pronto fica no próprio assento; sair/iniciar/revanche ficam no rodapé. O link público de convite fica sempre visível em campo somente leitura, selecionável ao focar, com botão de copiar ao lado e orientação manual se Clipboard falhar.

Configurações bloqueadas recebem paleta cinza dessaturada nos ícones, legendas e seletores, além da indicação “Somente leitura” vinculada ao fieldset. A opção atual continua distinguível, sem dourado de controle ativo; o texto mantém contraste sem reduzir a opacidade do painel inteiro. Esse estado acompanha a permissão atual do snapshot e não afeta copiar o convite.

Textos usam marfim e tons claros sobre painéis opacos de verde/azul escuro; dourado destaca títulos e códigos. Legendas têm no mínimo 14 px. Por refinamento solicitado pelo proprietário, botões de ação desabilitados ficam fortemente atenuados (opacidade de 0,25) e sem brilho/ampliação de hover. Cartas bloqueadas preservam a leitura das faces/versos, pois continuam sendo informação de jogo. Instruções e título recebem superfície própria, sem texto diretamente sobre a madeira ilustrada.

`shared/DisabledTooltip` mantém `disabled` nativo e usa `title`, `aria-description` e `data-disabled-reason` com o mesmo motivo fixo por estado. Um único portal opaco e limitado ao viewport evita recortes e wrappers que alterariam a geometria. Hover, toque e foco nos poderes consultáveis apresentam a explicação; controles nativamente desabilitados continuam fora da ordem de Tab, com descrição disponível ao leitor de tela. A reconexão tem prioridade sobre motivos de decisão antigos. O tooltip nativo é suspenso enquanto o personalizado aparece e restaurado somente se o motivo continuar atual. Mover o ponteiro e rolar dentro da explicação preserva sua leitura; Escape, scroll externo, resize, mudança de motivo e remoção do controle fecham a apresentação e limpam recursos, sem enviar ações.

Os cartões dos assentos têm alturas uniformes entre equipes e reservam uma área inferior de ações, inclusive quando não há botão para aquele jogador. Os controles se ancoram nessa área, com altura mínima em unidades da fonte para comportar duas linhas sem variar a posição conforme apelidos ou badges.

A interface atual usa React/DOM e CSS responsivo para entrada, lobby e mesa. O acabamento autorizado antecipa a parte visual do M4 sem migrar renderizador ou acrescentar regras: `Table` compõe `CardFace`, `TableSeats`, `TableActions` e `TableHistory`. Os estilos da aplicação separam fundamentos, lobby, mesa e cartas. Assets decorativos locais e a fonte licenciada estão em `apps/web/public/`; origem e prompts em `art/README.md`. Versos representam somente contagem pública, nunca identidade de cartas ocultas. A posição de cada assento é relativa ao jogador, inclusive em 1v1. Energia e poderes vêm da projeção autoritativa do M3; não são valores simulados para preencher o layout.

A partida usa uma superfície de `100dvh`, sem largura máxima de página. A mesa é o fundo da cena, com HUD e controles posicionados por regiões proporcionais e tamanhos limitados por `clamp`. Estilos de viewport, assentos, retrato e paisagem ficam separados; a altura também determina a composição. A mão e as ações permanecem dentro da tela. O menu Sala fica em um `details` nativo durante a partida, limitado a informação da sala e som; o lobby aparece somente fora do jogo, e o encerramento tem apresentação/diálogo próprios; somente histórico e painéis secundários têm rolagem interna. Não é necessário usar a API de fullscreen do navegador ou bloquear orientação.

O incremento inicial do M4 mantém o renderizador React/DOM existente e acrescenta efeitos pontuais em CSS: carteado com versos anônimos, chegada das cartas, destaque de vencedor e chamas decorativas. É uma escolha técnica reversível para não migrar toda a mesa por esses efeitos; PixiJS permanece a opção prevista para cenas/efeitos que justifiquem outro renderizador. Não mantenha dois renderizadores completos. React controla HUD, botões, foco e acessibilidade, sem regras autoritativas.

Mostre mão própria, equipes, vira/manilhas, placar, aposta aceita/proposta separadamente, turno, energia, poder e histórico público. Distinga coberta de Máscara e explique bloqueios por energia, turno, fase, alvo ou uso anterior.

Ofereça clique/toque sem exigir arrastar, teclado/foco, distinção além de cor, áudio desligável e movimento reduzido. Animação, som ou reflexos não podem ser necessários para compreender regras.

Atualize por eventos, não renderize React inteiro por frame; limite partículas e limpe sockets/listeners/timers/texturas. FPS nunca decide o resultado. Use assets próprios ou licenciados com procedência. Cosméticos não afetam área clicável, legibilidade, tempo nem informação; domínio não importa inventário cosmético.

O [ADR 008](adr/008-authoritative-presentation-pauses.md) define pausas autoritativas de distribuição, vaza e mão. `transition` não é pausa de reconexão: mantém `decisionId/deadline` nulos e bloqueia gameplay até o servidor abrir a decisão seguinte. O resultado temporariamente ocupa a região do placar para deixar as cartas resolvidas visíveis; o histórico mantém explicações das vazas e somente ativações públicas confirmadas. O cliente anota o resultado recebido, sem recalcular vencedor nem consultar informação privada alheia.

`TurnAnnouncement` mostra “SUA VEZ!” em uma faixa central por 2,4 s quando há turno próprio acionável. O contexto visual usa partida, assento, mão, vaza e quantidade pública de jogadas, evitando repetição por SYNC, pausa/retomada e negociação da mesma carta mesmo quando muda `decisionId`. Nova vaza do mesmo assento recebe novo aviso. Ao montar em turno próprio já aberto, apresenta o aviso atual uma vez. Timer é somente de apresentação, limpo ao mudar contexto/desmontar e protegido contra callback obsoleto; não envia comandos, captura foco, bloqueia ações nem altera deadline. Movimento reduzido mantém a faixa estática pelo mesmo intervalo, enquanto o status e selo de turno permanecem disponíveis após ela sumir.

`RoundAnnouncement` apresenta o resultado recebido da vaza/mão durante a transição autoritativa, com texto relativo ao assento (“você” no 1v1, “seu time” no 2v2); empate é neutro. `MatchResult` fica montado fora do menu Sala, acompanhando snapshots inclusive no lobby. Ao observar `playing -> finished` na mesma partida, apresenta resultado central por 5 s, sem botões. O estado de apresentação é ajustado antes do commit para impedir um flash do menu final. Em seguida mostra um diálogo compacto com título, placar, motivo e somente Revanche, Voltar ao lobby e Sair da sala. Os dois primeiros preservam o comando autoritativo existente `REMATCH`: somente o anfitrião pode limpar o resultado e retornar todos ao lobby, sem marcar pronto nem iniciar automaticamente. Sair preserva `LEAVE` com ACK; desconexão desabilita os controles. Durante jogo, Sala contém somente informação da sala e áudio; não renderiza o lobby/configurações congeladas. Confetes celebram somente a transição de uma partida em andamento para vitória própria natural: `outcome.reason=completed`, fase MATCH_END e placar do vencedor confirmado >=12. O placar continua limitado a 12 pelo contrato vigente. Abandono, desistência, término sem vencedor e derrota não geram confetes.

A apresentação e o diálogo usam portal para `document.body`, evitando recortes/transformações da mesa. O título recebe foco ao encerrar; a mesa de fundo fica `inert`, e Tab/Shift+Tab ficam nos controles habilitados do diálogo final. A camada de 48 quadrados é decorativa; CSS nas cores feltro/ouro/vinho controla a queda por até 5 s. As posições são decoração determinística independente da entropia do domínio. A camada tem `aria-hidden` e `pointer-events:none`; não bloqueia controles nem movimenta foco. A primeira carga de uma partida já encerrada abre diretamente o diálogo final. SYNC, reconexão durante a apresentação e snapshots repetidos não prolongam o intervalo nem reiniciam confetes; revanche/desmontagem cancelam o timer, e callbacks obsoletos não ocultam outra celebração. Movimento reduzido mantém os mesmos 5 s de leitura, com título estático e partículas ocultas. O observador de áudio usa o vencedor público e a paridade do assento, priorizando partida sobre mão e mão sobre vaza para tocar um único resultado, com tons distintos de vitória/derrota e empate neutro.

`shared/feedback` sintetiza sons próprios via Web Audio, sem dependências ou assets remotos. `App` observa snapshots autorizados e reseta o observador ao perder conexão; sequências repetidas, saltos e primeira carga não reproduzem sons históricos. Sons de poder e resultado dependem do snapshot, enquanto seleção/clique são apresentação local. O engine desbloqueia após gesto, tolera indisponibilidade e limpa grafo/listeners ao desmontar. Volume e mute ficam em `truco.audio`; controles nativos aparecem no menu/lobby e dentro de “Sala” durante a partida. Movimento reduzido remove animações e chamas extras, mantendo resultado textual e intervalos de leitura.

## Persistência, observabilidade e operação

Sem consulta de banco por jogada no MVP. Persistência futura separa contas/cosméticos/resultados do estado vivo; término é idempotente por `matchId`. Transações não atravessam decisões humanas.

Logs operacionais: correlação, fase, versão, comando, duração e código de erro, sem payload integral, tokens, cartas ou sementes. Auditoria privada/reprodução tem canal, acesso e retenção separados; não use `console.log(gameState)`.

Meça salas, latência, rejeições, duplicatas, desconexões, duração, abandono e uso de poderes. Não use IDs de jogador/sala como labels de métricas. Analytics externos exigem decisão explícita.

Limite recursos, expire salas e isole clientes lentos. Deploy futuro drena partidas e deixa de aceitar salas novas. Não presuma que funções HTTP efêmeras mantêm WS/salas em memória.

Escala horizontal exige roteamento, escritor único por sala e recuperação protegida contra dupla autoridade; Redis Pub/Sub não resolve isso sozinho. Distribua somente após necessidade medida.

## Bootstrap atual

A base contém cinco workspaces (`web`, `server`, `game-core`, `game-protocol`, `game-sim`), dependências fixadas, TypeScript por ambiente, Biome e checagem de fronteiras com parser Oxc, além de smoke tests. Use Bun Workspaces sem Turborepo; considere orquestração/cache adicionais quando houver ganho medido. A árvore de módulos acima continua sendo referência de evolução: o core implementa as regras-base do M1; o servidor e o cliente funcional do M2 já usam salas autoritativas, transporte e projeções. A estrutura acima continua orientação para módulos futuros.

Bun está fixado em 1.4.3. Biome 2.5.15 substitui ESLint/Prettier. TypeScript 7.0.2, Vite 8.3.4 e plugin React 6.1.2 usam as versões estáveis atuais publicadas na revisão; as demais dependências diretas também foram conferidas contra a tag `latest` estável e permanecem fixadas no lockfile. Prefira versões estáveis atuais compatíveis, sem downgrade por conveniência nem versões canary/RC sem necessidade autorizada.

A instalação limpa dos navegadores Playwright foi validada com Bun 1.4.3, removendo a exceção anterior de Node. Não desabilite validação TLS. Veja comandos e limites no [README](../README.md).

`bun run lint` executa Biome e `check:architecture`. Biome valida padrões de código, hooks e globais proibidos; a checagem de arquitetura usa `oxc-parser` para imports e APIs de tempo/entropia, sem executar código analisado ou depender de ESLint. Ela não é sandbox nem prova completa de ausência de ciclos; o teste do grafo verifica ciclos entre workspaces. As regras de quantidade de linhas seguem os limites de revisão já definidos.

## Registro da decisão

A adoção de Bun e da organização modular está registrada em [ADR 001](adr/001-bun-modular-architecture.md). Este documento contém as instruções vigentes; a ADR registra motivação e consequências. Ambos descrevem uma estrutura-alvo, não implementação concluída.

A escolha de Bun Test e os limites do bootstrap estão em [ADR 002](adr/002-bun-test-bootstrap.md).

A migração para Biome e atualização das dependências está registrada em [ADR 003](adr/003-biome-current-dependencies.md).

## Infraestrutura local de persistência

Docker Compose fornece PostgreSQL 18.6 para desenvolvimento e uma instância de testes isolada. Drizzle usa o driver SQL nativo de Bun; migrações e seeds locais ficam em `apps/server/database`, fora do core e da aplicação. A migração inicial reserva apenas o namespace `app`, sem tabelas de produto. O banco não é requisito de execução do motor nem armazenamento vivo das salas.

Leia [database.md](database.md) antes de alterar schemas, conexões, seeds ou fixtures. `test:coverage` inclui testes reais de banco, por isso o check completo e o CI requerem Docker. Testes unitários do domínio continuam independentes. A decisão e seus limites estão em [ADR 004](adr/004-local-postgresql-seeds.md).

## Motor de regras-base (M1)

`game-core` expõe subpaths explícitos para cartas, distribuição, vazas, mãos, apostas, composição da partida e projeções. As funções são puras, retornam dados novos e rejeitam entradas inválidas com códigos estáveis sem incorporar cartas ao erro. São APIs internas tipadas; transporte deve validar payloads desconhecidos e nunca serializar esses dados privados diretamente.

O embaralhamento recebe 39 índices inteiros do adaptador confiável (limites exclusivos 40 até 2) e aplica Fisher–Yates num baralho novo. A origem criptográfica e uniforme desses índices será responsabilidade do adaptador de produção; nenhuma entropia vem do cliente. A distribuição usa rodadas de uma carta por assento, a partir do iniciador, com a vira após as três rodadas. Essa ordem interna é uma escolha técnica determinística e reversível, não uma alteração de regra ou garantia de segurança dos IDs.

O resolvedor de vaza exige uma vaza completa em ordem horária, rejeita duplicatas/vira e cobertas na primeira vaza. O resolvedor de mão aplica a tabela normativa e rejeita histórias com jogadas após término antecipado. A composição em `match` valida posse, fases, ordem, cobertas em mãos especiais, apostas e pontuação. Cada decisão fecha uma revisão; rejeição e entrega repetida com revisão antiga não modificam o estado. `finishHand` é auxiliar interno e não integra a API exportada. O motor não constitui servidor jogável.

A API de composição tem estados `TURN`, `RAISE_RESPONSE`, `ELEVEN_DECISION`, `HAND_END` e `MATCH_END`. Distribuição e resolução são passos síncronos atômicos, sem aguardar cliente/animação. `dealNextHand` exige `HAND_END`, rotaciona o iniciador e recebe novas escolhas de embaralhamento; a distribuição nunca ocorre após 12 pontos. A recompensa original é preservada em `HAND_ENDED`, mesmo com placar limitado a 12.

Projeções públicas e individuais são construídas por allowlist. Mãos ocultas têm apenas assento/contagem; cobertas não têm carta nem referência física para terceiros, inclusive em históricos e término. Onze mantém a visibilidade já concedida aos parceiros na mesma mão; 11×11 não concede essa visibilidade. O chamador autentica o destinatário. O protocolo de rede futuro deve adaptar essas visões, sem exportar o estado autoritativo.

O M1 foi entregue sem campos ou execução de poderes/energia. O M3 acrescentou essas transições respeitando `hand.kind`, mantendo mãos especiais sem sorteios ou regeneração; não crie um preset de produto sem poderes com base neste estágio do motor. Identificação de partida, sessões, filas, deduplicação por comando com replay de ACK e timers pertencem à aplicação M2. Veja [ADR 005](adr/005-base-match-engine.md).

## Autoridade e transporte implementados no M2

A entrada de salas delega à `RoomApplication`; os casos de uso, o executor de comandos e o serviço de ciclo de vida compartilham a mesma autoridade operacional. `serializeRoom` mantém a fila limitada e recupera após rejeições. Um comando recebido no deadline primeiro resolve a expiração e depois valida seu contexto; callbacks de timer carregam a decisão e não atingem mãos/revanches seguintes. A identidade da sala na fila é verificada também após remoção, impedindo callbacks de uma sala antiga de escrever em outra com o mesmo código.

A aplicação de salas expõe casos de uso em `use-cases/membership`, `use-cases/lobby` e `use-cases/match`. `services/` coordena execução, publicação e agendamento; `state/` descreve o envelope operacional, separado do estado de domínio; `ports/` declara os contratos de efeitos e acesso à autoridade. `solo/` preserva a política de bot com visão limitada e ferramentas de desenvolvimento. `messaging/` constrói projeções internas e despacha comandos. Os consumidores externos usam as entradas públicas dos módulos. O repositório de salas retém a instância viva com sua fila; uma futura implementação durável exige novo desenho de consistência, não apenas trocar `Map` por SQL.


A entrada `@truco/game-protocol` contém schemas estritos de envelope, ações, configurações e snapshots, sem dependência do estado secreto. Os subpaths públicos do core são os declarados no manifesto; a checagem de arquitetura admite somente essas entradas e mantém o core inteiro proibido ao navegador. O domínio continua puro. A aplicação recebe relógio, entropia e agendamento por `Ports`; `rooms/adapters/outbound/runtime.ts` implementa UUIDs, rejection sampling criptográfico sem viés e timers canceláveis sobre tempo epoch monotônico.

`sequence` ordena snapshots completos; `roomRevision` fecha mudanças de lobby; `match.revision` e `decisionId` fecham decisões de gameplay. Presença altera sequência sem invalidar revisão de gameplay. Antes de efeitos ou rejeição de versão, uma requisição autenticada consulta o cache de `sessionId/matchId/commandId`: mesmo conteúdo recebe o ACK/erro original; conteúdo diferente é recusado. O cache guarda 512 respostas recentes por sala, e contexto/revisão protegem replay após evicção. O cliente usa UUID por comando, ignora snapshots repetidos/antigos e nunca repete automaticamente uma intenção após reconectar. Ao recuperar foco ou visibilidade, solicita um snapshot autorizado por `SYNC`, sem reaplicar intenções; os listeners são removidos ao fechar a conexão. Snapshots completos já ressincronizam lacunas; uma ação `SYNC` permite solicitá-los explicitamente.

`DecisionClock` mantém o tempo restante e orçamento de proteção por assento. Só uma decisão dependente de ausente pausa; respostas de equipe usam política “qualquer parceiro”. Ausências simultâneas consomem orçamentos em paralelo. Após a proteção, o tempo restante volta a correr; quando cartas estão sem relógio e o ausente esgotou a proteção, a decisão recebe fallback imediato. Novas decisões já expiradas são agendadas para a próxima execução da fila, sem recursão nem bloqueio indefinido. Timeouts compartilhados contam para os assentos elegíveis da equipe; uma resposta válida zera a sequência do autor. No terceiro timeout consecutivo exigido do mesmo assento, a equipe perde por abandono.

Configuração casual aceita tempos entre 1 e 120 segundos e pode desligar apenas o timer de carta. Competitivo congela carta/resposta em 20/15 s e proteção em 30 s; casual tem defaults 30/20 s e proteção de 60 s. M3 acrescenta preparação configurável no casual (default 15 s) e fixa em 10 s no competitivo. Uma sala sem conexões expira após o período de proteção do preset, sem vencedor e sem autojogadas ilimitadas. Outras salas/filas não dependem dessa espera.

Lobby permite mudar somente para assento livre antes da partida; assentos ocupados são recusados pelo servidor mesmo quando o ocupante ainda não está pronto. Mudanças de assento/configuração/ingresso retiram confirmações de pronto. O anfitrião inicia apenas com todos presentes e prontos. Saída de lobby/final remove associação e transfere anfitrião; durante partida usa-se desistência explícita. Revanche volta ao lobby com mesmos assentos/configuração e nova confirmação de pronto, gerando novo `matchId` ao iniciar. A saída envia ACK antes de fechar o socket.

Há cliente React DOM com mesa, lobby e reconexão limitada com backoff, usando proxy Vite `/api` e cookie de sessão; não existe estado autoritativo compartilhado entre navegadores. O visual é provisório em verde/ouro, sem assets gerados e sem antecipar o acabamento do M4. O backend não usa banco por jogada e não recupera partidas após reinício. Veja [ADR 006](adr/006-room-authority-and-reconnection.md) e as configurações no README.

## Poderes e simulações implementados no M3

`powers/powers.ts` concentra sorteio, energia e validação de ativação; `powers/preparation.ts` sela intenções e resolve o lote. `PREPARATION` é uma fase explícita; os comandos de carta carregam o poder opcional atomicamente. `PowerSetup` é privado, fornecido pelo adaptador, e não integra o protocolo. A entrada interna sem poderes permanece para regressões-base e controle experimental, nunca como preset de sala. A [ADR 007](adr/007-sealed-powers-and-simulation.md) detalha amostragem, compatibilidade e limites.

`TablePowers` separa seleção local e confirmação do servidor. A carta usa arte própria decorativa; custo, nome, energia e estado são HTML derivados da projeção, sem dados privados na imagem. O histórico ocupa seu painel próprio; poderes ficam numa carta em `Table/Powers/Card`, próxima da mão, com reserva de energia. O passe da preparação fica na área de ações, junto da contagem de prontos, preservando espaço para a carta em telas pequenas. A preparação começa recolhida. Clicar em um poder disponível seleciona os alvos diretamente na mesa: Espião destaca versos adversários; Segunda Chance habilita as cartas próprias para troca; Impulso/Máscara destacam cartas próprias elegíveis na sua vez. `Hand` contém a mão e a orientação contextual, sem selects ou painel para escolher cartas. `Seats/Cards` contém os versos clicáveis e a observação privada do Espião. Detalhes abrem sob demanda, fecham por botão/Esc e restauram foco à carta. A abertura é vinculada ao contexto da decisão; um contexto novo descarta o painel anterior. Seleção de poder de turno fica vinculada ao ID da decisão e é descartada quando ele muda. O servidor revalida custo, janela, alvo e posse independentemente dos bloqueios da interface.

`game-sim` depende somente das entradas públicas do core. As políticas recebem `PlayerView`; o executor privado cuida de fases, entropia e métricas. Fontes separadas por mão mantêm distribuições pareadas, com braços habilitado/controle e permutação de assentos/equipes. CLI local não integra o servidor nem exporta seeds de produção.

## Organização física do frontend

`app` contém somente montagem, composição (`App/`) e estilos globais. `features/menu` mantém apenas a página e seu teste em `pages/EntryMenu`, com Profile/Icon em `components/` e estilos da página em `styles/`, e expõe a entrada pela sua API pública; `features/room` expõe Lobby, Table e CardFace. Os nomes exportados dos componentes foram preservados, enquanto os arquivos seguem o padrão de diretório com `index.tsx`. O formato não exige um teste isolado para cada componente decorativo: os testes de composição existentes continuam junto do pai que exercita esses filhos.

Estilos pertencem à página/componente correspondente, incluindo adaptações da mesa e controles do lobby. `app/styles/index.css` é o único manifesto de carregamento: mantém explicitamente a cascata existente, inclusive a posição dos estilos globais entre as camadas. Não se importa CSS adicional nos componentes, evitando depender da ordem dos imports JavaScript. A ordem pode ser simplificada numa revisão visual própria; esta reorganização preserva o CSS gerado.

`room/utils/cards.ts` contém tipo de apresentação, naipes e rótulos de cartas, utilizados por mesa, assentos, histórico e poderes. Não importa JSX nem domínio privado. HTTP/WS e preferência de apelido permanecem compartilhados porque atendem entrada e sala; mover esses serviços para uma das features criaria uma dependência artificial entre elas.

A ilustração dos poderes usa um viewport quadrado (`aspect-ratio: 1`) para recortar o atlas 2×2 sem deformar os eixos. Moldura, título, custo e estado são elementos separados; o custo fica ancorado dentro da ilustração. Em celulares baixos, a carta vira uma miniatura com nome, arte e custo, reservando o rodapé para energia; o estado continua descrito no botão acessível e a seleção mantém contorno próprio. O clique na carta preserva os detalhes e o resultado privado do Espião. A carta fica à esquerda da mão, menor. Em dispositivos com hover e ponteiro fino (largura acima de 600 px), uma manga recorta aproximadamente a metade inferior em repouso; hover, foco, detalhes abertos ou poder selecionado revelam a carta inteira. A energia permanece visível. O recorte não altera a geometria quadrada da arte nem a semântica do botão. Telas de toque mantêm a carta inteira, sem um toque adicional para revelar. Em retrato e paisagem, a mão e a identificação própria reservam espaço lateral para o poder; movimento reduzido remove a transição.

A projeção de poderes mantém `power: null` nos assentos alheios até uma ativação pública aceita na mão, inclusive para o parceiro. Somente o dono recebe a atribuição ainda não usada. O campo nulo também cobre ausência de poder nas especiais; a UI usa o tipo da mão para distinguir “Poder oculto” de “Sem poder”. Reconexão reaplica a projeção por destinatário, sem um snapshot público enriquecido no cliente. A UI lista poderes revelados e as ativações, preservando a carta própria.

A seleção de poder é local, ligada a partida/mão/decisão/atribuição/prontidão e descartada ao pausar ou mudar o contexto. Esc, botão de cancelamento ou novo clique no poder cancelam sem comando; foco retorna ao poder quando o cancelamento parte de um alvo. A instrução fica junto da mão; retratos baixos e paisagem compacta usam a área de status existente para preservar a mesa. Controles de carta coberta não aparecem durante a preparação; a barra de passe se compacta em paisagem. Clique numa carta de troca envia `PREPARE`; Impulso/Máscara continuam atômicos com `PLAY_CARD`. Não há mudança de autoridade ou protocolo.

No Espião, os versos continuam anônimos: o clique escolhe o adversário e a posição visual de apresentação da observação, sem escolher uma identidade física nem enviar um índice de carta ao servidor. A carta aleatória continua sendo determinada pelo servidor e revelada somente após resolver a preparação. A face ocupa o verso clicado e permanece em um dos slots restantes após outra carta aberta ser jogada. Se esse índice deixar de existir, a face ocupa o último slot. Quando há uma jogada ainda opaca do alvo, a UI mostra separadamente a memória textual “Visto”, com aviso de que pode já ter sido jogada. Esse deslocamento depende apenas da opacidade pública da jogada, sem analisar sua identidade oculta. Reconexão restaura a observação da projeção privada; a posição visual pode voltar ao primeiro verso. Nenhum ID permite rastrear uma carta mascarada/coberta.

## HUD de turno e poder consumido

A carta de poder é renderizada enquanto o próprio assento não tem `used` confirmado na projeção. Seleção, intenção selada ainda pendente e rejeição não a removem. O indicador de energia permanece no dock, e Espião mantém a face privada na mão adversária/memória histórica. Na mão seguinte, a nova atribuição volta a aparecer. Não há mudança no sorteio, consumo ou sigilo do servidor.

O status da partida fica no topo, abaixo do placar, com tipo de mão e tempo estimado quando aplicável. O avatar próprio recebe “Sua vez” somente em TURN do próprio assento, partida ativa e sem pausa. A coluna de ações remove o painel redundante “Jogar carta”; Truco e decisões mantêm alvos de toque de pelo menos 44 px, em tamanho compacto. A mão continua sendo o alvo de clique/toque para jogar, com teclado e bloqueios existentes.

## Proporção das cartas de jogo

Faces e versos compartilham `--playing-card-ratio: 2 / 3`, compatível com a arte original do verso (1024×1536). Slots da mão, assentos, mesa e vira usam aspect-ratio e altura automática; regras responsivas ajustam somente a largura, com limites proporcionais à altura da tela quando necessário. O verso usa contain para preservar a imagem. A observação do Espião, inclusive a face ampliada no celular, usa a mesma proporção; a área clicável de alvo permanece independente, com pelo menos 44×44 px. As rotações decorativas dos versos não mudam sua caixa de layout nem revelam identidades.

A observação do Espião no assento é removida quando as jogadas autorizadas do alvo (vaza atual ou concluídas) contêm a mesma carta, comparando assento, valor e naipe. A condição é derivada do snapshot, inclusive após reconexão, sem estado de rastreamento adicional. A contagem pública zero também remove a observação. Uma carta diferente ou uma jogada ainda opaca não a remove nem revela identidades privadas.

O destaque da carta vencedora usa o `nextLeader` da vaza confirmada, sem marcar vencedora em empate: cresce até 20%, treme por 900 ms e permanece 12% maior até terminar a apresentação autoritativa. O áudio de resultado existente inicia no mesmo snapshot, respeitando volume/mute e sem repetir em SYNC; o som/aviso do turno aguarda a liberação pelo servidor. A faixa de resultado ocupa o painel superior para não encobrir as cartas. Movimento reduzido mantém somente contorno e brilho estáticos. A faixa “Sua vez” tem largura e título cerca de um terço menores; a legenda mantém tamanho legível.

A vela independente do menu usa uma única instância do PNG original, sem recortes. Um filtro SVG local combina ruído com máscara de intensidade gradual: somente o topo da chama recebe deslocamento, que chega a zero acima do pavio. A animação declarativa altera a intensidade, enquanto o halo pulsa via CSS; não há estado React por frame ou timers. A proporção 477:512 acompanha a decoração. Movimento reduzido desativa filtro e halo animado. A camada continua sem interação e oculta para tecnologias assistivas.

A composição de menu recupera as bordas diagonais densas da referência anterior com quatro PNGs transparentes `border-*`, contendo madeira e tecido. Props reutilizam assets separados em âncoras de canto/lateral; não há retorno ao background monolítico. `MenuScenery/composition.css` organiza densidade, símbolo e molduras, e os breakpoints preservam acesso aos controles em retrato/paisagem. Logo e imagem original da vela permanecem preservadas.

A renderização da vela passou para SVG com viewBox 477×512: a imagem raster original permanece única, e as primitivas do filtro usam coordenadas explícitas dessa arte. A máscara é gerada internamente por feFlood/feGaussianBlur e limitada acima do pavio. A saída combina a ponta deslocada com o restante original; ciclo declarativo de 1,6 s. Isso substitui o feImage usado como máscara e o filtro aplicado à imagem HTML, cujo efeito anterior ficou imperceptível.

As cartas de poder usam quatro artes completas 2:3 em `art/layers/power-card-*.png`, reproduzindo a referência de molduras douradas, faixas e pergaminho. Nome, custo e efeito permanecem HTML acessível sobre áreas vazias da arte; disponibilidade fica fora da carta. Miniaturas ocultam o efeito no celular, mantendo consulta pelo painel existente. A carta decorativa do menu compartilha a mesma composição.

O lobby remove o bloco de convite redundante, mantendo o link copiável. No desktop, espaçamento, avatares e áreas de ação se adaptam à altura; ajustes de tempo ficam em três colunas, e o catálogo de poderes expande sobre o painel com rolagem própria, sem esticar a página. O mobile preserva o empilhamento e a rolagem natural. As molduras e os cards de equipes são preservados.

Cartas jogadas ocultas usam variantes públicas de `CardBack`: Máscara tem verso roxo, símbolo de máscara e “Vale força”; coberta usa a arte original do verso, sem símbolo ou texto sobreposto. Versos das mãos continuam genéricos. As variantes dependem somente de `power`/`covered` da projeção, nunca da identidade oculta. Descrições acessíveis explicam a diferença; faces autorizadas de Máscara mantêm contorno roxo.

O menu de sala durante a partida usa `RoomMenu`: painel opaco com feltro discreto e moldura compartilhada do lobby, som, retorno e confirmação de desistência. Escape/fechar restauram foco ao acionador; Tab permanece nos controles do painel. Desistência envia `SURRENDER`, nunca `LEAVE` durante jogo ativo; após o resultado, a saída usa o fluxo existente com confirmação do servidor. Sem conexão, desistir fica desabilitado, mas o painel ainda pode fechar.

POST `/api/guest` passa a atualizar o apelido validado da sessão existente, preservando token, identidade e expiração. O nome vale para novas entradas/criações; assentos já ocupados preservam seu snapshot. Isso evita que criar/entrar devolva o apelido anterior após uma edição no menu.

`shared/EnergyIcon` fornece o raio pixelado em SVG para custo dos poderes, reserva de energia e carta decorativa. O desenho é independente da fonte; números e rótulos acessíveis continuam nos componentes de origem. O SVG é decorativo e preserva proporção nos diferentes tamanhos de carta.

O perfil do menu usa `profile-frame.svg` como borda em nove partes e `avatars-pixel.png` como atlas 2×2 compartilhado com os assentos. O botão de lápis foca e seleciona o campo de apelido existente; respeita o estado ocupado e mantém o mesmo fluxo de persistência.

A face do Espião usa `power-card-spy-character.png`, com personagem encapuzado, medalhão central e cápsula de energia à direita. As posições de custo/título/efeito são especializadas em `.power-spy`; textos e valores continuam em HTML, derivados do catálogo. A decoração do menu compartilha a mesma face.

### Sequência final após a última carta

Quando uma partida observada ao vivo termina por pontos e contém uma última vaza resolvida, `MatchResult` mantém a mesa desobstruída por 1800 ms (`reading`). A carta vencedora continua marcada pelo `nextLeader` público mesmo sem `transition`. Depois começa a apresentação de resultado por 5000 ms: confetes para vitória natural e explosão radial de 24 partículas em pixel art para derrota por pontos. Só então aparece o diálogo com as ações. O intervalo inicial não se aplica a desistência/abandono ou encerramentos sem vaza final; primeira carga já encerrada continua abrindo diretamente o diálogo.

Os dois estágios são canceláveis, não reiniciam em SYNC/desconexão e rejeitam callbacks de um estágio ou partida anterior. O foco vai ao título somente depois da leitura da mesa. Movimento reduzido oculta partículas, mantendo os intervalos e informação textual. Nenhum timer do servidor, pontuação ou comando foi alterado. Esta sequência substitui o início imediato da apresentação descrito anteriormente.

### Tutorial e internacionalização incremental

`features/menu/components/Tutorial` abre pelo menu como diálogo em portal, com sete etapas, perguntas de prática e demonstração de vira/manilhas. Usa apenas exemplos públicos locais, sem sessões, comandos ou dados de partida. O ciclo visual de ranks é pedagógico; não substitui comparação autoritativa. Imagens reaproveitam assets do jogo e textos permanecem HTML. O fundo fica inerte; Escape, fechamento e conclusão restauram foco ao botão, e a navegação mantém o título e o rodapé acessíveis com scroll interno.

`Tutorial/Guided` adiciona uma mesa local de treino em 17 etapas, acessível pelo guia. `lessons.ts` descreve cenários pedagógicos fixos; `Scene.tsx` monta o mesmo `Table` da partida e a mesma composição `app-shell/game-shell`, sem mesa ou estilos alternativos. `scenario.ts` fornece snapshots públicos de demonstração, sem transporte. O balão flutua ancorado ao elemento real (mão, vira, placar, carta, energia ou alvo), com spotlight; `useAnchor` observa resize, viewport e expansão da carta de poder, enquanto `placement` evita cobrir o alvo e limita o balão ao viewport. A seta acompanha o centro do alvo mesmo quando o balão encosta na margem. Controles de saída/idioma ficam dentro do balão. A etapa de força exibe dez faces `CardFace` sobre a mesa, em ordem crescente, usando o mesmo desenho/proporção das cartas da partida; o guia se ancora nessa sequência. Desktop dispõe uma fileira e retrato compacto usa duas, sempre com as dez cartas visíveis. Não importa o motor, cria sessões ou emite comandos: não é uma segunda implementação autoritativa das regras. Ações destacadas liberam o avanço e apresentam explicações de vitória/derrota e custos. Voltar e recomeçar reiniciam o exercício; não há relógio nem persistência do progresso. A área de explicação rola internamente no mobile, com navegação sempre acessível, foco contido e movimento reduzido respeitado. Textos do treino ficam em `shared/i18n/guided.ts`, agregados por `game.ts`.

`shared/i18n` centraliza a interface inteira em português e inglês: menu, perfil, lobby, mesa, cartas/poderes, resultados, dicas, erros de transporte, áudio, ferramentas de desenvolvimento e tutorial. `game.ts` agrega os catálogos de mensagens de interface/mesa/feedback; a frase de origem em português é uma chave tipada, com placeholders posicionais para nomes e valores. `tutorial` e `raises` mantêm seus contratos próprios. Nunca traduza apelidos, códigos de sala, ranks ou valores do protocolo. Textos das cartas são elementos HTML sobre a arte, portanto acompanham o idioma.

A preferência `truco.locale` é global e reativa (`useSyncExternalStore`), com sincronização entre abas; `App` atualiza `html.lang`. Configurações abre idioma e áudio no menu/entrada/lobby; durante a partida, o seletor fica no menu da sala. O seletor do tutorial também altera o jogo inteiro, sem perder a etapa atual. Trocar idioma não remonta a partida, reseta seleções, dispara comandos ou reinicia animações. Falhas de storage mantêm a troca em memória; valores desconhecidos usam português. Dicionários no escopo do módulo resolvem suas traduções apenas no acesso para não congelar rótulos. Novos idiomas devem manter placeholders, IDs, custos e respostas equivalentes; os testes verificam esses contratos.

### Gritos de aumento

`shared/feedback/raises` identifica apenas propostas confirmadas consecutivas na mesma partida/mão. `RaiseAnnouncement` mostra TRUCOOOOOOO!! / SEEEIS! / NOOVE! / DOOOZE!! por 1800 ms, com letras independentes e faixa de impacto em CSS. A camada não captura ponteiro nem foco; valor proposto fica explícito. Aceitar substitui o pedido por DEEESCE!! e o valor aceito por 1800 ms; correr, pausa ou troca de contexto cancelam o efeito; novo aumento substitui o anterior e callbacks obsoletos não apagam o novo. Primeira carga, gaps de sequência e retomada não repetem gritos.

Os botões de contra-aumento mostram o próximo valor (6/9/12); no teto exibem o limite desabilitado. O botão de pedido também acompanha o próximo nível após um aumento aceito. Rótulos novos vivem em `shared/i18n/raises.ts`, com catálogo pt-BR/en selecionado pela preferência global. Valores e comandos autoritativos não mudam.

O sintetizador Web Audio produz quatro efeitos originais de aumento e um motivo descendente para aceite, com ondas dente-de-serra, envelopes curtos e motivos distintos, sem gravações externas ou fala sintética. O volume por nota é reduzido para compensar harmônicos e notas sobrepostas. Todos respeitam desbloqueio por gesto, volume, mute, desconexão e limpeza existentes. Os detectores de proposta e aceite confirmado alimentam o observador de áudio; aceite exige liquidar exatamente o valor pendente na mesma mão, sem disparar em contra-aumento implícito, corrida ou retomada. O som de aceite tem prioridade sobre o aviso sonoro de turno; movimento reduzido remove balanço/entrada, preservando texto por 1800 ms.

### Treino solo e ferramentas dev

[ADR 009](adr/009-solo-training-and-development-tools.md) registra a extensão autorizada. O serviço de ciclo de vida de salas agenda bot e timers na mesma fila; `solo/bot.ts` passa somente a projeção ao pacote game-sim. O bootstrap resolve flags independentes e bloqueia ferramentas fora de development. `solo/dev-tools.ts` recria uma mão consistente preservando o placar; o envelope e cache existentes impedem replay e contexto obsoleto. O frontend busca `/api/features` para habilitar Jogar e importa o painel condicionalmente apenas no Vite dev, exigindo também autorização da sala.


### Cenário modular da partida

`Table/Scenery` compõe piso, feltro repetível, moldura em nove partes, quatro arabescos e objetos independentes ancorados nos cantos. Usa assets de `art/table-layers/` derivados do fundo original preservado. `shared/ScenicCandle` reutiliza a mesma vela animada no menu e na mesa. O cenário não recebe projeção nem produz eventos: fica atrás da arena, inacessível e sem interceptar ponteiro. O tamanho da textura é fixo; cantos e objetos têm escala própria em retrato/paisagem. O layout e a autoridade das cartas reais permanecem nos componentes existentes.

### Materiais da interface da partida

`Table/Theme` aplica brasões de equipe, medalhão de aposta, molduras de nomes e faixas de ações, pergaminho do histórico e placas de madeira. Os PNGs transparentes em `public/art/table-ui` não contêm textos/valores; a UI continua derivando tudo das projeções e do i18n. Faces, versos, atlas dos poderes e regras de proporção permanecem em seus componentes originais. Cores das faixas são decorativas; rótulos e posições continuam identificando equipes e estados.

`TableHistory` começa compacto: três entradas recentes no desktop e a última no celular. O botão com `aria-expanded` expande o histórico público da mão, com rolagem interna; Escape recolhe sem enviar comandos. A lista acompanha o final enquanto o leitor está a até 2 px dele; rolar para cima preserva a posição nas atualizações e voltar ao fim retoma o acompanhamento. Nova mão ou alternância entre compacto/expandido volta à ação mais recente. Jogadas opacas continuam redigidas pela projeção. Não há armazenamento novo. Seleção de carta coberta conserva o checkbox nativo acessível, apresentado com uma miniatura do verso; Máscara mantém seu visual distinto.

Avisos de turno, resultados, aumentos e término reutilizam os materiais da mesa. Eventos, pausas, foco, áudios, respeito a movimento reduzido e autoridade do servidor permanecem nos componentes de feedback existentes.

`Table/Theme/nameplates.css` substitui as imagens dos nomes por molduras CSS de borda dupla dourada e cantos assimétricos. A altura acompanha o apelido completo, com quebra inclusive sem espaços; a descrição fica em linha separada. No celular, o assento superior reserva uma linha inteira para a identificação. `alignment.css` mantém a área útil das faixas de ações. Medalhão, placa de mão e status usam dimensões coordenadas por viewport para manter espaço entre os elementos.

O pergaminho reserva 14% da largura de cada lado para madeira e ornamentos. No desktop e no histórico expandido, `history-frame.css` renderiza o mesmo PNG com border-image em nove partes: a dobra inferior ocupa uma borda própria de 40 px, seguida de 8 px de respiro interno. Apenas o centro se expande; a rolagem fica dentro da área útil. Em paisagem compacta, a borda inferior usa 16 px. O acompanhamento da rolagem permanece inalterado.

No 1v1, `Table/Theme/tableau.css` reserva a altura da carta e da legenda em cada posição central, com intervalo de 16 px. As duas posições ficam em coluna em todas as telas, com a jogada local abaixo. No desktop, a identificação do assento superior fica ao lado da mão, liberando altura sem alterar as proporções das cartas.

`Table/Theme/heading.css` organiza o status e o assento superior em linhas consecutivas de grid no desktop e em paisagem, com 12 px entre eles. A altura real do texto participa do fluxo. O centro do 1v1 começa depois dessas linhas; `vertical-plays.css` mantém as jogadas em coluna e ajusta a escala à altura disponível. Em telas baixas, as legendas ficam ao lado das faces, sem alterar sua proporção. Molduras de nomes usam `fit-content`, limitadas à largura do assento. Alvos do Espião centralizam os versos na linha de toque sem esticar sua proporção.

`Table/Theme/truco-button.css` preserva a proporção do PNG da faixa com background-size 100% auto. O botão principal usa proporção 4:1, limite de largura e escala menor em celulares baixos; o contra-aumento ocupa uma linha inteira da grade de respostas em paisagem.

A face observada pelo Espião aceita clique/toque para ampliar a mesma carta autorizada em um diálogo nativo, mantendo proporção 2:3. O diálogo retém o foco, fecha por botão, Escape ou fundo e restaura o foco ao acionador quando ele ainda existe. A troca/remoção da observação desmonta a ampliação; a memória textual após jogada opaca não cria uma nova face na mão. Essa consulta local não envia comandos nem pausa os timers.

O valor 5 nas faces usa Manilha Card Numerals, uma derivação de um único glifo da Pixelify Sans Bold sob SIL OFL 1.1. Mantém as métricas, baseline e espessuras originais; topo reto e haste esquerda contínua distinguem o cinco de S. O asset é reproduzível por `tooling/fonts/build-card-five.py`. Não há SVG sobreposto: o valor continua texto, herda a cor do naipe e a rotação da quina inferior. Os demais caracteres usam a fonte original.

Descrições das cartas de poder permanecem visíveis também em retrato e paisagem mobile. Usam a área de pergaminho da arte, fonte Jersey 25 e tamanho proporcional à carta; Espião reserva uma área própria abaixo do medalhão. O título de Segunda Chance escala para não quebrar fora da faixa em celulares estreitos. Não altera dimensões das cartas ou interação de ativação.

Em celulares baixos, energia permanece no fluxo abaixo da carta de poder, sem posicionamento absoluto sobre a arte. Quando o texto de estado é ocultado por falta de altura, ele deixa de reservar espaço; a carta e seu selo inferior continuam inteiros, com separação da barra de energia.

No 2v2, a área das jogadas reserva um intervalo vertical entre a legenda superior e a face inferior. O espaço cresce por breakpoint sem distorcer as faces. Em retrato até 600 px de altura, as cartas da dupla ficam ao lado da identificação e as jogadas usam escala menor, preservando a proporção 2:3 e o espaço da mão local.
