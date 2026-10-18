# Testes, qualidade e verificação

Leia ao alterar comportamento, criar testes ou configurar ferramentas e CI. Selecione as regressões pertinentes à mudança; os comandos abaixo existem no bootstrap. Os testes atuais validam o ambiente e o motor de regras-base completo do M1 (cartas, distribuição, vazas, empates, apostas, onze, pontuação e projeções); o M2 acrescenta multiplayer real, sessões, timers e reconexão; poderes continuam pendentes.

## Testes obrigatórios

Use testes determinísticos e relógio falso; não escreva testes baseados em esperar segundos reais. Não substitua casos de regra por snapshots extensos de objetos.

| Área | Casos mínimos de regressão |
|---|---|
| Baralho | 40 identidades únicas, distribuição 1v1/2v2, todas as viras, ciclo 3->4 e todos os naipes de manilha |
| Vazas | Empate comum, duas cartas máximas da mesma dupla, empate entre duplas, todas cobertas, ordem do iniciador |
| Mãos | Cada linha da tabela de empates, término antecipado, corrida, placar único e nenhum turno após vitória |
| Apostas | Aceitar/correr/contra-aumentar, valor implícito, limite 12, equipe sem direito de aumento e retomada do turno |
| Especiais | Onze unilateral, 11×11, visibilidade de parceiro, ausência de poderes/regen e repetição após três empates |
| Poderes | Custos, teto de energia, uso único, alvos inválidos, expiração, Máscara com manilha e Impulso no teto |
| Preparação | Compromissos selados, timeout, duas trocas, Espião após troca e mesma resolução apesar da ordem de chegada |
| Privacidade | Projeção de cada assento, cartas cobertas/mascaradas, IDs opacos, erros, logs e snapshots de reconexão |
| Concorrência | Dois parceiros respondendo, duplicate ACK perdido, mesmo ID/outro payload, comando atrasado e timer obsoleto |
| Reconexão | Retomada, token inválido, conexão anterior, limite cumulativo de pausa, abandono e expiração de sala |

Acrescente testes de propriedade: conservação das cartas, energia entre 0 e 3, pontuação aplicada uma vez, ações ilegais sem mutação, uma carta por jogador/vaza, nunca jogar fora do turno e nenhuma carta privada vazando em estados gerados.

Testes de integração devem exercitar o servidor autoritativo com múltiplos clientes reais de transporte. E2E deve concluir partidas 1v1 e 2v2 em contextos de navegador isolados e cobrir convite, pronto, aposta, poder, reconexão e revanche. Inclua cenários mobile. Não chame quatro componentes locais ligados ao mesmo estado de teste multiplayer.

## Qualidade de código e verificação

Use tipos específicos e uniões discriminadas com tratamento exaustivo. Entradas são `unknown` até validação; não esconda falhas com `any`, casts duplos ou non-null assertions. Erros esperados têm códigos estáveis, sem stacks/segredos para o cliente. Código em inglês; documentação/UI/respostas em pt-BR. Comentários explicam decisões e invariantes.

Use Bun como gerenciador e executor dos scripts, conforme [architecture.md](architecture.md). Use Bun Test para unitários e integração, fast-check para propriedades, Happy DOM/React Testing Library para componentes e Playwright para navegador. Não instale Vitest em paralelo. Valide a execução das ferramentas com Bun no bootstrap e documente incompatibilidades concretas.

Use os scripts reais da raiz:

```sh
bun install --frozen-lockfile  # com bun.lock existente; gere o inicial com bun install
bun run lint
bun run typecheck
bun run test
bun run test:coverage
bun run test:integration
bun run test:e2e
bun run build
```

Não presuma que scripts já existem; crie-os ao implementar a infraestrutura pertinente, sem scripts vazios, testes ignorados ou `--if-present` para aparentar cobertura. Execute suíte afetada e verificações gerais viáveis; relate falhas prévias, comandos indisponíveis e restrições do ambiente.

CI valida lockfile, tipos, lint, testes com cobertura mínima e build das partes implementadas. Mudanças de dependências exigem revisão do lockfile e APIs verificadas na documentação oficial da versão usada. Não duplique ferramentas equivalentes.

## Cobertura do bootstrap

`bun run test` mantém tooling/domínio e DOM em processos distintos. As regressões atuais cobrem fronteiras de imports, ausência de ciclos entre workspaces, ambientes de tipos e renderização/interação/cleanup de um componente de teste. `bun run test:integration` verifica a fixture Hono/Bun e o servidor do produto com clientes HTTP/WS reais, cookies isolados, partidas e reconexão. As regras implementadas também têm testes próprios junto ao domínio.

O build atual contém o cliente React. `bun run test:e2e` inicia backend e preview, valida o HTML e conclui partidas 1v1/2v2 com convite, pronto, apostas, recarregamento/reconexão, revanche, desistência e saída em Chromium desktop e viewport mobile. Poderes entram nos E2E do M3. `bun run check` não inclui E2E; execute-o separadamente após `bun run test:e2e:install`. O instalador e o runner Playwright são executados com Bun 1.4.3; a instalação limpa foi validada após a atualização do runtime. CI declara esses passos, mas sua execução remota só poderá ser confirmada após publicação do repositório.

## Lint e atualizações

Use Biome para lint e formatação. `bun run lint` inclui também `bun run check:architecture`, que mantém as regras de imports e pureza via parser Oxc. As regressões exercitam o analisador e a configuração real de Biome (globais proibidos e hooks condicionais). Não reintroduza ESLint ou Prettier para essas funções.

Mantenha dependências diretas nas versões estáveis atuais compatíveis e fixadas exatamente. Confira peers, regenere `bun.lock`, execute os checks afetados e E2E quando houver mudança de runtime, build ou navegador. Não confunda versões fixadas reproduzíveis com dependências deliberadamente antigas.

## Cobertura mínima obrigatória

As regras de ignore excluem relatórios na raiz e nos workspaces, mas preservam `tooling/coverage/`, que contém código necessário ao runner e ao inventário. Uma regressão com Git real verifica que esses scripts e `.env.example` entram no versionamento, enquanto relatórios, dependências, builds e arquivos de ambiente reais ficam de fora. Uma execução local com arquivos não versionados não substitui validar uma cópia limpa do conteúdo preparado para o commit.

Todo comportamento implementado ou alterado deve ter testes com asserções de resultado, incluindo entradas válidas, rejeições e limites relevantes. A matriz de gameplay permanece obrigatória: atingir uma porcentagem não dispensa regras, privacidade, concorrência e reconexão.

O mínimo é **80% de linhas e 80% de funções por arquivo executável medido**, configurado nos `bunfig.toml` da raiz e do frontend. Bun não oferece aqui uma garantia equivalente para branches/statements; essas métricas não são anunciadas como verificadas. Casos de decisão continuam exigidos pela matriz e pela revisão.

`bun run test:coverage` agrupa unitários de tooling/core/servidor e integração HTTP/WS numa execução Bun de servidor, separando DOM e PostgreSQL em outros processos, com `text` e `lcov`. Unitários e integração usam o mesmo ambiente de servidor; o bootstrap importa o transporte real, portanto a execução conjunta mede seus comportamentos no conjunto completo de testes, sem duplicar medições parciais do mesmo arquivo nem excluir fontes. Cada execução com arquivos medidos deve cumprir a meta nativa por arquivo; cobertura alta em um módulo não compensa baixa em outro. Os relatórios ficam em `coverage/server`, `coverage/web` e `coverage/database`. O diretório é limpo antes da execução para evitar uso de relatórios antigos.

O comando também inventaria os arquivos executáveis em `apps/*/src` e `packages/*/src`, além do analisador de arquitetura já implementado, e falha quando algum não aparece em nenhum relatório. Isso impede que código não importado por testes fique invisível. Integração pode ampliar a verificação comportamental, mas não dispensa o mínimo em cada execução que mede o arquivo. Playwright roda separadamente; seus resultados não entram nessa porcentagem.

Testes/fixtures em diretórios de teste, declarações, arquivos só de tipos, configurações e infraestrutura do próprio runner de cobertura não contam no denominador. Código de produto não deve ser movido para essas categorias nem receber exclusões para alcançar a meta. Novas exclusões exigem justificativa explícita e revisão; nunca use imports sem asserções apenas para elevar a cobertura.

O domínio possui código executável de regras-base, composição e projeções medido na suíte unitária. Testes concluem partidas 1v1/2v2 por comandos puros, incluindo onze e 11×11; isso não comprova partidas multiplayer de navegador. Suítes sem fontes medíveis não representam 100% de cobertura; não crie código fictício para preencher relatórios vazios.

`bun run check` e o CI executam `test:coverage` em vez de repetir unitários e integração sem medição. Testes da política confirmam tanto a reprovação abaixo de 80% quanto a detecção de fontes sem relatório. É possível usar `bun run test` sem instrumentação durante o desenvolvimento; ele não substitui a verificação final de cobertura.

## Testes de banco

Siga [database.md](database.md): `test:database` e a execução completa de cobertura sobem somente o serviço PostgreSQL de testes. Nunca reutilize o banco de desenvolvimento. A suíte real verifica migração repetida, seleção de destino, seeds idempotentes e rollback, usando schemas exclusivos removidos no final. O CI requer Docker/Compose; ausência de banco não é convertida em teste ignorado ou sucesso.

A cobertura inventaria também os módulos de conexão, seleção de alvo, migração e execução de seeds. CLI, declaração do namespace e registro de tarefas são configuração/infraestrutura; não se excluem módulos de comportamento. Configurações e secrets de produção não são aceitos pelas ferramentas locais.

## Verificação do M1

`bun test packages/game-core` exercita o motor sem banco/rede. As regressões incluem contra-aumento com valor implícito, primeiro parceiro a responder, revisão antiga, posse de carta, encerramento antecipado, limite de placar com recompensa original, decisões de onze e repetição de 11×11 após três empates. Testes com fast-check verificam conservação das 40 cartas, ausência de mutação e rejeição de jogadas fora de turno; projeções geradas verificam que trocar informações ocultas não altera a visão não autorizada.

Os testes de projeção cobrem cada assento, histórico de cobertas, término e visibilidade de parceiro, incluindo campos secretos extras para testar a allowlist. Nenhum teste puro de M1 é anunciado como teste de autenticação ou concorrência de sockets; esses comportamentos têm regressões próprias no M2. Poderes e regeneração de energia ainda não existem. Os testes do motor não usam bots de produção nem consultam cartas alheias para escolher jogadas.

## Verificação do M2

Testes de aplicação usam `Ports` com relógio e agendamento falsos: verificam deadline exato, callbacks obsoletos, pausa cumulativa, retorno do tempo restante, decisões de equipe, carta automática mais fraca, corrida de aposta/onze, três timeouts consecutivos, reset por ação válida e salas esvaziadas por saída ou desconexão. Não esperam segundos reais. Testes de capacidade/filas e de sinks com erro protegem a autoridade contra falhas de clientes.

Integração usa o bootstrap real em portas efêmeras e sessões/cookies separados. Confirma privacidade por assento, resposta original após ACK perdido/reconexão, reutilização de ID com outro payload, primeira resposta entre parceiros, sockets substituídos, contextos de revanche e ACK de saída antes do fechamento. Testes de transporte também verificam origem, sessão expirada, payloads, filas, rate limit e clientes lentos. Playwright usa contextos independentes, não componentes compartilhando estado. Capturas desktop/mobile foram inspecionadas; o layout é funcional e o acabamento segue no M4.

As regressões de lobby verificam ingresso aparecendo no primeiro navegador sem reload, seleção de assentos ocupados ausente na UI e recusada pela autoridade sem mutação, movimentação para vaga livre e ressincronização ao retornar a uma aba com snapshot antigo. Recuperar foco/visibilidade solicita somente `SYNC`, sem repetir pronto, jogada ou aposta; fechamento remove os listeners. Os E2E acompanham o evento de carregamento do primeiro cliente para comprovar que a atualização não depende de refresh.

Na antecipação visual autorizada, testes DOM cobrem cartas abertas/cobertas, assentos relativos, histórico público, bloqueios e decisões especiais. O E2E exige ausência de overflow horizontal na entrada, lobby e mesa; em 1v1/2v2 verifica o jogador superior centralizado acima da área de jogadas e nenhum assento sobre a vira/manilha. Capturas incluem desktop, viewport móvel de 390 px e cartas após uma vaza. Essas verificações geométricas complementam a inspeção visual, sem substituir playtests ou uma auditoria completa de acessibilidade.

As regressões da composição em viewport completo verificam também ausência de overflow vertical durante a partida, mão/cartas e todos os controles de ações dentro da tela, antes e depois de jogar uma vaza. A mesma partida é redimensionada para retrato/paisagem no celular e resoluções desktop distintas. Testes DOM verificam o painel da sala fechado durante snapshots de jogo, abertura no término, revanche e saída aguardando ACK.

As regressões do menu/lobby cobrem botões futuros desabilitados, perfil de convidado, validação do código, abertura/retorno do painel de ingresso, convite inicial e cópia do link (sucesso, rejeição e API indisponível). O E2E entra com um convidado por código e os demais por convite, preservando clientes independentes. Capturas incluem menu e lobby em desktop, retrato e paisagem; verificações geométricas impedem que botões do menu cruzem o perfil ou o rodapé. Os testes não simulam chat, moedas, nível ou poderes inexistentes.

A composição do menu é comparada visualmente em 1567×882 e 1920×1080; o E2E verifica regiões proporcionais de logo, perfil, navegação e rodapé, além da coluna única em paisagem. Ícones decorativos ficam fora da árvore acessível; o perfil não anuncia progresso ou saldo fictício. A geometria não equivale a comparação pixel a pixel da arte gerada.

Os seis botões de navegação devem ter a mesma largura e altura em cada viewport. O E2E verifica ampliação discreta no hover e retorno ao tamanho original, incluindo opções desabilitadas; as estrelas aparecem somente ao destacar cada opção. Com movimento reduzido, o destaque preserva as estrelas sem ampliar o botão.

Integração HTTP real verifica criação de convidado/sala com os defaults locais de `localhost` e `127.0.0.1` nas portas autorizadas, rejeição de origens ausentes, portas não permitidas e domínios parecidos, além da substituição dos defaults por configuração explícita. O E2E abre `localhost` e exige criação de sala e conexão do lobby por WebSocket. Testes do cliente verificam mensagens específicas para falhas reconhecidas e respostas desconhecidas/malformadas sem ecoar dados arbitrários do servidor.

O E2E do lobby mede cores computadas dos textos principais, legendas, campos, equipes e botões, incluindo Iniciar partida desabilitado e habilitado e a visão de convidado. Exige contraste mínimo de 4,5:1, fonte mínima de 14 px e texto sem redução de opacidade nos elementos selecionados; gradientes opacos são avaliados pelas suas cores extremas. Painéis de texto devem ter fundos opacos para impedir interferência da ilustração. Capturas em desktop, retrato e paisagem complementam essas verificações; isso não equivale a uma auditoria completa de acessibilidade ou comparação pixel a pixel.

Na composição com controles pixel art, testes DOM verificam seleção de modo/preset, normalização, estado dos switches fixos e cópia do link com alternativa manual. E2E aguarda seleção confirmada pelo servidor após clique/teclado nos radios, confirma bloqueio para convidados e verifica os tempos fixos do competitivo. Os controles gráficos sem texto não entram na medição de contraste de texto; as legendas e opções visíveis entram. Captura adicional em 1567×882 permite inspecionar a composição aprovada.

Testes de preferência de apelido verificam leitura/escrita validada, exclusão ao apagar ou inserir valor inválido, armazenamento bloqueado, sessão confirmada, resposta malformada e corrida entre resposta atrasada e edição. O ambiente DOM limpa armazenamento entre testes. E2E recarrega antes de criar sala e remove o cookie depois, exigindo o apelido preenchido e HTTP 401 sem sessão; somente uma nova entrada obtém identidade válida. O armazenamento local desse fluxo contém apenas o apelido.

O E2E de assentos verifica alturas iguais dos cartões e áreas de ação na mesma posição relativa, com nomes longos, badges, confirmação/cancelamento de pronto e vagas livres. Mede também salas 2v2 completas, sem botões para assentos ocupados por outros jogadores, exigindo área mínima de toque e ausência de corte no texto dos botões. As resoluções cobrem 1567×882, 1024×768, 390×844, 320×568 e 844×390.

O lobby exibe o link completo em vez do código isolado na linha de convite. DOM verifica valor por origem, campo somente leitura, seleção ao focar e continuidade após sucesso/falha de cópia. O E2E usa esse link para identificar a sala e mantém ingresso por código e convite, contraste e ausência de overflow em desktop/mobile.

Na visão do convidado, DOM verifica a indicação de somente leitura vinculada ao fieldset desabilitado. E2E compara a aparência da opção selecionada com a do anfitrião, confirma bloqueio dos radios e preserva a cópia do convite. O contraste inclui a indicação adicional; capturas distinguem as duas permissões sem reduzir a legibilidade do painel inteiro.
