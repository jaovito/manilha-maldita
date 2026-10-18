# Testes, qualidade e verificação

Leia ao alterar comportamento, criar testes ou configurar ferramentas e CI. Selecione as regressões pertinentes à mudança; os comandos abaixo existem no bootstrap. Os testes atuais validam o ambiente e o motor de regras-base completo do M1 (cartas, distribuição, vazas, empates, apostas, onze, pontuação e projeções); o M2 acrescenta multiplayer real, sessões, timers e reconexão; o M3 acrescenta poderes e simulações.

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

O build atual contém o cliente React. `bun run test:e2e` inicia backend e preview, valida o HTML e conclui partidas 1v1/2v2 com convite, pronto, apostas, recarregamento/reconexão, revanche, desistência e saída em Chromium desktop e viewport mobile. Os E2E do M3 incluem preparação e ativações de poderes. `bun run check` não inclui E2E; execute-o separadamente após `bun run test:e2e:install`. O instalador e o runner Playwright são executados com Bun 1.4.3; a instalação limpa foi validada após a atualização do runtime. CI declara esses passos, mas sua execução remota só poderá ser confirmada após publicação do repositório.

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

Os testes de projeção cobrem cada assento, histórico de cobertas, término e visibilidade de parceiro, incluindo campos secretos extras para testar a allowlist. Nenhum teste puro de M1 é anunciado como teste de autenticação ou concorrência de sockets; esses comportamentos têm regressões próprias no M2. Aquela suíte-base não exercita poderes; as regressões específicas do M3 cobrem energia e poderes. Os testes do motor não usam bots de produção nem consultam cartas alheias para escolher jogadas.

## Verificação do M2

Testes de aplicação usam `Ports` com relógio e agendamento falsos: verificam deadline exato, callbacks obsoletos, pausa cumulativa, retorno do tempo restante, decisões de equipe, carta automática mais fraca, corrida de aposta/onze, três timeouts consecutivos, reset por ação válida e salas esvaziadas por saída ou desconexão. Não esperam segundos reais. Testes de capacidade/filas e de sinks com erro protegem a autoridade contra falhas de clientes.

Integração usa o bootstrap real em portas efêmeras e sessões/cookies separados. Confirma privacidade por assento, resposta original após ACK perdido/reconexão, reutilização de ID com outro payload, primeira resposta entre parceiros, sockets substituídos, contextos de revanche e ACK de saída antes do fechamento. Testes de transporte também verificam origem, sessão expirada, payloads, filas, rate limit e clientes lentos. Playwright usa contextos independentes, não componentes compartilhando estado. Capturas desktop/mobile foram inspecionadas; o layout é funcional e o acabamento segue no M4.

As regressões de lobby verificam ingresso aparecendo no primeiro navegador sem reload, seleção de assentos ocupados ausente na UI e recusada pela autoridade sem mutação, movimentação para vaga livre e ressincronização ao retornar a uma aba com snapshot antigo. Recuperar foco/visibilidade solicita somente `SYNC`, sem repetir pronto, jogada ou aposta; fechamento remove os listeners. Os E2E acompanham o evento de carregamento do primeiro cliente para comprovar que a atualização não depende de refresh.

Na antecipação visual autorizada, testes DOM cobrem cartas abertas/cobertas, assentos relativos, histórico público, bloqueios e decisões especiais. O E2E exige ausência de overflow horizontal na entrada, lobby e mesa; em 1v1/2v2 verifica o jogador superior centralizado acima da área de jogadas e nenhum assento sobre a vira/manilha. Capturas incluem desktop, viewport móvel de 390 px e cartas após uma vaza. Essas verificações geométricas complementam a inspeção visual, sem substituir playtests ou uma auditoria completa de acessibilidade.

As regressões da composição em viewport completo verificam também ausência de overflow vertical durante a partida, mão/cartas e todos os controles de ações dentro da tela, antes e depois de jogar uma vaza. A mesma partida é redimensionada para retrato/paisagem no celular e resoluções desktop distintas. Testes DOM verificam o painel da sala fechado durante snapshots de jogo, celebração antes do menu compacto no término, ausência de configurações durante jogo/final, revanche e saída aguardando ACK.

As regressões do menu/lobby cobrem botões futuros desabilitados, perfil de convidado, validação do código, abertura/retorno do painel de ingresso, convite inicial e cópia do link (sucesso, rejeição e API indisponível). O E2E entra com um convidado por código e os demais por convite, preservando clientes independentes. Capturas incluem menu e lobby em desktop, retrato e paisagem; verificações geométricas impedem que botões do menu cruzem o perfil ou o rodapé. Os testes não simulam chat, moedas, nível ou poderes inexistentes.

A composição do menu é comparada visualmente em 1567×882 e 1920×1080; o E2E verifica regiões proporcionais de logo, perfil, navegação e rodapé, além da coluna única em paisagem. Ícones decorativos ficam fora da árvore acessível; o perfil não anuncia progresso ou saldo fictício. A geometria não equivale a comparação pixel a pixel da arte gerada.

Os seis botões de navegação devem ter a mesma largura e altura em cada viewport. O E2E verifica ampliação discreta no hover e retorno ao tamanho original dos controles ativos; as estrelas aparecem somente ao destacar uma opção ativa. Opções desabilitadas permanecem atenuadas, sem ampliação ou estrelas, e oferecem o motivo em tooltip. Com movimento reduzido, o destaque ativo preserva as estrelas sem ampliar o botão.

Integração HTTP real verifica criação de convidado/sala com os defaults locais de `localhost` e `127.0.0.1` nas portas autorizadas, rejeição de origens ausentes, portas não permitidas e domínios parecidos, além da substituição dos defaults por configuração explícita. O E2E abre `localhost` e exige criação de sala e conexão do lobby por WebSocket. Testes do cliente verificam mensagens específicas para falhas reconhecidas e respostas desconhecidas/malformadas sem ecoar dados arbitrários do servidor.

O E2E do lobby mede cores computadas dos textos principais, legendas, campos, equipes, botões ativos e a visão de convidado. Exige contraste mínimo de 4,5:1, fonte mínima de 14 px e texto sem redução de opacidade nesses elementos; gradientes opacos são avaliados pelas suas cores extremas. Ações desabilitadas, incluindo Iniciar partida, verificam a opacidade de 0,25 solicitada pelo proprietário e a presença de motivo; a explicação no tooltip mantém fundo opaco e contraste de 4,5:1. Painéis de texto devem ter fundos opacos para impedir interferência da ilustração. Capturas em desktop, retrato e paisagem complementam essas verificações; isso não equivale a uma auditoria completa de acessibilidade ou comparação pixel a pixel.

Na composição com controles pixel art, testes DOM verificam seleção de modo/preset, normalização, estado dos switches fixos e cópia do link com alternativa manual. E2E aguarda seleção confirmada pelo servidor após clique/teclado nos radios, confirma bloqueio para convidados e verifica os tempos fixos do competitivo. Os controles gráficos sem texto não entram na medição de contraste de texto; as legendas e opções visíveis entram. Captura adicional em 1567×882 permite inspecionar a composição aprovada.

Testes de preferência de apelido verificam leitura/escrita validada, exclusão ao apagar ou inserir valor inválido, armazenamento bloqueado, sessão confirmada, resposta malformada e corrida entre resposta atrasada e edição. O ambiente DOM limpa armazenamento entre testes. E2E recarrega antes de criar sala e remove o cookie depois, exigindo o apelido preenchido e HTTP 401 sem sessão; somente uma nova entrada obtém identidade válida. O armazenamento local desse fluxo contém apenas o apelido.

O E2E de assentos verifica alturas iguais dos cartões e áreas de ação na mesma posição relativa, com nomes longos, badges, confirmação/cancelamento de pronto e vagas livres. Mede também salas 2v2 completas, sem botões para assentos ocupados por outros jogadores, exigindo área mínima de toque e ausência de corte no texto dos botões. As resoluções cobrem 1567×882, 1024×768, 390×844, 320×568 e 844×390.

O lobby exibe o link completo em vez do código isolado na linha de convite. DOM verifica valor por origem, campo somente leitura, seleção ao focar e continuidade após sucesso/falha de cópia. O E2E usa esse link para identificar a sala e mantém ingresso por código e convite, contraste e ausência de overflow em desktop/mobile.

Na visão do convidado, DOM verifica a indicação de somente leitura vinculada ao fieldset desabilitado. E2E compara a aparência da opção selecionada com a do anfitrião, confirma bloqueio dos radios e preserva a cópia do convite. O contraste inclui a indicação adicional; capturas distinguem as duas permissões sem reduzir a legibilidade do painel inteiro.

## Verificação do M3

Testes puros cobrem sorteio independente/espelhado, energia, teto, bloqueios em especiais, compromissos selados, ordens de chegada diferentes, duas trocas, Espião depois das trocas, conservação das 40 cartas e projeções sem vazamentos. Impulso preserva identidade/classe comum, rejeita manilha/3/coberta e uso repetido; Máscara fica oculta até a resolução e continua oculta após corrida. Propriedades geradas verificam conservação e limites de energia em lotes de preparação.

A aplicação usa relógio falso para deadline exclusivo da preparação, passe somente de pendentes, manutenção de ID/deadline, contexto obsoleto, reconexão, ACK original e proteção somente de assentos ainda necessários. Integração HTTP/WS real usa quatro sessões independentes nos dois presets, compromissos feitos na mesma revisão, sigilo antes do fechamento, resultados privados, reconexão e partida completa. E2E em Chromium conclui partidas e envia as intenções pela interface; a cobertura numérica continua sendo medida separadamente.

`game-sim` executa e testa os mesmos cenários repetidamente, braços com/sem poderes e troca de assentos/equipes. Testes verificam finalização, reprodução, limites, resultados agregados e políticas com observações autorizadas. `bun run simulate 30` é uma experiência sintética, não teste de carga, relógio de produção, balanceamento definitivo ou playtest humano. O [relatório](simulation-m3.md) explicita o tamanho amostral e a incerteza.

As regressões da carta de poder verificam preparação inicialmente recolhida, abertura explícita, seleção/deseleção de poder de turno, seleção de alvos diretamente na mesa, passe sem ativação, energia insuficiente, uso anterior, pausa, término, janela incorreta e especiais. Botão/Esc fecham detalhes com retorno de foco; outro contexto fecha o painel e invalida a seleção anterior. O E2E ativa a carta pela interface e exige que, quando revelada, ela permaneça inteira no viewport sem sobrepor as cartas da mão nas resoluções exercitadas.

Ao modificar layout, a validação final inclui `playwright-cli` no fluxo real, com capturas inspecionadas visualmente em desktop e celular. Para a carta de poder, o E2E exige arte quadrada, custo dentro da ilustração, título sem overflow e ausência de sobreposição com mão, assentos, vira e ações. A inspeção visual cobre também títulos longos e orientação horizontal; medições não substituem essa revisão.

A carta recolhida à esquerda tem regressões E2E para a manga parcial em ponteiro fino, revelação completa por hover e foco sem ativação/abertura dos detalhes, exibição integral em toque e posição à esquerda da mão. A geometria é verificada com a carta revelada, incluindo energia, identificação própria, menu da sala e conexão, para que o recorte não esconda colisões. A inspeção final com `playwright-cli` compara repouso, hover e versões mobile.

Regressões de sigilo dos poderes cobrem 1v1/2v2, dono/parceiro/adversário/projeção pública, não interferência ao trocar atribuições ocultas, preparação ainda selada, todas as quatro ativações, rejeição, fim da mão/partida e ocultação da atribuição seguinte. Integração HTTP/WS verifica os snapshots individualizados nos dois presets, inclusive reconexão antes e depois da preparação. DOM distingue poder oculto de poder ausente e revela somente a ativação recebida.

O fluxo direto de poderes tem regressões DOM para clique no poder e na própria mão, cartas inelegíveis do Impulso, ausência de selects/painéis no caminho de seleção, cancelamento/foco, pausa e contexto novo. Espião aceita somente versos adversários, espera o resultado do servidor, mostra a face no verso escolhido e mantém uma observação histórica após uma jogada mascarada, sem atualizar os versos restantes por identidade. Reconexão restaura a face autorizada e uma projeção sem intel não a renderiza. O E2E ativa preparação clicando na mesa, mede alvos adversários de pelo menos 44×44 px e verifica que somente clientes com Espião têm a observação privada. As verificações de geometria são complementadas por `playwright-cli` em desktop, retrato normal/baixo e paisagem.

A geometria durante a seleção é exercitada separadamente da mesa em repouso: mão e ações não podem se sobrepor, o aviso deve permanecer no viewport e os alvos do Espião não podem cobrir vira nem apelidos. O helper alterna retrato normal, 320×568 e paisagem nos clientes mobile, preservando o estado de seleção, e mede hitboxes mínimas de 44×44 px.

## Verificação do incremento audiovisual do M4

Relógio falso verifica fronteiras de distribuição/vaza/mão, ausência de tempo de decisão durante apresentação, retomada com prazo inteiro mesmo em callback atrasado, reconexão sem antecipar gasto de proteção, rejeições/duplicatas, cancelamento por desistência e callbacks obsoletos. Integração HTTP/WS real observa `transition` em sessões distintas, conserva privacidade e aguarda prazos reais.

DOM cobre bloqueios de cartas/preparação/poderes durante apresentação, desistência disponível, resultado e destaque baseados na projeção autorizada, explicações de empate/manilha/Impulso/Máscara/corrida e próxima vez inclusive para o mesmo assento. Os versos decorativos de distribuição não consultam cartas alheias. Testes de áudio usam um port Web Audio falso para validar notas agendadas, desbloqueio, mute/volume, falha de dispositivo/storage, limpeza e silêncio de primeira carga/SYNC/reconexão; não equivalem a avaliação auditiva humana.

O E2E audiovisual usa dois contextos de navegador reais, resolve vaza pela interface, exige apresentação e bloqueio nos dois clientes, observa a retomada pelo iniciador autorizado e encerra uma mão por corrida. Movimento reduzido deve desativar animações computadas; a preferência de som deve sobreviver ao reload. Capturas e inspeção final via `playwright-cli` complementam essas verificações em desktop, retrato normal/baixo e paisagem. O [roteiro humano](playtest-m4.md) registra avaliação de clareza, ritmo e diversão ainda pendente.

O anúncio central “SUA VEZ!” tem regressões DOM com agendamento controlado: 2,4 s, expiração, primeira decisão própria, nova vaza pelo mesmo assento, nova mão/revanche, SYNC sem reiniciar, negociação/pausa sem repetir, turno adversário, término, callbacks antigos e cleanup inclusive no replay de efeitos do React. A integração com Table confirma envio imediato da carta durante o aviso. E2E e inspeção visual devem verificar tamanho/limites em desktop/celular, ausência de interceptação de cliques e versão estática com movimento reduzido.

Resultados relativos têm testes de áudio para os quatro assentos, 1v1/2v2, vitória/derrota/empate e prioridade partida > mão > vaza no mesmo comando; tons ascendem/descendem de forma distinta e respeitam volume/mute. DOM cobre título e legenda de vaza/mão, vencedor/perdedor, final natural de 12 pontos, intervalo de 5 s antes do menu sem flash de botões, três ações finais sem lobby/configurações, permissões do anfitrião, perda de conexão, foco/Tab/Shift+Tab e replay de efeitos React, rejeição de celebração em abandono/desistência/score insuficiente, resultado neutro, 48 partículas, expiração em 5 s, reconexão sem replay, revanche, unmount e callback obsoleto. E2E exige resultados corretos em clientes independentes, celebração sem menu Sala/botões seguida do diálogo compacto, pronto obrigatório após Revanche ou Voltar ao lobby, confetes só nos vencedores, movimento reduzido sem partículas animadas, expiração e reload sem repetir. Capturas reais de final e resultado da rodada em desktop/celular complementam a validação; síntese testada não equivale à avaliação auditiva humana.

## URL configurável do backend

Regressões do transporte verificam fallback para proxy local, HTTP/WS e HTTPS/WSS, remoção de barra final e rejeição de protocolos, caminhos e credenciais na origem configurada. HTTP mantém credentials=include. Integração exercita preflight sem sessão, cookies e respostas de erro com CORS para origem autorizada, ausência de permissão para origens estranhas e preservação da rejeição no handshake WS. Para verificar o build com backend separado, execute o fluxo de `local-origin.e2e.ts` com `VITE_BACKEND_URL=http://localhost:3002`, frontend em localhost:4273 e backend permitindo essa origem; o proxy padrão aponta a outra porta, portanto não mascara falhas na configuração.

## HUD e remoção da carta usada

DOM verifica os quatro poderes: seleção/rejeição/preparação pendente mantêm a carta, `used` confirmado remove carta e detalhes, a energia permanece e a mão seguinte restaura a nova atribuição. A observação privada do Espião continua na mesa após a remoção. O selo “Sua vez” exige turno próprio ativo, desaparecendo em pausa, turno adversário, preparação, negociação e término. E2E exige status no topo, selo dentro do viewport e ausência do painel “Jogar carta”, além das regressões de alvo e geometria existentes. A inspeção final com `playwright-cli` cobre desktop, retrato 390×844 e 320×568, e paisagem 844×390 antes/depois do consumo real.

## Proporção das cartas

O helper E2E `card-proportions.ts` compara largura/altura computadas de cada face e verso com 2:3, com tolerância de 0,01 para arredondamento subpixel. A medição ignora a rotação decorativa dos assentos e exige dimensões positivas. É exercitado em preparação, mesa com jogadas e seleção direta dos poderes, incluindo observação do Espião. As verificações existentes preservam viewport, ausência de colisões e alvos de toque mínimos; `playwright-cli` complementa a medição com inspeção desktop, retrato normal/baixo e paisagem.

A regressão de descarte visual do Espião reproduz K de Espadas em 1v1/2v2: sai do assento quando jogado aberto, continua na mesa e não reaparece após resolver vaza ou reconectar. Valor/naipe/assento diferentes não removem a observação; coberta e Máscara ainda opacas mantêm o mesmo comportamento, e a revelação posterior da Máscara remove a memória. Mão vazia não exibe carta observada.


## Primeiro acesso e motivos de bloqueio

DOM verifica boas-vindas sem apelido válido, foco inicial, validação pelo schema (vazio, espaços, caracteres inválidos e limite), confirmação por formulário, trim e gravação somente depois de confirmar. Apelido salvo e sessão válida dispensam a etapa; edições posteriores e exclusão da preferência preservam o menu atual. Resposta atrasada não sobrescreve o rascunho nem entra em convite com apelido antigo; código do convite continua disponível após confirmar. Storage bloqueado permite continuar na visita sem autenticar localmente. Confirmar o apelido não faz POST de convidado: identidade continua sendo responsabilidade do servidor.

Os E2E de entrada usam o fluxo real de confirmação, com reload, perda/retomada de cookie e convite em contextos distintos. Botões de ação indisponíveis devem ter opacidade reduzida, sem brilho/ampliação; tooltips opacos preservam contraste e explicam o motivo atual sem disparar comandos. Cartas continuam legíveis fora da vez. A opacidade proposital dos botões desabilitados não dispensa contraste de texto normal, controles ativos e tooltips. Inspeção por `playwright-cli` deve incluir primeiro acesso, menu e tooltip no desktop e no celular.
