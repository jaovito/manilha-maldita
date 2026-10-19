# Plano de desenvolvimento — Manilha Maldita

## Estado atual

O repositório contém documentação, apresentação HTML e bootstrap com cinco Bun Workspaces, dependências fixadas, TypeScript estrito, Biome e checagem de fronteiras, formatação, testes de ambiente e configuração de CI e infraestrutura local PostgreSQL/Drizzle com migrações e seeds transacionais. O motor de regras-base do M1 está concluído e testado: cartas, distribuição, vazas, apostas, onze, pontuação, ciclo completo de partida e projeções autorizadas. O M2 acrescenta servidor autoritativo HTTP/WS e cliente React com lobby e mesa DOM jogável. A apresentação HTML da raiz continua um artefato conceitual separado. O código passou a ser versionado em Git; o histórico dos incrementos anteriores está registrado neste plano.

M1, M2 e M3 concluídos nos respectivos escopos. Já é possível jogar partidas privadas com energia, preparação selada e quatro poderes no navegador, com duas ou quatro sessões distintas. O M3 acrescenta simulações pareadas. O M4 está em andamento: o primeiro incremento acrescenta feedback audiovisual e intervalos legíveis entre decisões; revisão ampla de acessibilidade e playtests humanos continuam pendentes. Concluir um marco não equivale a concluir todo o MVP.

## M4 — incremento 1: feedback audiovisual e compreensão dos resultados

### Refinamento: primeiro acesso e controles indisponíveis

A entrada sem apelido válido agora abre boas-vindas com apenas o campo Apelido e Continuar, foco inicial, confirmação por Enter e validação do schema. Rascunhos não são persistidos; confirmar salva a preferência sem criar sessão, e convites permanecem preenchidos. Apelido salvo ou cookie válido dispensa a etapa. Edições posteriores continuam no perfil; limpar não interrompe a visita, e storage bloqueado não impede continuar. Respostas antigas da sessão não sobrescrevem a escolha nem iniciam um ingresso com apelido anterior.

Botões de ação desabilitados recebem opacidade de 0,25 e motivo em tooltip, preservando faces de cartas legíveis enquanto jogar está bloqueado. A escolha visual foi explicitamente solicitada pelo proprietário; validação de permissões e regras continua no servidor. O bloqueio nativo foi mantido sem wrappers no layout, com descrições acessíveis e prioridade do motivo de reconexão. O portal opaco recebe hover/toque e foco dos poderes consultáveis; o tooltip nativo é suspenso enquanto o personalizado aparece. A revisão independente encontrou que a explicação precisava aceitar o ponteiro e scroll interno; isso foi corrigido, com tolerância cancelável de 120 ms ao atravessar o espaço entre controle e tooltip e cleanup do timer.

Validação local: `VITE_BACKEND_URL='' bun run check` aprovado com **278 testes** (154 servidor/core/tooling/integração, 114 DOM e 10 PostgreSQL), **79 fontes executáveis** medidas acima do mínimo de 80% por arquivo. Welcome, tooltip, posicionamento, atributos e motivos novos atingiram 100% de linhas/funções; lint/fronteiras, formato, tipos e build passaram. Permanecem os avisos de tamanho nos dois testes extensos já registrados.

Os **22 E2E** foram aprovados em Chromium desktop/mobile, incluindo primeiro acesso, rascunho, Enter, apelido salvo, cookie, convite, motivos por hover/toque e regressões completas de multiplayer/feedback/lobby. Vinte passaram na rodada principal; dois de tooltip foram repetidos após corrigir a suposição de que uma mudança de layout não deixaria o ponteiro sobre outra opção indisponível. Não se alteraram limites de produção. `playwright-cli` confirmou texto/controles inteiros em 1280×720, 390×844, 320×568 e 844×390; paisagem recebeu composição compacta para dispensar rolagem. Tooltips mantêm leitura ao entrar com o ponteiro e após toque completo. Convite e apelido salvo foram inspecionados em sessões reais. Sem deploy, CI remoto, Safari/iOS real ou avaliação com teclado virtual em dispositivo real; processos e ambiente do usuário preservados.

### Refinamento: encerramento em duas etapas

O término agora permanece na mesa por 5 s com o título central animado, resultado relativo e confetes pixelados exclusivos da vitória natural. A apresentação não abre Sala nem mostra botões/configurações; movimento reduzido preserva o intervalo com resultado estático. Depois aparece um diálogo compacto com placar/motivo e apenas Revanche, Voltar ao lobby e Sair da sala. Os dois primeiros preservam o fluxo autoritativo atual do anfitrião (`REMATCH -> lobby`, todos precisam confirmar pronto novamente); convidados aguardam o anfitrião e podem sair. Não há auto-ready nem reinício automático. O menu Sala durante jogo fica restrito à informação da sala e som.

A primeira carga de uma partida encerrada abre diretamente as ações; SYNC/reconexão não reiniciam o intervalo, e nova partida/unmount cancelam timers com proteção contra callbacks antigos. A mesa fica inerte atrás do resultado, o título recebe foco e o diálogo final contém a navegação por Tab. Nenhuma regra, projeção privada ou temporizador autoritativo foi alterado.

Verificação local deste ajuste: `VITE_BACKEND_URL='' bun run check` aprovado, com **262 testes** (154 servidor/core/tooling/integração, 98 DOM e 10 PostgreSQL), **74 fontes executáveis** medidas acima do mínimo de 80% por arquivo e `MatchResult` com 100% de linhas/funções. Lint/fronteiras, formato, tipos e build passaram; apenas os avisos de tamanho preexistentes permanecem. Inspeção com `playwright-cli` confirmou as duas etapas em sessões reais 2v2, nas perspectivas de vitória/derrota, em 1280×720, 390×844, 320×568 e 844×390. Os três botões cabem no viewport, inclusive no celular menor e paisagem. Os seis E2E afetados passaram (feedback e partidas completas 1v1/2v2, Chromium desktop/mobile), cobrindo as duas etapas, três ações, permissões, pronto e reload sem replay. Cinco passaram na rodada inicial; o caso desktop 2v2 foi repetido com fontes estáveis após um HMR durante a primeira execução reiniciar a apresentação local, e passou sem alterar timers ou testes. Tab/Shift+Tab foram inspecionados em sessões reais: três ações para anfitrião e somente saída habilitada para convidados. Processos e ambiente do usuário foram preservados; sem deploy, CI remoto ou Safari/iOS real.

### Refinamento: vitória, derrota e celebração da partida

Sons relativos agora distinguem vitória, derrota e empate de vaza/mão; o encerramento tem fanfarras próprias. O observador prioriza partida > mão > vaza para não duplicar resultados da mesma jogada e mantém silêncio em SYNC/reconexão. Avisos centrais mostram “VOCÊ VENCEU!” / “VOCÊ PERDEU” no 1v1 e “SEU TIME VENCEU!” / “SEU TIME PERDEU” no 2v2 durante a apresentação da rodada, com legenda de vaza/mão e cores da identidade.

Na primeira versão deste refinamento, o resultado ficava dentro do menu Sala com título destacado “VOCÊ VENCEU!!” ou “SEU TIME VENCEU!!”, placar e motivo. Apenas os vencedores recebem 48 confetes quadrados em ouro/feltro/vinho por 5 s; movimento reduzido oculta as partículas. A camada não intercepta controles, e o resultado permanece disponível com revanche/saída. Desistência, abandono e falha técnica não recebem confetes. Reload/SYNC não repetem a celebração; timers são cancelados em revanche/unmount e callbacks antigos não afetam outra partida. Os efeitos são sintetizados localmente e as frases são textuais.

Verificação local: `VITE_BACKEND_URL='' bun run check` passou **259 testes** (154 servidor/core/tooling/integração, 95 DOM e 10 PostgreSQL), lint/fronteiras, formato, tipos, cobertura e build. **74 fontes executáveis** medidas com mínimo de 80% por arquivo preservado; módulos novos de resultados tiveram 100% de linhas/funções. Permanecem os avisos de tamanho já registrados. Seis E2E afetados passaram em Chromium desktop/mobile (feedback e partidas completas 1v1/2v2), incluindo perspectivas, final natural, confetes só nos vencedores, expiração, movimento reduzido, SYNC/reload e revanche. Inspeção com `playwright-cli` em sessões reais confirmou confetes em queda e títulos inteiros em 1280×720, 390×844, 320×568 e 844×390; revanche/saída ficam acessíveis por rolagem interna. O fundo do menu final ficou opaco para evitar que o resultado antigo da mesa apareça nas lacunas. Lint, formato, tipos e build foram repetidos após os ajustes finais. Sem avaliação auditiva humana, Safari/iOS real ou CI remoto.

### Refinamento: anúncio central de turno

A pedido do usuário, cada novo turno próprio acionável agora mostra **SUA VEZ!** em uma faixa central grande por **2,4 s**, com entrada expressiva, contorno dourado e identidade pixel art. A faixa permite clique/toque através dela, não captura foco e não altera o timer; desaparece ao jogar, perder a vez, pausar ou encerrar. Nova vaza pelo mesmo assento anuncia novamente; SYNC, re-render, retomada de pausa e retorno da negociação da mesma jogada não repetem o aviso. Movimento reduzido conserva a faixa estática; status e selo de turno seguem visíveis depois dela sumir.

Verificação deste refinamento: lint/fronteiras, formato, tipos e build aprovados; `VITE_BACKEND_URL='' bun run test:coverage` passou **247 testes** (154 servidor/core/tooling/integração, 83 DOM e 10 PostgreSQL), com **71 fontes** acima do mínimo por arquivo. O componente novo atingiu 100% de linhas/funções; cinco regressões adicionais cobrem duração com timer controlado, cancelamento, deduplicação, nova vaza/mão/revanche, replay de efeitos React e carta enviada durante o aviso. Os dois E2E do M4 passaram em Chromium desktop/mobile, incluindo desaparecimento do aviso, ausência durante resolução e nova vez após vaza. O helper de snapshots ignora o socket HMR ao verificar Vite dev. Inspeção final com `playwright-cli` em dois clientes reais confirmou faixa grande/legível em 1280×720, 390×844, 320×568 e 844×390; na tela menor há 6,4 px entre faixa e cartas. Movimento reduzido mantém faixa estática; clique na carta durante o aviso foi aceito, e a faixa sumiu ao mudar o turno. SYNC após expiração não a reexibiu. Não houve alteração de regras, ambiente local do usuário ou dependências.

### Entrega inicial

- Trabalho dividido entre agentes de áudio, atmosfera/carteado e pacing autoritativo; integração, explicações e revisão pelo agente principal. Pedido autorizado: animações de distribuição, chama das velas, sons de interação/poder/turno e tempo para compreender resultados.
- Servidor: pausas fixas de distribuição **900 ms**, vaza **1.800 ms** e mão **2.400 ms**, iguais nos dois presets. `transition` informa apenas ID opaco/tipo/fim. Nenhum tempo de decisão ou proteção é gasto nesse intervalo; a próxima decisão abre no servidor com prazo completo. Reconexão não prolonga, duplicatas não reaplicam efeitos, desistência cancela e callbacks antigos não atravessam contexto. O sorteio seguinte aguarda o fim da apresentação da mão anterior. [ADR 008](docs/adr/008-authoritative-presentation-pauses.md).
- Mesa: distribuição com 6/12 versos decorativos e cartas reais surgindo ao terminar; velas com chama/brilho em pixel art alinhados à arte; entrada das jogadas e efeitos de Impulso/Máscara. Resultado usa temporariamente a região do placar e preserva as cartas resolvidas visíveis, destacando a vencedora. Textos explicam vitória/empate, manilha, Impulso/Máscara e precedência da mão; o próximo iniciador recebe aviso e selo “Sua vez” renovado mesmo quando mantém o assento. Histórico conserva explicações e ativações públicas, sem revelar atribuições não usadas ou informações privadas.
- Áudio: sintetizador Web Audio próprio e local para clique, menu, seleção, distribuição, poder confirmado, turno e resultado. Desbloqueio após interação, volume/desligamento, preferências locais validadas e falhas toleradas. Primeira carga, SYNC e reconexão não repetem histórico. “Som” fica visível no menu/lobby e dentro de “Sala” na partida. Movimento reduzido desativa carteado, chama e animações; texto e intervalo de leitura permanecem.
- React/DOM e CSS existentes foram preservados; não houve migração de renderizador, dependências novas, regras novas, poder extra, persistência de jogadores, analytics externo ou publicação. README, contratos, política da preferência `truco.audio` e [roteiro de playtest](docs/playtest-m4.md) atualizados.
- Verificação local final (18/10/2026): `bun install --frozen-lockfile` sem mudanças e `VITE_BACKEND_URL='' bun run check` aprovados: **242 testes** (154 servidor/core/tooling/simulação/integração, 78 DOM e 10 PostgreSQL), lint/fronteiras, formato, tipos, cobertura e build. **70 fontes executáveis** medidas, todas com pelo menos 80% de linhas/funções por arquivo, sem novas exclusões. Módulos de transição, explicações e atmosfera atingiram 100% nas duas métricas; síntese de áudio, 87,5% de funções e 100% de linhas. Permanecem avisos de tamanho em arquivos de teste e sinais de revisão de tamanho no serviço de sala/transporte.
- E2E: **14 casos aprovados em rodadas**, incluindo os 12 anteriores e dois novos do M4. Após as últimas correções de layout, seis casos foram repetidos com sucesso (feedback e partidas completas 1v1/2v2, desktop/mobile), em portas isoladas 3002/4273 e um worker. Uma repetição concorrente anterior atingiu o limite HTTP 429; a rodada serial final não atingiu esse limite e a proteção de produção não foi alterada. Configuração temporária removida; processos existentes não foram encerrados.
- Inspeção com `playwright-cli` em fluxo real de dois clientes: distribuição, estado normal, resolução e Sala/Som em desktop, retrato 390×844/320×568 e paisagem 844×390. Sobreposições de status/assento, Sala/status e selo/carta foram corrigidas; capturas finais de estado normal/distribuição foram inspecionadas. Movimento reduzido verificado no Chromium. Uma configuração local de backend passou a apontar para `192.168.1.1:3001`, inacessível durante a revisão final e herdada por dois testes antigos que esperam proxy relativo; a suíte final usou a variável vazia explicitamente, sem alterar o arquivo de ambiente do usuário.
- Limites: sem CI remoto, Safari/iOS real, avaliação auditiva em dispositivos ou playtests humanos. O [roteiro](docs/playtest-m4.md) não representa sessões executadas. M4 permanece aberto para essas avaliações e revisão ampla de acessibilidade; não houve push, deploy ou provisionamento.

## M3 — conclusão: energia, preparação selada, poderes e simulações

- Incremento de domínio: energia inicial 2, teto 3 e regeneração em mãos comuns após a primeira; sorteio independente casual e espelhado competitivo, quatro poderes, uso individual único e expiração por mão. Onze/decisiva preservam energia sem sorteio. Cartas, estoque e descartes conservam as 40 identidades.
- Preparação simultânea: compromissos definitivos validados, indicador pronto sem revelar escolhas/gastos, substituições sem reposição em ordem a partir do iniciador, Espião nas mãos finais e confirmação atômica do lote. Revisões simultâneas aceitas pelo contexto da preparação; deadline/ID preservados, timeout passa somente pendentes, proteção cumulativa e deduplicação mantidas. Cartas/pontos/energia/entropia não avançam em rejeições ou duplicatas.
- Incremento de aplicação/interface: Impulso/Máscara acompanham a carta atomicamente. Impulso não cria manilha nem aceita coberta/3/manilha; Máscara fica oculta até resolver a vaza e não revela por corrida. Snapshots e reconexão mantêm allowlists e informação do Espião apenas ao autor. Lobby contém catálogo, poderes obrigatórios nos dois presets e preparação configurável no casual (15 s default), fixa em 10 s no competitivo. Mesa mostra poderes/energia, alvos, ativações, seleção e resultado privado; o painel informativo permite rolagem própria no celular.
- Incremento de simulação: quinto workspace `game-sim`, com políticas conservadora/agressiva/probabilística limitadas à própria projeção, fontes independentes de entropia, comparação com/sem poderes e troca de assentos/equipes. `bun run simulate 30` concluiu **1.440 partidas sintéticas** em 12 estratos; [relatório](docs/simulation-m3.md) registra médias, incerteza e limites. Uso seletivo não é efeito causal individual; não houve ajuste automático de regras/custos.
- Verificação local (18/10/2026): `bun run check` aprovado com **195 testes** (141 servidor/core/tooling/simulação/integração, 44 DOM e 10 PostgreSQL), lint/fronteiras, formato, tipos, cobertura e build. **53 fontes executáveis** inventariadas, todas com no mínimo 80% de linhas/funções por arquivo, sem exclusões novas. Os dois módulos de poderes alcançaram 100% de linhas/funções medidas. Permanecem apenas os avisos anteriores de tamanho do teste `App.test.tsx` e revisão de tamanho do serviço de sala.
- `bun run test:e2e --config playwright.m3.config.ts` executado em configuração temporária com portas isoladas 3002/4273: **12 E2E aprovados** em Chromium desktop/mobile. Exercitam convite, pronto, preparação, ativação disponível de poderes, cartas, apostas, partidas completas 1v1/2v2, reconexão, revanche e saída. Capturas de preparação/mesa desktop/mobile foram inspecionadas; ação de poder precede sua explicação expansível para permanecer acessível no painel móvel. Configurações temporárias removidas após a execução; servidor local existente preservado.
- [ADR 007](docs/adr/007-sealed-powers-and-simulation.md) registra amostragem, autoridade e limites. Persistência continua fora deste incremento; salas/sessões se perdem em reinício. Sem push, deploy, provisionamento ou analytics externo. CI remoto, Safari/iOS real, playtest humano e efeito marginal individual de cada poder não foram verificados. O M4 continua aberto.

## M2 — histórico da conclusão: salas, autoridade, tempo e reconexão

- Salas privadas por código/link, sessão convidada sem cadastro, lobby com equipes alternadas, escolha de assentos livres, pronto e início pelo anfitrião; regras/configuração congeladas durante a partida; revanche preserva assentos/configuração e pede pronto novamente.
- Backend Hono/Bun com uma fila limitada por sala coordenando comandos, presença, timers e partida. Autenticação por cookie, associação de assento e invalidação da conexão anterior. Protocolo Zod estrito, contexto/revisão e ACK idempotente por sessão/partida/comando; rejeições sem avanço de carta, pontos ou entropia.
- Timers casual/competitivo, fallback determinístico, corrida automática, proteção cumulativa de reconexão, retomada do tempo restante, primeira resposta de parceiro, abandono após três timeouts e expiração de salas vazias sem vencedor. Relógio falso cobre limites e callbacks obsoletos.
- Proteção de origem, sessões expiráveis, limite de payload/fila/salas/atividade e saída para clientes lentos. Projeções completas individuais sem monte, cartas alheias ou identidades de cobertas. Não há logging de cartas/tokens/payloads.
- Cliente React funcional para criar/entrar, configurar, jogar, apostar, decidir onze, reconectar, pedir revanche e sair/desistir. Interface simples em verde/ouro; sem imagens geradas. Capturas de mesa desktop/mobile foram inspecionadas, e o acabamento pixel art segue no M4.
- Verificação final (18/10/2026): `bun install --frozen-lockfile` sem mudanças; `bun run check` aprovado com **142 testes** (120 servidor/core/tooling/integração, 12 DOM e 10 PostgreSQL), lint/fronteiras, formato, tipos e build. Cobertura por arquivo acima de 80% em linhas e funções, sem novas exclusões; inventário confirmou **35 fontes executáveis** medidas. Unitários e integração de servidor compartilham medição Bun; DOM e banco permanecem isolados.
- `bun run test:e2e`: **6 testes aprovados**, incluindo quatro partidas completas 1v1/2v2 em contextos independentes Chromium desktop/mobile, convite, pronto, aumentos, reload/reconexão, revanche, desistência e ACK de saída. Poderes não são simulados nem anunciados como testados. CI remoto e Safari/iOS real não foram executados.
- `bun run dev` validado iniciando backend3001 e frontend5173; `/health`200 e proxy de autenticação401 para novo convidado. Processo de desenvolvimento encerrado após verificação. ADR 006 documenta autoridade, retomada e operação. Sem deploy/push/provisionamento naquela entrega; o repositório foi versionado posteriormente.
- Limites: estado e sessões apenas em memória; reiniciar o processo perde salas como falha técnica, sem derrota registrada. Operação de uma instância e limites conservadores, ainda sem ensaio de carga/produção. Naquela entrega, M3/M4 permaneciam abertos.

## M1 — histórico da conclusão: apostas, onze e ciclo de partida

- `betting`: escala 1→3→6→9→12, aceite/corrida/contra-aumento, aceitação implícita, alternância de equipe e retomada do turno salvo.
- `match`: comandos validados por fase, turno, posse e revisão; uma carta por assento/vaza; pontuação única; recompensa original em evento; placar limitado a 12; nenhuma distribuição ou jogada após vitória. Novas mãos rotacionam o iniciador, inclusive após anulação.
- Onze unilateral: primeira decisão válida da equipe joga por 3 ou concede 1; aumentos bloqueados. 11×11: 3 pontos, só cartas próprias, sem corrida/aumentos/cobertas, repetição após três empates.
- `projections`: allowlists públicas/individuais; só a equipe de onze vê cartas do parceiro e mantém o conhecimento na mão. Cobertas continuam ocultas para terceiros no histórico e após encerramento. Monte e identidades ocultas não aparecem nas projeções.
- Validação final (18/10/2026): `bun run check` aprovado, incluindo `bun run test:coverage`, lint, formato, fronteiras, tipos, banco real, transporte HTTP/WS de bootstrap e build. **83 testes aprovados**, dos quais **38 do core**; nove arquivos executáveis do core com **100% de linhas/funções medidas**. Inventário confirmou os 14 arquivos executáveis esperados sem ausências. `bun install --frozen-lockfile` aprovado sem mudanças e `bun run test:e2e` aprovou mais 2 smoke tests Chromium desktop/mobile do HTML inicial.
- Entrega revisada em três frentes com subagentes: apostas, projeções e testes de composição; integração e checks globais confirmados pelo agente principal. ADR 005 documenta os limites de autoridade e a composição.
- Limites na entrega do M1: ainda não havia UI jogável, autenticação, fila por sala, ACK/deduplicação de transporte, timers, reconexão, poderes ou energia. O motor rejeita revisão antiga; a garantia de deduplicação por jogador/partida/comando entra no M2. E2E ainda não cobre partidas e CI remoto não foi executado. Helpers internos de encerramento não são API pública.

## M1 — histórico do incremento 1: cartas, vazas e empates

- Implementado em `packages/game-core`: 40 cartas, validação, força normal/manilhas, Fisher–Yates com escolhas explícitas, distribuição 1v1/2v2, resolução de vaza em ordem de assentos e encerramento da mão pela tabela de empates.
- Aceitação: conservar as 40 identidades, reproduzir entradas sem mutação, não desempatar comuns por naipe, preservar o primeiro parceiro com máxima e encerrar a mão assim que definida. Dezesseis testes determinísticos incluem propriedades com fast-check e entradas inválidas.
- Limites naquele incremento: eram funções puras internas, não um endpoint nem uma partida executável. Não validam posse da carta entre turnos, decisão de onze ou proibição de cobertas no 11×11; essas responsabilidades entram na composição do motor. Não há projeções nem envio de estado ao cliente.
- Verificação deste incremento (18/10/2026): `bun test packages/game-core`, `bun install --frozen-lockfile` e `bun run check` aprovados. O check executou lint/fronteiras, formatação, tipos, cobertura, integração HTTP/WS, banco real e build: 61 testes aprovados no total, incluindo os 16 novos de domínio. Os quatro arquivos de produção do core atingiram 100% de linhas e funções medidas; inventário sem fontes ausentes. E2E e CI remoto não foram executados neste incremento.
- As pendências daquele incremento (apostas, decisões especiais, pontuação e ciclo completo) foram resolvidas na conclusão do M1 acima.

## Verificação local do bootstrap

Executados com sucesso: instalação por `bun install --frozen-lockfile`, lint, formatação, typecheck, build do HTML inicial, 32 testes de tooling e política de cobertura, 2 testes React/DOM, 1 teste de integração HTTP/WebSocket e 2 testes Playwright (Chromium desktop/mobile). A configuração de CI ainda não foi executada remotamente. A meta de 80% de linhas e funções por arquivo medido está ativa em `bun run test:coverage` e `bun run check`; o inventário detecta fontes executáveis sem relatório. O analisador atual atingiu 96,85% de linhas e 100% de funções. Esses resultados não cobrem gameplay ou partidas multiplayer.

## Roadmap e definição de pronto

- [x] M1: bootstrap e motor testado: cartas, manilhas, vazas, empates, apostas e onze.
- [x] M2: salas, convidados, lobby, autoridade, 1v1/2v2, timers e reconexão.
- [x] M3: energia, sorteios, preparação selada, quatro poderes e simulações.
- [ ] M4: mesa responsiva, áudio, acessibilidade, E2E completo e playtests.
- [ ] M5: resultados, contas opcionais e cosméticos; ranking/experimentos depois.

Não espere acabamento para obter uma partida multiplayer jogável. Pronto exige comportamento funcional, regressões, verificações executadas quando possível, contratos/documentação atualizados e ausência de novos vazamentos ou corridas. Declare o que permanece não verificado; concluir um marco não equivale a concluir o jogo.

## Infraestrutura de banco local

PostgreSQL 18.6 de desenvolvimento e testes inicializados via Compose; migrações locais aplicadas e geração sem drift verificada. Registro de seeds de produto ainda vazio; fixtures reais de integração verificam repetição, upsert e rollback. Dez testes de banco foram executados com 100% de linhas/funções nos quatro módulos medidos. O check completo inclui essa suíte e exige Docker/Compose. Não foram criados modelos ou dados de produto para persistência. O motor M1 não depende de banco por jogada.

## Direção visual aprovada para M4

As referências enviadas em 18/10/2026 orientam pixel art com mesa de feltro verde escuro, madeira, cartas em pergaminho, molduras douradas e retratos/personagens de inspiração fantástica. Assets próprios podem ser gerados quando necessários. A referência é visual: os textos e valores de poderes nas imagens não substituem `docs/rules.md` (Segunda Chance troca carta; Impulso sobe um nível comum; Máscara oculta a próxima jogada). Nenhuma imagem foi necessária durante M1/M2; a geração e integração de assets ocorreu posteriormente, na antecipação visual autorizada abaixo.

## Antecipação visual autorizada

A pedido do usuário, entrada, lobby e mesa receberam o acabamento inspirado nas referências antes do M3. Foram gerados três assets próprios: mesa de feltro/madeira, atlas de quatro retratos e verso de cartas. Prompts e procedência estão em `apps/web/public/art/README.md`; Pixelify Sans é servida localmente com licença OFL. Cartas em pergaminho e molduras são CSS; dados, ações e cartas visíveis continuam limitados pelas projeções do servidor. Não foram adicionadas energia, poderes ou funcionalidades fictícias para preencher o layout.

A mesa organiza os jogadores em posições relativas ao próprio assento, placar no topo, vira/manilha e histórico público, com controles laterais no desktop e abaixo no celular. Componentes de cartas, assentos, histórico e ações mantêm responsabilidades separadas; foco, teclado, toque e movimento reduzido são preservados. O M4 continua aberto: áudio, demais critérios e playtests não estão concluídos por esta entrega.

Verificação: `bun run check` aprovado com 149 testes (121 de domínio/servidor/tooling/integração, 18 DOM e 10 de PostgreSQL), mínimo de 80% de linhas/funções por arquivo preservado, inventário de 39 fontes e build aprovados. Permanece um aviso de tamanho no teste `App.test.tsx`; os estilos e componentes novos não adicionam avisos. Seis E2E oficiais e duas verificações visuais temporárias passaram em portas isoladas 3002/4273, preservando os processos locais. Capturas de entrada, lobby e mesas 1v1/2v2, inclusive após quatro cartas jogadas, foram inspecionadas em desktop e celular; sobreposições detectadas foram corrigidas e os testes repetidos. Configurações temporárias removidas. CI remoto, publicação e playtest com usuários não foram executados.

## Partida em viewport completo

Após o feedback visual, a partida passou a ocupar todo o viewport disponível com `100dvh`: fundo único de mesa, HUD sobre a cena, regiões proporcionais e cartas dimensionadas conforme a tela. O lobby não ocupa mais a área abaixo da partida; convite e jogadores ficam no menu “Sala”, aberto no término para revanche e saída. A composição distingue desktop, retrato, paisagem baixa e retrato curto, mantendo os alvos de toque. Telas pequenas reduzem ornamentos/textos auxiliares; não alteram regras, projeções ou ações permitidas. O menu e o histórico permitem rolagem interna, sem exigir rolagem da página para jogar. Nenhuma imagem adicional foi necessária.

Verificação: `bun run check` aprovado com 151 testes, cobertura mínima por arquivo preservada, inventário de 39 fontes e build; permanece somente o aviso anterior de tamanho do teste `App.test.tsx`. Seis E2E de rede/navegador aprovados com partidas 1v1/2v2, reconexão, revanche e redimensionamentos antes/depois de uma vaza em 320×568, 375×667, 390×844, 844×390, 1024×768, 1280×720 e 1920×1080. As regressões exigem página sem rolagem, ações/cartas inteiras na tela, centro fora do retrato próprio e assentos fora da vira. Capturas foram inspecionadas; testes DOM cobrem o menu recolhido, abertura no término, resultado, revanche e saída após ACK. A execução usou portas isoladas 3002/4273, preservando o servidor local. Não houve publicação, CI remoto ou playtest com usuários.

## Menu principal e criação de salas

Menu e lobby foram redesenhados com base nas referências enviadas pelo usuário: fundo próprio de feltro/madeira, navegação central, perfil de convidado e painéis dourados. Criação de sala continua disponível após preencher o apelido; ingresso por código tem painel próprio, e links de convite abrem esse painel automaticamente quando necessário. Jogar, Como jogar, Cosméticos, Configurações, Sair e prévia de poderes permanecem visíveis e desabilitados com “Em breve”, conforme autorizado. Não foram implementados matchmaking, chat, nível, moedas ou poderes.

O lobby separa configurações e convite das equipes; assentos alternados e grupos relativos ao próprio jogador preservam as regras. O botão de cópia usa somente o link público após clique, com feedback de erro e alternativa manual quando o Clipboard falha. Arte e prompt estão em `apps/web/public/art/README.md` (`menu-tabletop.png`, ImageGen integrado); ícones decorativos e molduras são código. O acabamento da partida em viewport completo continua preservado.

Verificação: `bun run check` aprovado com 160 testes (121 servidor/core/tooling/integração, 29 DOM e 10 PostgreSQL), cobertura mínima por arquivo preservada, inventário de 45 fontes e build. Permanece o aviso anterior de tamanho em `App.test.tsx`. Seis E2E aprovados em Chromium desktop/mobile usando as portas isoladas 3002/4273, incluindo ingresso por código, convite por link, atualização do lobby, partidas completas e revanche. Capturas do menu e lobby em desktop, retrato e paisagem foram inspecionadas; o teste também rejeita botões do menu cruzando perfil ou rodapé. A composição em paisagem foi corrigida para duas colunas; nomes acessíveis dos botões de ingresso foram explicitados para não depender de transformação visual em maiúsculas. Configurações temporárias removidas; processos locais preservados. Não houve publicação, CI remoto ou playtest com usuários.

### Revisão para reproduzir a composição da referência

Após o usuário rejeitar a interpretação anterior, o menu passou a usar uma edição direta da referência como arte estática (`menu-reference-plate.png`), preservando logo, feltro, cartas ilustradas, objetos, moldura do perfil e rodapé. Os botões foram removidos da imagem e reconstruídos como controles HTML, com posições proporcionais ao alvo 1567×882; seis ações permanecem numa coluna, inclusive em paisagem. Ícones pixel art foram gerados em atlas transparente (`menu-icons.png`), a moldura é SVG decorativo e a tipografia usa Jersey 25 local com OFL. A imagem gerada é uma edição aproximada da arte fornecida, não o arquivo original nem uma reprodução pixel a pixel.

O perfil foi separado em `MenuProfile`; apelido é funcional e nível/moedas exibem “—” com descrição de indisponibilidade, sem números inventados. A carta Espião no fundo é apenas ilustração. O lobby e as regras de partida não foram alterados nesta revisão. O menu em retrato adapta os elementos para legibilidade; desktop mantém a composição proporcional da referência.

Verificação desta revisão: `bun run check` aprovado com 160 testes, meta de 80% por arquivo preservada, inventário de 46 fontes e build; somente o aviso anterior de tamanho em `App.test.tsx`. Seis E2E finais aprovados, com comparação visual e asserções proporcionais em 1567×882, 1920×1080 e celular em retrato/paisagem. Testes preservam criação, entrada por código/link, partidas completas, reconexão e revanche; perfil/menu/rodapé não se sobrepõem. A última rodada rodou em 3002/4273 e removeu configurações temporárias. Não houve publicação, CI remoto ou playtests com usuários.

Após novo ajuste solicitado, os seis botões do menu têm dimensões iguais em desktop, retrato e paisagem, com ampliação de 2,5% no hover ou foco pelo teclado. As estrelas laterais de Criar sala aparecem somente no destaque. Opções futuras continuam desabilitadas; movimento reduzido remove a ampliação e as transições das estrelas. Nenhum asset adicional foi necessário. A regressão E2E verifica tamanhos, hover, estrelas e movimento reduzido.

Verificação do ajuste: `bun run check` aprovado com 160 testes, cobertura mínima por arquivo, inventário de 46 fontes e build; seis E2E aprovados em portas isoladas 3002/4273, com capturas desktop/mobile inspecionadas. Permanece o aviso anterior de tamanho em `App.test.tsx`. Configurações temporárias removidas; não houve publicação.

### Correção do hover e da criação por localhost

As estrelas foram estendidas às seis opções da navegação, incluindo as desabilitadas, acompanhando somente hover/foco. Integração e navegador reproduziram um bloqueio de criação por `localhost`: os defaults aceitavam apenas origens `127.0.0.1`, retornando `FORBIDDEN_ORIGIN`. Os defaults e `.env.example` agora incluem os dois nomes nas portas locais exatas; configurações explícitas continuam substituindo os defaults e origens externas permanecem bloqueadas. Sem a URL da sessão original do usuário, não se atribui toda ocorrência da antiga mensagem genérica a essa única causa.

O cliente traduz códigos conhecidos em orientações específicas para origem, sessão, capacidade, convite e rate limit, distingue falha de conexão e apelido inválido e não exibe payloads arbitrários. Verificação: `bun run check` aprovado com 165 testes, cobertura mínima por arquivo, inventário de 46 fontes e build; oito E2E aprovados em portas isoladas, mais dois testes de criação/conexão por `localhost:5173` no servidor de desenvolvimento existente. Permanecem os avisos anteriores de tamanho de `App.test.tsx` e revisão de tamanho do serviço de sala. Configurações temporárias removidas; sem publicação.

### Legibilidade da criação de sala

Após o relato de textos difíceis de ler, o lobby recebeu superfícies opacas, texto principal em marfim e legendas claras; títulos/códigos preservam o dourado e equipes mantêm azul/vinho. Título, instruções e saída não dependem mais da cor da ilustração sob o texto. Legendas e badges menores passaram a no mínimo 14 px; controles desabilitados mantêm texto claro sobre fundo neutro, borda tracejada e bloqueio nativo. Os ajustes ficam em `lobby-legibility.css`, após os estilos responsivos.

O E2E mede contraste mínimo de 4,5:1 e tamanho/opacidade nos elementos selecionados do lobby, cobrindo anfitrião/convidado e início habilitado/desabilitado, em desktop, retrato e paisagem. Oito testes de navegador aprovados, com capturas desktop/mobile inspecionadas. Isso não representa auditoria completa de acessibilidade. Nenhuma regra, permissão, asset ou funcionalidade do M3 foi adicionada.

Verificação geral: `bun run check` aprovado com 165 testes, mínimo de 80% por arquivo, inventário de 46 fontes e build. Permanecem os avisos anteriores de tamanho no teste `App.test.tsx` e no serviço de sala. E2E executado em portas isoladas 3002/4273 e configurações temporárias removidas; sem publicação.

### Composição do lobby com controles pixel art

A tela foi reorganizada conforme a nova referência: duas colunas independentes, título em faixa, configurações em linhas com ícones, seletores segmentados de modo/estilo, switches pixel art, molduras SVG ornamentadas, equipes à direita e ações inferiores. A confirmação de pronto fica no próprio assento; temporizadores ficam em seção expansível. Código e cópia do convite compartilham uma linha, com campo manual revelado se Clipboard falhar. A prévia de poderes permanece decorativa/desabilitada; o switch de poderes está desabilitado e o de privacidade representa o estado fixo atual. Sem chat, salas públicas ou alteração de regra.

Ícones e moldura são vetores originais em código; as cartas da prévia são HTML/CSS. Nenhum novo bitmap foi gerado. Jersey 25 e a paleta de contraste foram preservadas. A apresentação se empilha no celular e mantém controle de acesso do anfitrião, seleção confirmada por snapshot e semântica nativa de radios/fieldset. Testes adicionais cobrem seleção/normalização, switches, Clipboard compacto e seleção pelo teclado; E2E mantém partidas completas e verifica bloqueio de convidados e tempos do competitivo. Capturas de desktop, 1567×882, retrato e paisagem foram inspecionadas.

Verificação: `bun run check` aprovado com 167 testes (123 servidor/core/tooling/integração, 34 DOM e 10 PostgreSQL), cobertura mínima de 80% por arquivo, inventário de 47 fontes e build. Oito E2E finais aprovados nas portas isoladas 3002/4273; configurações temporárias removidas. Permanecem apenas os avisos anteriores de tamanho de `App.test.tsx` e revisão do serviço de sala. Não houve publicação, CI remoto ou playtest com usuários.

### Preferência local de apelido

A pedido do usuário, o apelido válido passa a ser salvo no `localStorage` por origem (`truco.nickname`) e carregado no primeiro render, inclusive quando não há sessão ou o backend foi reiniciado. Apagar o campo remove a preferência; valores inválidos são ignorados/removidos. Falhas de acesso/escrita não impedem usar o campo. A sessão existente continua fornecendo a identidade confirmada; resposta atrasada não substitui uma edição em andamento. O armazenamento não contém cookies, tokens, assentos ou cartas, nem recupera salas perdidas pelo servidor. Necessidade, retenção e exclusão foram documentadas em `docs/security.md`.

Regressões cobrem persistência entre montagens, limpeza, validação, armazenamento bloqueado/sem espaço, sessão confirmada, resposta inválida e corrida com edição. E2E verifica recarga antes de criar sala e perda do cookie, exigindo nick preenchido, HTTP 401 sem sessão e nova entrada válida. Os dez E2E finais passaram em desktop/mobile nas portas isoladas 3002/4273; configurações temporárias removidas, sem publicação.

`bun run check` aprovado com 174 testes (123 servidor/core/tooling/integração, 41 DOM e 10 PostgreSQL), cobertura mínima por arquivo, inventário de 48 fontes e build. O módulo de preferência atingiu 100% de linhas/funções. Permanecem os avisos anteriores de tamanho no teste `App.test.tsx` e revisão do serviço de sala.

### Alinhamento dos controles de assento

Os cartões das equipes receberam alturas uniformes e uma área inferior reservada para ações, inclusive nos assentos ocupados por outros jogadores. Botões de pronto/cancelamento e seleção de vaga compartilham largura, altura mínima proporcional à fonte e posição relativa; nomes longos, badges e quebras de linha não deslocam os controles. O hover mantém o realce sem translação nesses botões. Nenhuma permissão ou comando de sala foi alterado.

E2E mede cartões, áreas e botões em salas 2v2 parciais/completas, com apelido longo e alternância de pronto, incluindo 1567×882, 1024×768, 390×844, 320×568 e 844×390. Verifica também área mínima de toque e texto sem corte. Capturas foram inspecionadas. Os 12 E2E finais passaram em portas isoladas 3002/4273; configurações temporárias removidas. `bun run check` aprovado com 174 testes, cobertura mínima por arquivo, inventário de 48 fontes e build. Permanecem os avisos anteriores de tamanho de `App.test.tsx` e revisão do serviço de sala. Sem publicação.

### Link visível na linha de convite

O link público substituiu o código isolado na linha de convite, com campo somente leitura, seleção ao focar e botão de copiar em ícone. O link permanece disponível para cópia manual, inclusive após falha no Clipboard; a variante compacta com campo oculto foi removida. Layout e textos de privacidade acompanham essa apresentação, mantendo o ingresso por código/link e o mesmo contrato de autorização.

Testes DOM verificam valor e seleção do link, cópia e falhas. E2E usa o campo de convite para identificar a sala e preserva os fluxos multiplayer e verificações visuais. Capturas de desktop/mobile foram conferidas. `bun run check` aprovado com 174 testes, cobertura mínima por arquivo, inventário de 48 fontes e build; 12 E2E finais aprovados em portas isoladas 3002/4273. Configurações temporárias removidas; permanecem apenas os avisos anteriores de tamanho do teste `App.test.tsx` e revisão do serviço de sala. Sem publicação.

### Aparência das configurações bloqueadas

As configurações do convidado agora usam tons acinzentados e menos destacados nos seletores, legendas e ícones, com indicação de “Somente leitura” associada ao fieldset. A opção atual permanece distinguível sem parecer um botão dourado editável. O painel mantém texto legível sem transparência global; copiar o convite e as ações do próprio jogador continuam disponíveis.

DOM verifica indicação e vínculo acessível; E2E compara a seleção do convidado à do anfitrião, exige radios desabilitados, contraste preservado e cópia disponível. As capturas das duas permissões foram conferidas em desktop/mobile. Sem mudança de autorização, comandos ou regras.

Verificação: `bun run check` aprovado com 174 testes, cobertura mínima por arquivo, inventário de 48 fontes e build; 12 E2E aprovados nas portas isoladas 3002/4273. Configurações temporárias removidas. Permanecem somente os avisos anteriores de tamanho em `App.test.tsx` e revisão do serviço de sala. Sem publicação.

## Revisão de segurança e legibilidade

A revisão após o M2 confirmou que dados de jogadores continuam somente em memória; não foram criadas tabelas ou persistência. `docs/security.md` agora distingue transporte local de HTTPS/WSS em publicação e documenta a política futura para TLS do banco, criptografia em repouso, senhas e tokens, sem provisionar infraestrutura ou antecipar contas do M5.

A preferência por linhas em branco entre blocos lógicos foi registrada no `AGENTS.md`. Seis arquivos de produção receberam ajustes de espaçamento, sem alterar comportamento. `bun run check` foi executado novamente: 142 testes aprovados, meta de cobertura mantida, inventário de 35 fontes e build aprovados. O alerta de tamanho do serviço de sala permanece uma indicação de revisão; o acréscimo de espaçamento não justifica compactar o código para ocultá-lo. E2E não foi repetido nesta revisão de espaçamento/documentação.

## Correção de clareza no início da partida

O botão de início estava desabilitado sem explicar as condições pendentes. O lobby agora informa quantos jogadores faltam em 1v1/2v2, quais precisam confirmar pronto ou reconectar e quando somente o anfitrião pode iniciar. O botão referencia essas instruções por `aria-describedby`; a interface orienta sessões independentes para testar na mesma máquina. As validações autoritativas de início foram preservadas; não foi introduzido modo solo ou bot.

Verificação: `bun run check` aprovado com 144 testes, cobertura mínima por arquivo e build; seis E2E aprovados, incluindo bloqueio explicado antes de completar a sala e início real após todos confirmarem pronto. O comando E2E padrão encontrou a porta3001 já ocupada; a suíte foi executada em3002/4273 com configurações temporárias removidas ao final, preservando o servidor existente. Sem resposta sobre o estado específico da sala do usuário, não se atribui a esse relato uma causa de backend comprovada.

## Correções de atualização do lobby e assentos ocupados

A seleção de assento ocupado estava configurada como troca automática com ocupante não pronto. Após o relato do usuário, a ação foi restringida a vagas livres na UI e na autoridade; tentativas de ocupar vaga alheia retornam `SEAT_TAKEN` sem mover jogadores nem alterar prontidão. Mudar para vaga livre preserva os demais jogadores e acompanha o assento do anfitrião.

O servidor já publicava ingressos para os clientes conectados. O cliente agora solicita um snapshot completo autorizado ao recuperar foco/visibilidade, recuperando estado antigo sem reenviar ações; listeners são removidos no fechamento. O E2E exige que o primeiro navegador veja cada ingresso sem um novo carregamento da página, antes de pronto/início.

Verificação: `bun run check` aprovado com 146 testes e cobertura mínima por arquivo; seis E2E aprovados em portas isoladas3002/4273 para preservar o processo local existente. Configurações temporárias removidas ao final. As condições do atraso específico do navegador do usuário não foram reproduzidas; a recuperação automática e o ingresso sem refresh têm regressões próprias. Nenhuma alteração de regra de gameplay ou persistência.

## Publicação inicial do repositório

Publicação pública no GitHub autorizada pelo usuário, com nome `jaovito/truco-caotico`. O commit inicial reúne o código e a documentação até o M2 e os ajustes de interface já autorizados. Dependências, builds, relatórios, arquivos de ambiente reais e caches ficam fora do versionamento; `.env.example` contém somente defaults locais fictícios. A revisão dos arquivos preparados não encontrou correspondências nos padrões de credenciais verificados. O commit usa o endereço noreply do GitHub. Publicar o código não publica o jogo nem provisiona hospedagem.

### Correção da primeira execução do CI

A execução 39153449872 falhou no typecheck porque a regra genérica `coverage/` também ignorava `tooling/coverage/`; os dois scripts existiam localmente, mas não entraram no commit inicial. O ignore passou a excluir somente relatórios da raiz/workspaces, preservando os scripts de cobertura e inventário. Uma regressão com Git real verifica fontes incluídas e artefatos/ambientes excluídos. A instalação congelada e `bun run check` passaram em cópia limpa dos arquivos preparados para o commit, com 175 testes, cobertura mínima por arquivo e build; a execução remota será acompanhada após o envio.

## Reorganização do frontend por componente

A pedido do usuário, `app` passou a concentrar apenas montagem, composição em `App/` e estilos globais em `styles/`. `features/room/components` agrupa Lobby e Table, com filhos exclusivos dentro do componente pai; cada componente usa `index.tsx`, testes e estilos próximos. A entrada fica em `features/menu/pages/EntryMenu`, com Profile e Icon em `features/menu/components` e estilos de página em `features/menu/styles`. Rótulos de cartas compartilhados pela sala ficam em `room/utils/cards.ts`; HTTP/WS e preferência de apelido continuam em `shared`, atendendo entrada e sala. Não foram criadas pastas vazias de páginas/serviços, nem alteradas regras, contratos ou comportamento de jogo.

O manifesto `app/styles/index.css` preserva explicitamente a cascata anterior. O build manteve o mesmo artefato CSS `index-CpW_4OJ8.css` (59,36 kB), confirmando conteúdo/ordem preservados. Imports, entradas públicas e referências da documentação foram atualizados; o trabalho anterior do M3 foi mantido.

Verificação: `bun run typecheck`, `bun run test:dom` e `bun run check` aprovados. O check inclui lint/fronteiras, formatação, tipos, **195 testes**, cobertura mínima de 80% por arquivo, inventário de **55 fontes executáveis** e build. Permanecem somente os avisos anteriores de tamanho do teste da aplicação e revisão de tamanho do serviço de sala. `bun run test:e2e --config playwright.reorg.config.ts` aprovou **12 E2E** em Chromium desktop/mobile, com portas isoladas 3002/4273 e configurações temporárias removidas depois. O servidor local existente foi preservado. Não houve deploy nem verificação de CI remoto ou Safari/iOS real.

Após a correção de organização solicitada pelo usuário, `menu/pages/EntryMenu` contém somente a página e seu teste; Profile/Icon foram movidos para `menu/components`, e estilos de página para `menu/styles`. Imports e documentação foram atualizados. `bun run check` passou novamente com 195 testes, cobertura mínima, inventário de 55 fontes e build; os artefatos CSS e JavaScript mantiveram os mesmos hashes. E2E não foi repetido neste ajuste de caminhos.

## Carta de poder no canto da mesa

A pedido do usuário, o poder recebido passou a ser uma carta ilustrada próxima da mão, com nome, custo, reserva de energia e estado de uso. A preparação não abre mais detalhes automaticamente: Espião/Segunda Chance pedem parâmetros somente depois do clique; Impulso/Máscara alternam a seleção para acompanhar a carta jogada. O passe e a contagem de prontos ficam na área de ações. Detalhes fecham por botão/Esc com retorno de foco, e um novo contexto descarta a abertura/seleção anterior. Usados e indisponíveis continuam consultáveis sem enviar ativações. Mãos especiais preservam a energia e mostram ausência de poder. Custos, fases, sorteios, prazo da preparação e autoridade do servidor foram preservados.

Arte própria: `apps/web/public/art/power-illustrations.png`, atlas 2×2 gerado com ImageGen integrado. Imagem e prompt estão documentados em `art/README.md`; moldura, títulos, custo, energia e ações permanecem HTML/CSS acessível. `Powers/Card` mantém a estrutura por componente solicitada. O atlas é decorativo e não contém informações de partidas.

Verificação: `bun run check` aprovado com **197 testes** (141 servidor/core/tooling/simulação/integração, 46 DOM e 10 PostgreSQL), cobertura mínima de 80% de linhas/funções por arquivo e inventário de **56 fontes executáveis**, além de lint/fronteiras, formato, tipos e build. Testes DOM verificam abertura explícita, ativação, cancelamento por contexto, fechamento/foco, usados, pausa, janela incorreta e energia insuficiente. Permanecem somente os avisos anteriores de tamanho do teste da aplicação e revisão de tamanho do serviço de sala.

`bun run test:e2e --config playwright.power-card.config.ts`: **12 E2E aprovados** em Chromium desktop/mobile, com clientes independentes, clique na carta de poder, parâmetros, partida completa, reconexão e revanche. Verificações geométricas exigem carta de poder dentro do viewport e sem cruzar cartas da mão. Capturas desktop, celular em retrato/paisagem e 320 px foram inspecionadas; texto/passe foram ajustados para telas pequenas. Execução isolada em 3002/4273, configurações temporárias removidas ao final e servidor local existente preservado. Sem deploy, CI remoto, Safari/iOS real ou playtest humano.

## Refinamento visual da carta de poder

Corrigida a deformação do atlas: cada ilustração agora ocupa uma área quadrada independente do título e do rodapé. A moldura usa bordas rígidas, contraste de pergaminho e tipografia local, com custo dentro da arte e título sem quebras arbitrárias. O tamanho da carta se adapta ao espaço real da mão; telas baixas usam miniatura sem esticar a arte. O resultado do Espião abre pela própria carta com indicação “Ver resultado”, eliminando o botão redundante que deslocava a carta sobre o vira. A regressão DOM verifica acesso ao resultado sem enviar ação; nenhuma regra ou projeção foi alterada.

`bun run check` aprovado: lint, formatação, tipos, **197 testes**, cobertura mínima por arquivo, inventário de **56 fontes executáveis** e build. `bun run test:e2e --config playwright.pixel.config.ts` aprovou **12 E2E** em portas isoladas 3002/4273, incluindo arte quadrada, custo contido, título sem overflow e ausência de sobreposição com cartas, assentos, vira e ações. Configurações temporárias removidas após a execução; processos locais preservados.

Validação final com **playwright-cli** em uma partida real 2v2 com quatro contextos separados: capturas inspecionadas em 1567×882, 390×844, 320×568 e 844×390, incluindo o título Segunda Chance e detalhes do Espião. Seleção da Máscara, cancelamento por Esc, fechamento de detalhes e retorno de foco confirmados. Preferência permanente registrada em `AGENTS.md`; artefatos locais do CLI ignorados pelo Git. Safari/iOS real e playtest humano permanecem não verificados.

## Carta recolhida à esquerda

A carta de poder passou para a esquerda da mão e teve a largura desktop reduzida de até 172 para 140 px. Em ponteiro fino, uma manga mostra aproximadamente metade da carta em repouso; hover/foco revelam o conteúdo completo, sem ativar o poder. Seleção e detalhes abertos mantêm a carta revelada. Energia permanece visível e movimento reduzido elimina a transição. Em toque, a carta menor fica inteira, com mão e identificação própria reposicionadas para reservar espaço. Nenhuma regra, comando ou visibilidade de jogo foi alterada.

`bun run check` aprovado com **197 testes**, mínimo de cobertura por arquivo, inventário de **56 fontes executáveis** e build. **12 E2E** aprovados com configuração temporária `playwright.pocket.config.ts` em portas isoladas 3002/4273, removida depois. As regressões verificam recorte em repouso, revelação por hover/foco sem ativação, posição à esquerda e ausência de colisão da carta/energia com a mão, assentos, identificação própria, vira, ações, conexão e menu. Processos de desenvolvimento existentes preservados.

Verificação final com `playwright-cli` em partida real 2v2: capturas de repouso/revelada em 1567×882, carta revelada em 1024×768 e contexto de toque em 390×844, 320×568 e 844×390 inspecionadas visualmente. Foco sem ação, detalhes por clique, Esc com retorno de foco e transição zero em movimento reduzido confirmados. Safari/iOS real permanece não verificado.

## Poderes privados até a ativação

A mudança de produto solicitada passou a ser aplicada na projeção do servidor: somente o dono recebe a atribuição ainda não usada, inclusive no 2v2 em relação ao parceiro. Para outros assentos e a projeção pública, `power` permanece nulo até existir ativação pública aceita naquela mão. Espião/Segunda Chance são revelados somente ao resolver o lote selado; Impulso/Máscara, junto da jogada aceita. Isso revela a identidade da Máscara, sem antecipar a identidade da carta. Passe, rejeição, término e reconexão não revelam poderes nunca usados; uma nova mão oculta as novas atribuições. Energia continua pública. A interface distingue “Poder oculto” de “Sem poder” e lista “Poderes revelados”. Regras, GDD, arquitetura, segurança e ADR foram reconciliados.

O sorteio competitivo espelhado foi preservado: ainda permite inferência a partir da própria atribuição. Foi enviada pergunta ao proprietário sobre substituí-lo por sorteio independente também no competitivo; essa alteração permanece pendente, sem decisão presumida. O casual já usa sorteio independente.

`bun run check` aprovado: **203 testes**, cobertura mínima de 80% por arquivo, **56 fontes executáveis** medidas e build. As novas regressões verificam não interferência de atribuições ocultas em 1v1/2v2, parceiro/adversário/público, preparação selada, quatro ativações, rejeição, término, nova mão e reconexão HTTP/WS antes/depois da preparação nos dois presets. **12 E2E** aprovados em portas isoladas 3002/4273; configurações temporárias removidas após uso. `playwright-cli` validou visualmente a lista antes e depois de uma ativação real de Espião em quatro contextos: adversários e parceiro permanecem ocultos, Espião usado aparece nos outros clientes e o resultado da carta continua somente com o usuário. Capturas desktop 1567×882 e mobile 390×844 inspecionadas. Sem deploy ou verificação de Safari/iOS real.

## Poderes acionados diretamente na mesa

A seleção dos quatro poderes disponíveis passou a usar os alvos da mesa. Clicar no poder só seleciona; Máscara/Impulso destacam cartas próprias elegíveis na sua vez, Segunda Chance permite clicar na própria carta durante a preparação, e Espião oferece versos clicáveis dos adversários. O aviso fica junto da mão, com cancelamento, ou no HUD em telas baixas/paisagem. Esc e cancelamento retornam o foco ao poder; pausa, prontidão e novo contexto invalidam seleções antigas. Não há selects ou painel no caminho de seleção. Impulso explica quando nenhuma carta é válida. A preparação deixa de mostrar o controle inválido de carta coberta e mantém o passe fora da mão, inclusive em 320 px e paisagem.

Espião mostra a face autorizada no verso clicado, somente para o beneficiário após resolver o lote. Os versos continuam anônimos: o clique determina o adversário e a posição visual, enquanto o servidor mantém a amostra uniforme da mão final. Após qualquer jogada do alvo, a face vira uma memória “VISTO” separada dos versos remanescentes, sem rastrear carta mascarada/coberta. Reconexão restaura a observação pela projeção privada. Não foram alterados protocolo, custos, janelas, sorteio, resolução ou visibilidade no servidor.

`Hand`, `Seats/Cards` e a validação local de seleção receberam responsabilidades próprias, com estilos junto dos componentes e testes comportamentais. `bun run check` aprovado: **206 testes**, cobertura mínima por arquivo, inventário de **59 fontes executáveis** e build. **12 E2E** aprovados com seleção direta, observação privada e geometria durante a seleção (mão/ações, aviso visível, hitboxes ≥44×44, vira e apelidos desobstruídos). Usadas portas isoladas 3002/4273; configurações temporárias removidas depois, preservando processos de desenvolvimento existentes.

`playwright-cli` validou os quatro poderes pela interface em quatro contextos reais 2v2. Capturas inspecionadas em 1567×882, 390×844, 320×568 e 844×390, incluindo Máscara selecionada/enviada e carta oculta para outro jogador, Segunda Chance pela própria mão, Impulso, Espião selecionado/face privada/memória após jogada e Esc com foco restaurado. Na primeira revelação observada, os três outros clientes tinham zero faces do Espião. Não houve deploy, verificação de Safari/iOS real ou playtest humano.


## Configuração da URL do backend no frontend

`VITE_BACKEND_URL` configura uma origem pública única para HTTP e WS; o exemplo fica em `apps/web/.env.example`. Sem valor, permanece o proxy `/api` local. Configuração é incorporada no build Vite, valida protocolo/origem e não aceita credenciais/caminhos. CORS usa a allowlist existente de origens e aceita cookies sem alterar SameSite=Strict ou a validação de origem no WS. Front/back em sites diferentes exigem proxy; nenhuma publicação ou mudança de cookie foi feita.

`bun run check` aprovado: **210 testes**, cobertura mínima por arquivo e **60 fontes executáveis** medidas, além de lint, tipos e build. O fluxo de `local-origin.e2e.ts` aprovou **2 E2E** desktop/mobile com build configurado para backend localhost:3002 e frontend localhost:4273; o proxy padrão aponta para 3001, portanto a conexão exercitada foi direta pela variável. A configuração temporária `playwright.backend-env.config.ts` foi removida depois, e o build padrão foi restaurado. Processos locais existentes foram preservados. HTTPS/WSS de produção não foram verificados.


## HUD compacto e carta de poder consumida

Carta de poder e detalhes desaparecem somente quando o servidor confirma `used`; seleção, rejeição ou preparação pendente não a removem. Energia e observação privada do Espião permanecem, e a nova atribuição aparece na mão seguinte. O painel redundante “Jogar carta” foi removido, as ações da direita foram compactadas e o status passou para o topo. Um selo “Sua vez” acompanha o avatar próprio apenas em turno ativo, sem pausa. Não houve mudança de regras ou projeções.

`bun run check` aprovado com **212 testes**, cobertura mínima por arquivo, inventário de **60 fontes executáveis**, lint, formatação, tipos e build. **12 E2E** aprovados em Chromium desktop/mobile com `playwright.hud.config.ts` temporário e portas isoladas 3002/4273; verificam consumo de poder, status no topo, selo dentro do viewport, geometria, partidas completas, reconexão e revanche. Configurações temporárias removidas ao final.

`playwright-cli` validou quatro sessões reais em desenvolvimento e no build de produção, com capturas inspecionadas em 1567×882, 390×844, 320×568 e 844×390 antes/depois do uso e durante a seleção. O ajuste de centralização usa transform consistente para evitar deslocamento duplo após otimização do CSS no build. Segunda Chance tem aviso com quebra de linha em telas estreitas. Foram encerrados somente browsers/processos abertos para esta revisão; os processos locais preexistentes foram preservados. Sem deploy, CI remoto ou teste em Safari/iOS real.


## Proporções uniformes das cartas de jogo

Mão própria, assentos, jogadas, cobertas, vira e observação do Espião compartilham proporção **2:3**, a mesma do arquivo original do verso. Slots usam aspect-ratio e altura automática; os breakpoints ajustam somente escala/largura e limitam o tamanho conforme a altura disponível. O verso usa contain. Alvos do Espião preservam 44×44 px independentemente da arte; a vira foi reposicionada durante a seleção em telas baixas para manter separação.

`bun run check` aprovado com **212 testes**, cobertura mínima por arquivo, **60 fontes executáveis** medidas, lint, tipos e build. `playwright.ratio.config.ts` temporário aprovou **12 E2E** desktop/mobile em portas isoladas 3002/4273. O helper mede dimensões CSS de todas as faces e versos com tolerância subpixel, incluindo preparação, mesa jogada, alvos e intel do Espião; rotações decorativas não entram nessa razão. Configurações temporárias removidas ao final.

`playwright-cli` conferiu quatro clientes reais, cartas jogadas, seleção de Espião e resultado privado em 1567×882, 390×844, 320×568 e 844×390, com capturas inspecionadas. As faces observadas mediram 2:3 nas quatro resoluções. Browser da revisão encerrado e processos locais anteriores preservados. Sem deploy, CI remoto ou teste em Safari/iOS real.


## Espião: remover observação de carta já jogada

A face observada deixa o assento quando uma jogada autorizada daquele alvo revela o mesmo valor e naipe, na vaza atual ou no histórico. Mão vazia também remove a memória. O estado é derivado do snapshot e preserva o resultado após reconexão; não há novos dados ou IDs no transporte. Carta diferente, coberta e Máscara ainda opaca não antecipam a remoção. A revelação posterior de Máscara aplica a mesma comparação.

`bun run check` aprovado com **216 testes**, cobertura mínima por arquivo, **60 fontes executáveis** medidas e build. Regressões reproduzem K de Espadas em 1v1/2v2, jogada aberta, histórico, reconexão, valor/naipe/assento diferentes, opacidade e mão vazia. **12 E2E** aprovados em configuração temporária `playwright.spy-play.config.ts`, com portas isoladas 3002/4273; arquivos temporários removidos.

`playwright-cli` validou o build real com quatro sessões independentes: Espião observou Q de Espadas, o alvo jogou essa carta e a face saiu do assento, permanecendo uma vez na mesa; após reload, continuou ausente do assento. Capturas antes/depois em desktop 1567×882 e celular 390×844 foram inspecionadas, com capturas adicionais em 320×568 e 844×390. Os processos abertos para essa revisão e o browser foram encerrados. Sem deploy, CI remoto ou teste em Safari/iOS real.

## Verificação para publicação no GitHub

Antes do envio autorizado, `bun run check` passou no workspace e em uma cópia limpa exportada do índice Git, com instalação por `bun install --frozen-lockfile`. A cópia limpa aprovou lint/fronteiras, formatação, tipos, **216 testes**, cobertura mínima por arquivo e inventário de **60 fontes executáveis**, além do build. `bun run test:e2e` nessa cópia aprovou **12 E2E Chromium desktop/mobile** com os comandos padrão, sem depender dos arquivos ignorados do workspace. Permanecem avisos de tamanho de arquivos, sem erros de lint. A revisão dos arquivos preparados não encontrou ambientes reais ou correspondências nos padrões de credenciais verificados. Configuração local do editor não faz parte desta entrega. Resultados remotos de CI e deploy não são presumidos por essas verificações locais.

## M4 — Manilha Maldita e cenário em camadas (18/10/2026)

Renomeação visual autorizada para **Manilha Maldita**. Logo, feltro, quatro cantos, quatro segmentos do símbolo, vela, cuia, moedas, baralho e duas cartas decorativas foram gerados com ImageGen integrado usando o background existente como referência direta. As primeiras gerações sem essa referência foram descartadas da integração. Os originais anteriores permanecem preservados. Assets finais e prompts em `apps/web/public/art/layers/README.md`.

Menu/lobby agora compõem camadas com proporções preservadas e âncoras independentes; feltro repete nos dois eixos. Perfil e marca não estão mais presos ao fundo. Cartas decorativas flutuam via CSS e respeitam movimento reduzido. No retrato, a navegação prioriza espaço de toque e pode rolar em telas baixas. Espião, Segunda Chance, Impulso e Máscara receberam ilustrações conforme a referência anexada, molduras com cores próprias, faixa de pergaminho, custo no alto à esquerda e selo. Texto, custo e estado continuam em HTML; mecânica, privacidade e comandos não mudaram. Áudio próprio existente reaproveitado; nenhum novo som ou autoplay. O cenário da partida permanece o anterior, com logo nova em tamanho de HUD.

Inspeção com `playwright-cli` encontrou e corrigiu recortes de props, corte de texto em 320 px e logo excessiva na mesa. Menu conferido em 1440×900, 390×844, 320×568 e 844×390; lobby em desktop/mobile; carta real de poder em desktop e celulares. A primeira rodada de regressão também exigiu atualizar o contrato geométrico do menu para a coluna limitada e fechar normalmente a dica de contra-aumento antes de Aceitar. Nenhum clique forçado nem enfraquecimento das regras.

Verificações gerais: lint/fronteiras, formatação, tipos e build aprovados; cobertura final com **279 testes** (154 servidor/core/tooling/integração, 115 DOM, 10 PostgreSQL), **80 fontes** com pelo menos 80% por arquivo. Permanecem apenas os avisos anteriores de tamanho de testes e módulos. Sem deploy, CI remoto, Safari/iOS real ou avaliação auditiva humana. M4 continua aberto para playtests e revisão ampla de acessibilidade.

E2E: **14 casos aprovados em rodadas**, incluindo carregamento dos assets, responsividade/movimento reduzido, primeiro acesso/convites e partidas completas 1v1/2v2 em Chromium desktop/mobile, com reconexão e revanche. A rodada final mobile passou após reduzir a borda das miniaturas para títulos longos e limitar a logo a 60 px em 320 px. Configuração temporária de E2E removida após a execução; servidor original preservado, com recarga de configuração para invalidar um erro de resolução de CSS que havia ficado em cache.

## M4 — Carta vencedora e aviso de turno compacto (18/10/2026)

A carta vencedora confirmada cresce até 20%, treme por 900 ms e mantém destaque até acabar a pausa autoritativa de 1,8 s. O som de resultado existente acompanha o mesmo snapshot; não há duplicação de áudio nem alteração de timer/regras. Empate não destaca vencedor; movimento reduzido mantém contorno/brilho estáticos. Resultado movido para o painel superior, deixando as cartas visíveis. “Sua vez” tem largura/título cerca de um terço menores, preservando a leitura da legenda.

Validação: `bun run lint`, `bun run format:check`, `bun run typecheck`, `VITE_BACKEND_URL='' bun run build` e `VITE_BACKEND_URL='' bun run test:coverage` passaram: 279 testes, 80 fontes medidas com mínimo de 80% por arquivo. Permanecem avisos anteriores de tamanho. E2E de feedback aprovado em Chromium desktop/mobile (2 casos), com resultado acima das cartas, animação/movimento reduzido e sequência de próximo turno. `playwright-cli` capturou e permitiu inspecionar visualmente uma vaza real em 1280×720 e 390×844, incluindo a carta durante o efeito e a faixa menor. Scripts auxiliares de captura precisaram sincronizar entrada/pronto e cada jogada; a captura final concluiu. Áudio validado por testes do observador/sintetizador, sem avaliação auditiva humana. Sem deploy ou teste em Safari/iOS real.

## M4 — Chama da vela no menu (18/10/2026)

Animação CSS usando a própria arte: corpo fixo, chama recortada ancorada no pavio e halo discreto com ciclo independente. Pixel art preservada, proporção original 477:512, sem GIF, dependência ou loop JavaScript. Movimento reduzido mostra o PNG original estático. O cenário da partida mantém seu efeito de chama existente.

`bun run test:coverage` passou com 279 testes e 80 fontes medidas no mínimo por arquivo; lint, formatação, tipos e build passaram. E2E de menu passou nos dois projetos Chromium, cobrindo quatro viewports e movimento reduzido. A verificação preexistente de carregamento dos assets foi corrigida para usar callback real em `evaluateAll`, pois a expressão em string retornava undefined. `playwright-cli` permitiu inspecionar quatro quadros da chama e o menu em 1440×900 e 390×844, além do modo estático. Sem deploy ou validação em Safari/iOS real.

## M4 — Recuperar riqueza das bordas anteriores (18/10/2026)

Quatro novos cantos diagonais de madeira/tecido foram gerados com ImageGen integrado a partir da captura anterior enviada pelo usuário. PNGs transparentes, procedência e prompt em `apps/web/public/art/layers/README.md`; originais preservados. Distribuição de baralhos, moedas, cuia e cartas refeita com camadas independentes, símbolo ampliado e molduras do perfil/rodapé recuperadas. Logo Manilha Maldita e vela animada mantidas. Feltro continua repetível e cada canto tem âncora própria.

Verificações: cobertura com 279 testes, 80 fontes e mínimo de 80% por arquivo; lint, tipos, formatação e build passaram. Quatro E2E de bootstrap/menu aprovados em Chromium desktop/mobile, incluindo carregamento dos novos assets, navegação, movimento reduzido e cinco viewports (1920×1080, 1440×900, 390×844, 320×568, 844×390). `playwright-cli` usado para capturas e inspeção visual nesses tamanhos; reposicionamento do baralho em paisagem evita cobrir a vela. Sem deploy, CI remoto ou Safari/iOS real.

## M4 — Corrigir emenda da chama (18/10/2026)

O usuário identificou um corte na vela animada. Removidos os dois fragmentos com clip-path; a imagem original agora é renderizada uma única vez. Filtro SVG local com intensidade gradual desloca somente o topo da chama, chegando a zero acima do pavio, sem abrir lacunas na cera. IDs do filtro são próprios por instância; animação declarativa, sem timers ou loop React. Movimento reduzido desativa o filtro e mantém a imagem intacta.

Cobertura passou com 279 testes e 80 fontes no mínimo por arquivo; lint, tipos e build aprovados. Inspeção com playwright-cli em quatro instantes da animação e desktop/mobile confirmou ausência da emenda visível; modo estático também capturado. Sem deploy ou verificação em Safari/iOS real.

Regressão E2E final: 2 casos de menu aprovados em Chromium desktop/mobile, incluindo imagem única, ausência de recortes e filtro desativado com movimento reduzido. Formatação e diff sem erros.

## M4 — Restaurar movimento perceptível da chama (18/10/2026)

O usuário apontou que a correção anterior eliminou visualmente a animação. O filtro passou a operar dentro de SVG com coordenadas fixas da arte original, máscara feita com primitivas nativas e ciclo de 1,6 s com amplitude perceptível. A ponta é recomposta sobre a fonte preservada para manter cera/pavio estáveis e evitar emendas. Movimento reduzido segue desativando o efeito.

A validação agora inclui comparação real dos pixels entre quadros com o halo pausado, exigindo ponta diferente e cera idêntica. Emulação mobile exigiu capturas na resolução CSS para eliminar diferenças de reamostragem por DPR. Inspeção playwright-cli de quadros desktop e captura mobile/reduced-motion realizada. Sem deploy ou validação Safari/iOS real.

Verificação final: 279 testes de cobertura e 80 fontes no mínimo por arquivo, 4 E2E Chromium desktop/mobile (incluindo comparação de pixels), lint, tipos, formatação e build aprovados.

## M4 — Cartas de poder fiéis à referência (18/10/2026)

Substituída a composição genérica por quatro artes completas 2:3 geradas a partir da imagem enviada: molduras ornamentais nas cores azul/verde/vermelho/roxo, faixa de título, cápsula de energia, pergaminho e selos correspondentes. Nome, custo e efeito continuam HTML acessível; disponibilidade passou para fora da carta. Ajustados textos curtos e alturas de revelação no dock. A carta decorativa do menu usa a mesma arte.

Inspeção com playwright-cli das quatro artes ampliadas e de partida em desktop/celular realizada. Cobertura: 279 testes aprovados e 80 arquivos executáveis atendendo ao mínimo individual; lint (dois avisos existentes de tamanho), tipos, formatação e build aprovados. Regressão de proporção 2:3 adicionada à verificação multiplayer. Sem deploy ou validação em Safari/iOS real.

E2E final: 8 casos aprovados em Chromium desktop/mobile, incluindo partidas completas 1v1/2v2, reconexão, revanche, composição de menu e animação da chama.

## M4 — Lobby compacto sem opções fixas (18/10/2026)

Removidos o bloco “Convide seus amigos para entrar na sala!” e os switches imutáveis de privacidade/poderes. Link copiável preservado; condição de início resumida junto às ações, com descrição acessível e mesmos bloqueios. Mantidos cards de equipes e molduras. Desktop recebeu espaçamentos e avatares menores, tempos em três colunas e catálogo sobreposto com rolagem própria; mobile mantém fluxo empilhado.

Inspeção playwright-cli desktop/mobile realizada. Novo E2E de lobby passou nos dois perfis Chromium, cobrindo 1v1/2v2 em 1280×640, 1280×720, 1024×768, 1440×900 e 1920×1080, inclusive tempos/catálogo abertos e ações mobile. Cobertura aprovada: 279 testes, 80 fontes no mínimo por arquivo. Lint, tipos, formatação e build aprovados. Sem deploy; Safari/iOS real não verificado.

Verificação final em execução isolada: mais 4 E2E de partidas 1v1/2v2 aprovados em Chromium desktop/mobile, incluindo pronto, início, reconexão e revanche (6 E2E aprovados no total).

## M4 — Distinguir Máscara de carta coberta (18/10/2026)

Máscara ganhou verso roxo com ícone pixelado e “Vale força”; coberta usa ícone riscado e “Sem força”. Descrição acessível explica força preservada/perda para cartas abertas, sem mudar regras. Contorno roxo identifica também a face autorizada da Máscara. Mãos adversárias continuam usando verso genérico, sem revelar poderes ou identidades.

Inspeção playwright-cli dos estados em desktop/mobile; regressão DOM verifica distinção, ausência de identidade oculta e face autorizada. Cobertura aprovada: 280 testes, 80 fontes atendendo ao mínimo por arquivo. Dois E2E de apresentação aprovados em Chromium desktop/mobile; lint, tipos, formatação e build aprovados. Sem deploy.

## M4 — Apelido editável e menu da partida (18/10/2026)

Corrigido POST de convidado que ignorava novo apelido em sessões existentes. Atualização validada mantém credencial, ID e expiração, sem mudar nomes de assentos já ocupados. Menu da partida ganhou painel com fundo opaco/feltro, moldura dourada, som, fechar/voltar e saída com confirmação de desistência; o resultado mantém saída reconhecida pelo servidor. Desconectado permite fechar/ler o menu, mas bloqueia desistência.

Inspeção playwright-cli em partida desktop/mobile realizada. 282 testes de cobertura aprovados, 81 fontes atendendo ao mínimo individual; 6 E2E Chromium desktop/mobile aprovados para apelido, reload, apresentação, foco e desistência. Lint, tipos, formatação e build aprovados. Backend de teste isolado; sem deploy.

## M4 — Raio de energia conforme referência (18/10/2026)

Substituído o caractere tipográfico por SVG pixelado dourado, com luz e contorno, compartilhado entre custo dos poderes, reserva de energia e decoração do menu. Cápsula, números e rótulos acessíveis preservados. Conferência playwright-cli desktop/mobile em três tamanhos de carta. Cobertura: 282 testes e 82 fontes aprovados; lint, tipos, formatação e build aprovados. Sem deploy.

- Perfil do menu revisado conforme referência anterior: moldura ornamentada em nove partes, coroa e botão de editar apelido; novo atlas de quatro avatares com pixels maiores compartilhado pelo menu, lobby e mesa. Sem mudança de progressão ou regras.

- Espião revisado a partir da referência do personagem encapuzado: chapéu, cartas na mão, medalhão de olho entre arte e pergaminho e custo à direita. A mesma face decorativa é usada no menu e na carta da mesa; efeito e custo permanecem definidos pelo catálogo.

- Encerramento por última jogada: 1,8 s de mesa visível com destaque autoritativo da carta vencedora; depois 5 s de apresentação com confetes/explosão pixelada conforme perspectiva; diálogo de revanche por último. Mantidos reconexão sem repetição, movimento reduzido e comandos existentes.

- Reforçado E2E de edição do nick pelo lápis do perfil: nome antigo confirmado, criação imediata da sala após editar e novo nome confirmado no lobby, reload e retorno ao menu; cenário executado em desktop/mobile.

- Como jogar habilitado: tutorial guiado em sete etapas com demonstração interativa de manilhas, prática com feedback, poderes completos e revisão das convenções da casa. Catálogos tipados pt-BR/en e seletor persistente, posteriormente integrado ao idioma global do jogo. Reutiliza identidade/arte existente, sem mudar gameplay.

- Pedidos de aumento recebem gritos em pixel art por 1,8 s e quatro efeitos retrô sintetizados originais. Contra-aumento usa SEEEIS!/NOOVE!/DOOOZE!! conforme próximo valor; limite 12 preservado. Eventos confirmados, sem replay em SYNC/reconexão; movimento reduzido e mute respeitados.

Incremento de aceite: DEEESCE!! animado e efeito sonoro descendente após confirmação autoritativa, com valor aceito explícito, textos pt-BR/en e regressões DOM/multiplayer.

Perfil do menu compactado: largura desktop de 32vw para 28vw (teto 510px), avatar menor e altura guiada pelo conteúdo. Moedas e botão ficam no fluxo abaixo da divisória, sem cruzar a legenda de convidado. Validado visualmente em desktop, retrato 320/390px e paisagem; regressão geométrica no E2E do menu.

## Treino solo e ferramentas dev — 19/10/2026

Escopo adicional autorizado pelo usuário: Jogar inicia 1v1 contra bot conservador com visão limitada, independente de development. Flags de backend ENABLE_SOLO e ENABLE_DEV_TOOLS separadas; dev:server habilita ambas por padrão, start:server mantém ambas fechadas. Ferramentas exigem NODE_ENV=development, sala solo e dono; painel excluído do build de produção. ADR 009 registra a decisão.

Menu Sala permite montar três cartas distintas, escolher Espião/Segunda Chance/Impulso/Máscara e energia 0–3, aplicar cenário reiniciando a mão ou redistribuir aleatoriamente. Preserva placar e 40 cartas únicas; limpa contexto anterior, respeita mãos de onze/11×11, idempotência e revisões. Bot compartilha fila, core e timers com jogadores; pausa sem humano e não impede expiração. Revanche solo automática e retorno ao menu sem lobby fantasma.

Verificação: cobertura completa passou com 92 fontes executáveis e mínimo individual de 80%; lint, tipos e formatação passaram. Quatro E2Es solo passaram em desktop/mobile, separando Vite dev e build de produção; integração real confirmou recusa de ferramentas em production/test apesar da flag ligada. Capturas playwright-cli desktop/mobile inspecionadas, incluindo botões no painel com rolagem. Build de produção inspecionado sem textos/código do painel dev. Sem deploy ou Safari/iOS real; bot conservador de treino, sem promessa de dificuldade competitiva.

Seletor do tutorial corrigido: seta pixelada com margem interna de 12px e reserva de 40px para não encostar no texto/borda, mantendo o seletor nativo. Conferência visual playwright-cli desktop/mobile; quatro E2Es do tutorial, cobertura (92 fontes), lint, formatação e build passaram.

- Idioma global: menu Configurações habilitado com português/inglês persistidos, seletor disponível no lobby/partida e tutorial integrado à mesma preferência. Catálogos cobrem textos de interface, acessibilidade, poderes, resultados, áudio e transporte; troca preserva a sessão e as seleções. Regressões DOM e E2E dedicadas em `playwright.i18n.config.ts`.

Validação do idioma global: `bun run test:coverage` aprovado (312 testes; 97 arquivos executáveis medidos, todos acima do mínimo); `bun run test:e2e --config=playwright.i18n.config.ts` com 8/8 cenários desktop/mobile aprovados; tipos, lint, formatação e build aprovados. Lint mantém 11 avisos existentes. Inspeção visual com playwright-cli em 1440×900 e 390×844 cobriu configurações, menu e lobby; ajustada a posição do status de conexão. Sem deploy.

- Organização E2E: cenários reunidos em `tests/e2e/` por perfil, menu, lobby, partida, tutorial, configurações, solo, acessibilidade e infraestrutura; helpers em `support/`. Imports e seletores das três configurações Playwright atualizados, com todos os arquivos de configuração incluídos no typecheck. Inventários antes/depois preservados: 36 cenários padrão, 4 solo e 8 idioma/tutorial (com sobreposição intencional do tutorial).

Validação da reorganização: inventários Playwright comparados antes/depois sem perder cenários; 8 E2E de idioma/tutorial e 4 de solo aprovados nos novos caminhos. Typecheck, lint (11 avisos existentes), formatação e build aprovados; cobertura com 312 testes e 97 fontes medidas aprovada. A suíte padrão de 36 cenários teve descoberta/imports verificados por `--list`, sem reexecutar seus fluxos completos nesta alteração estrutural.

- Organização de `rooms/application`: subpastas `state`, `lobby`, `match`, `solo` e `messaging`, com testes junto das responsabilidades exercitadas. Criação de sala e despacho de comandos extraídos do serviço; contratos separados de presença/aleatoriedade; validação de capacidade compartilhada entre criação e entrada. Coordenação, fila, idempotência e autoridade do servidor preservadas. Revisados espaçamento entre blocos, loops compactados, imports de tipos e seleção de dependências/tempos de decisão. Estrutura documentada em `docs/architecture.md`.
- Validação da reorganização do backend: `bun run test:coverage` aprovado (**312 testes**, **100 arquivos executáveis** medidos acima do mínimo por arquivo), incluindo transporte real HTTP/WS e PostgreSQL local. `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run build` e `git diff --check` aprovados. Permanecem os 11 avisos de lint anteriores. E2E de navegador não reexecutado nesta refatoração interna; sem deploy.

- Validação antes do commit (19/10/2026): `bun run check` aprovado no workspace e em cópia limpa exportada do índice, com `bun install --frozen-lockfile`: lint, formato, tipos, 312 testes, cobertura mínima por arquivo (100 fontes executáveis) e build. Corrigida a expectativa antiga do E2E de origem local, que ainda procurava os switches fixos removidos do lobby.
- E2E: **36 cenários padrão + 4 solo + 8 idioma/tutorial aprovados**, em Chromium desktop/mobile. A suíte padrão foi executada por área, com um worker e backend novo por lote, em portas isoladas 3002/4273: a execução concorrente atingiu o rate limit compartilhado por IP. A proteção permaneceu ativa. Também foi descartada uma execução inicial cujo build foi substituído pelo check concorrente; as execuções válidas foram sequenciais. Configuração temporária removida, build padrão restaurado e servidor de desenvolvimento existente preservado. Configuração local `.zed/settings.json` excluída do commit; sem deploy.
