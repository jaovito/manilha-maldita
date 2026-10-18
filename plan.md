# Plano de desenvolvimento — Truco Caótico

## Estado atual

O repositório contém documentação, apresentação HTML e bootstrap com quatro Bun Workspaces, dependências fixadas, TypeScript estrito, Biome e checagem de fronteiras, formatação, testes de ambiente e configuração de CI e infraestrutura local PostgreSQL/Drizzle com migrações e seeds transacionais. O motor de regras-base do M1 está concluído e testado: cartas, distribuição, vazas, apostas, onze, pontuação, ciclo completo de partida e projeções autorizadas. O M2 acrescenta servidor autoritativo HTTP/WS e cliente React com lobby e mesa DOM jogável. A apresentação HTML da raiz continua um artefato conceitual separado. O código passou a ser versionado em Git; o histórico dos incrementos anteriores está registrado neste plano.

M1 e M2 concluídos nos respectivos escopos. Já é possível jogar partidas privadas de regras-base no navegador com duas ou quatro sessões distintas. Poderes/preparação entram no M3; arte, áudio e acabamento continuam no M4. A conclusão do M2 não equivale à entrega do MVP com poderes.

## M2 — conclusão: salas, autoridade, tempo e reconexão

- Salas privadas por código/link, sessão convidada sem cadastro, lobby com equipes alternadas, escolha de assentos livres, pronto e início pelo anfitrião; regras/configuração congeladas durante a partida; revanche preserva assentos/configuração e pede pronto novamente.
- Backend Hono/Bun com uma fila limitada por sala coordenando comandos, presença, timers e partida. Autenticação por cookie, associação de assento e invalidação da conexão anterior. Protocolo Zod estrito, contexto/revisão e ACK idempotente por sessão/partida/comando; rejeições sem avanço de carta, pontos ou entropia.
- Timers casual/competitivo, fallback determinístico, corrida automática, proteção cumulativa de reconexão, retomada do tempo restante, primeira resposta de parceiro, abandono após três timeouts e expiração de salas vazias sem vencedor. Relógio falso cobre limites e callbacks obsoletos.
- Proteção de origem, sessões expiráveis, limite de payload/fila/salas/atividade e saída para clientes lentos. Projeções completas individuais sem monte, cartas alheias ou identidades de cobertas. Não há logging de cartas/tokens/payloads.
- Cliente React funcional para criar/entrar, configurar, jogar, apostar, decidir onze, reconectar, pedir revanche e sair/desistir. Interface simples em verde/ouro; sem imagens geradas. Capturas de mesa desktop/mobile foram inspecionadas, e o acabamento pixel art segue no M4.
- Verificação final (18/10/2026): `bun install --frozen-lockfile` sem mudanças; `bun run check` aprovado com **142 testes** (120 servidor/core/tooling/integração, 12 DOM e 10 PostgreSQL), lint/fronteiras, formato, tipos e build. Cobertura por arquivo acima de 80% em linhas e funções, sem novas exclusões; inventário confirmou **35 fontes executáveis** medidas. Unitários e integração de servidor compartilham medição Bun; DOM e banco permanecem isolados.
- `bun run test:e2e`: **6 testes aprovados**, incluindo quatro partidas completas 1v1/2v2 em contextos independentes Chromium desktop/mobile, convite, pronto, aumentos, reload/reconexão, revanche, desistência e ACK de saída. Poderes não são simulados nem anunciados como testados. CI remoto e Safari/iOS real não foram executados.
- `bun run dev` validado iniciando backend3001 e frontend5173; `/health`200 e proxy de autenticação401 para novo convidado. Processo de desenvolvimento encerrado após verificação. ADR 006 documenta autoridade, retomada e operação. Sem deploy/push/provisionamento; pasta continua sem Git.
- Limites: estado e sessões apenas em memória; reiniciar o processo perde salas como falha técnica, sem derrota registrada. Operação de uma instância e limites conservadores, ainda sem ensaio de carga/produção. M3/M4 permanecem abertos.

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
- [ ] M3: energia, sorteios, preparação selada, quatro poderes e simulações.
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
