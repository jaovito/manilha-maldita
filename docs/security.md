# Privacidade, sessões e segurança

Leia antes de alterar projeções, interface de cartas, HTTP/WS, sessões, logs, auditoria ou retomada de assentos. As regras de tempo e abandono estão em [rules.md](rules.md); serialização e idempotência estão em [architecture.md](architecture.md).

## Privacidade, sessões e segurança

Construa projeções por allowlist: pública, individual e de equipe somente quando autorizado por regra. Não copie o estado inteiro para apagar campos depois. Nunca faça broadcast interno seguido de filtragem no navegador.

Proteja poderes sorteados ainda não ativados de qualquer outro assento, inclusive do parceiro, e mãos alheias, monte ordenado, sementes, descartes, cartas cobertas/mascaradas e resultados privados de Espião em HTTP, WS, erros, analytics, logs e reconexão. IDs também podem vazar cartas: use referências opacas de apresentação, não `3-clubs` para carta oculta. Não reutilize um ID revelado por Espião em uma jogada mascarada, permitindo correlacioná-la antes da hora. Informação já conhecida não é apagada, mas novas mensagens não podem revelar qual carta foi mascarada.

Tokens de retomada são imprevisíveis, vinculados ao assento/sessão, expiráveis e revogáveis. Código da sala é convite, não identidade. Não coloque tokens em URLs/logs. Prefira cookies seguros `HttpOnly` quando viável; valide origem no handshake WS. CORS não substitui autorização.

Valide payloads/apelidos/enums, limite mensagens e filas de saída, aplique rate limit por sessão/IP/sala e controle tentativas de ingresso. Não renderize apelidos como HTML. Proteja configurações por autorização do anfitrião; congele equipes e regras ao iniciar.

Só uma conexão controla o assento: substituir conexão invalida a anterior sem confiar em apelidos. Revalide associação sessão/sala/assento na retomada. Segredos ficam fora do Git; `.env.example` não contém valores reais. Use TLS em produção, sem desabilitar validação de certificados.

Não envie dados de jogadores a serviços externos para depuração. Projeções não impedem parceiros de compartilhar cartas por voz; não prometa anticolusão. Replay completo futuro exige partida encerrada e autorização explícita.

## Implementação no M2

A credencial de retomada é um cookie HttpOnly/SameSite=Strict, com duas UUIDs criptográficas, validade de 24 horas, path `/api` e Secure configurável para HTTPS. O token fica no adaptador de sessões; a autoridade recebe somente um ID interno e resolve a associação sala/assento antes de deduplicar ou projetar. O link público carrega apenas código da sala. Uma nova conexão substitui a anterior; o socket antigo recebe `CONNECTION_REPLACED` e não reconecta automaticamente no cliente.

Origem exata é exigida em mutações HTTP e no handshake WS; `Origin` ausente também é recusado nesses casos. Schemas Zod estritos rejeitam campos extras e tentativas de enviar assento/entropia como autoridade. A aplicação reconfirma fase, dono da carta, contexto e revisão. A saída valida snapshots por schema e fecha conexão com sessão expirada ou fila acima do limite; falha de um destinatário não desfaz comando aceito nem impede retomada por outro socket.

Limites: 8 KiB por entrada HTTP/WS; 64 KiB por saída/fila nativa; 16 mensagens em processamento por socket; 60 mensagens WS/min por sessão; 120 requisições HTTP/min por IP real e 180/min por sessão; até 10 mil sessões e 10 mil chaves de rate limit. Cabeçalhos de IP encaminhado não são confiados. Os limites são defaults operacionais conservadores, não métricas de capacidade medidas em produção.

Não há coleta externa de analytics nem logging de payloads. Erros HTTP e WS usam allowlist/códigos estáveis, sem stack, carta, token ou seed. A retenção em memória da deduplicação é de 512 resultados recentes por sala, separada por jogador lógico e partida; revisão/contexto continuam rejeitando replay antigo depois da evicção. Reinício perde estado e credenciais; não registra derrota nem permite reconstruir uma sala com identidade do cliente.

## Política de criptografia e persistência

No primeiro acesso, o rascunho do apelido fica apenas no estado local da tela de boas-vindas; só a confirmação de um valor válido grava a preferência. Confirmar não cria uma sessão nem envia o apelido: o endpoint de convidado continua sendo chamado ao criar/entrar em sala. Depois da confirmação, edições no perfil atualizam/removem a preferência.

O apelido é gravado como preferência no `localStorage` do navegador, na chave `truco.nickname`, para evitar redigitação após recarregar ou perder a sessão. O valor é validado pelo contrato de apelido e fica em texto simples, limitado à origem, até ser substituído, apagado no campo ou removido junto aos dados do site. Não é credencial: scripts da mesma origem podem lê-lo. Cookies de sessão continuam HttpOnly; tokens, assentos, cartas e snapshots não são gravados nesse armazenamento. A sessão válida continua sendo a fonte da identidade e pode repor seu apelido mesmo após remover a preferência local. Bloqueio ou falta de espaço no armazenamento não impedem jogar; não há novo dado de jogador no banco.

O M4 acrescenta a preferência local `truco.audio`: somente volume entre 0 e 1 e um booleano para desligar efeitos. Valores lidos são validados; corrupção ou bloqueio de armazenamento usa o default sem impedir jogar. Acesso é restrito à mesma origem, retenção até alterar/remover os dados do site; não existe sincronização externa nem vínculo com conta. O sintetizador Web Audio cria sons próprios localmente, sem downloads ou envio de dados. Comparações de snapshots autorizados ficam somente em memória; reconexão/primeira carga não reproduzem eventos antigos. O localStorage continua sem tokens, cartas, assentos ou snapshots.

Estado atual: M2/M3/M4 não persistem jogadores, sessões ou salas no PostgreSQL. O banco local contém somente infraestrutura e fixtures de testes. O transporte local é HTTP/WS no loopback; não existe TLS publicado/configurado por esta entrega. O cliente seleciona WSS para backend HTTPS (ou página HTTPS quando não há URL configurada), mas essa seleção não instala certificados nem assegura o trajeto do proxy ao backend.

Antes de uma exposição pública, servir frontend/API por HTTPS e sockets por WSS, configurar cookies Secure e proteger também conexões remotas do banco por TLS com verificação de certificado. Caso haja proxy/CDN, o trecho até a origem também deve ser protegido ou permanecer num canal local controlado. Certificados, redirecionamento para HTTPS e políticas de transporte serão validados no deploy escolhido, sem tratar os defaults de desenvolvimento como configuração de produção.

TLS fornece confidencialidade e integridade em trânsito; não há necessidade atual de criar uma segunda criptografia própria de cada JSON. Criptografar cartas com chaves entregues ao mesmo navegador não substitui as projeções autorizadas: cartas de adversários continuam fora da mensagem.

Persistência de contas opcionais, cosméticos e resultados permanece no M5. Colete somente o necessário para os recursos aprovados. Ao introduzi-la, defina retenção, acesso e criptografia de banco/backups em repouso; a proteção dos campos deve acompanhar sua sensibilidade e o modelo de ameaças, com chaves separadas dos dados. Apelidos, identificadores de produto e resultados não exigem automaticamente criptografia de campo por campo. Dados pessoais sensíveis podem exigir proteção adicional.

Se forem adotadas senhas, armazenar somente hash apropriado para senhas, preferencialmente Argon2id com salt e parâmetros revisados; nunca senha em claro ou cifra reversível para autenticação. Se credenciais de sessão/retomada passarem a ser persistidas, armazenar verificadores/hash de tokens aleatórios quando apenas a comparação for necessária, não seu valor utilizável. Não foram criados modelos, migrações, login ou recursos de hospedagem nesta revisão.

Referências: [OWASP — WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html), [Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) e [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Setup do M5 — limite da proteção entregue

O incremento de 22/10/2026 cria tabelas/migrations para contas opcionais, cosméticos, progresso, resumos de resultados e fila PostgreSQL. Nenhum endpoint, login, worker ou escrita de jogador foi conectado ao runtime; as descrições de M2/M3/M4 acima continuam válidas para o jogo em execução. A necessidade de cada dado, acesso, retenção e exclusão está em [database.md](database.md#modelos-do-setup-m5).

Contas reservam login canônico e hash PHC Argon2id, não e-mail ou senha reversível. Sessões reservam hashes de tokens aleatórios, expiração e revogação. Restrições de formato não demonstram força da senha, custo do hash ou entropia do token. Implementar hashing/verificação, limites de tentativas e concorrência, rotação/revogação de sessões, CSRF, recuperação e reautenticação permanece obrigatório no incremento de autenticação. Schema sozinho não impede brute force.

XP e pontos não negativos, unicidade de conta por partida/recompensa, referências de catálogo e contexto competitivo/treino são defesas no banco. O futuro backend deve derivar usuário da sessão, rejeitar campos extras, calcular nível pelo XP confirmado, autorizar cada seleção e aceitar somente resultados da autoridade da sala. Não haverá endpoint público de incremento de XP/pontos ou confirmação de vitória. Catálogos/URLs são controlados pela aplicação, não por jogadores. A regex de caminho só restringe o formato; o catálogo futuro ainda deve conferir assets existentes e confiáveis.

Fila guarda apenas referência ao resumo da partida. O canal NOTIFY não contém IDs ou dados privados; notificações são visíveis a usuários do banco e não oferecem autenticação do conteúdo. Um aviso forjado apenas acordará o worker, que deverá consultar/validar tarefas reais. A função do trigger não é SECURITY DEFINER, fixa search_path e não tem EXECUTE público. Acesso à fila fica no backend; a role local proprietária não representa configuração segura de produção.

Sem integração de runtime, não se declara proteção implementada contra fraude de ranking, combinação de vitórias, elegibilidade incorreta, seleção indevida de cosmético ou repetição de efeitos do worker. TLS, criptografia de volumes/backups e papéis de produção continuam sem verificação de ambiente. A fila não recupera partidas que nunca foram persistidas.

### Segurança do consumidor PostgreSQL (M5, incremento 2)

O consumidor transacional agora existe como componente explícito, ainda sem processador de recompensas ou ativação no servidor. Não expõe HTTP/WS, não recebe XP/pontos ou timestamps de cliente e não executa código/URLs do job. Enqueue recebe transação existente e FK para resultado; o produtor autoritativo ainda será integrado. Políticas de login, antifraude e desbloqueio continuam pendentes.

Processador SQL e conclusão do job compartilham transação; erro reverte efeitos ao savepoint e conexões perdidas revertem todo o trabalho. Retentativas não dão garantia de exactly-once para serviços externos. Processadores são código confiável e não podem sair do handle transacional, confirmar/fechar transação ou executar I/O externo. A tipagem não substitui revisão dessas invariantes. Não misturar com outros consumidores que usem conclusão por lease/token sem revisar fencing.

NOTIFY/reconexão acordam varredura, sem usar payload como comando. Scheduler coalesce avisos e limita operações por rodada; retry e polling têm limites validados. Somente códigos fixos de falha são persistidos e os eventos operacionais não incluem IDs, payload, stack ou credenciais. Falha do sink de telemetria não altera o processamento. A conexão SQL deve ser fornecida pelo futuro bootstrap com privilégios mínimos, TLS validado e limites de pool; este incremento não configura produção nem armazena senhas na fila.

### SQL parametrizado e validação de entrada

A revisão da fila não encontrou concatenação de valores em SQL executável: tagged templates de Bun.SQL vinculam valores como parâmetros; templates comuns, concatenação com `+`, APIs `unsafe` ou `sql.raw` com dados de entrada não têm essa garantia. SQL de migrations e expressões de schema são código versionado, não consultas montadas a partir do navegador. A parametrização deve permanecer em todas as consultas, inclusive quando o valor veio do próprio banco, para evitar injeção de segunda ordem.

O produtor da fila agora recebe IDs/limites como `unknown` e valida tipo em runtime antes de gravar: ID opaco de 1 a 80 caracteres ASCII alfanuméricos, hífen ou underscore, conforme protocolo; tentativas como número inteiro entre 1 e 100, sem coerção de strings/objetos. Identificadores de schema/tabela/coluna, ORDER BY e comandos SQL ficam estáticos. Qualquer futura seleção dinâmica deve mapear enum validado para identificadores confiáveis; nunca interpolar um nome enviado pelo usuário como SQL livre.

Validar o contrato de cada campo é defesa adicional. Não usar blacklist de palavras como SELECT/DROP, remoção de aspas ou regex que tente reconhecer SQL como proteção principal. Um identificador válido chamado SELECT é dado literal; senhas/textos não devem ser reescritos para “escapar SQL”. Isso não altera os contratos de apelido existentes, autorização de recursos, validações de regras nem o requisito de privilégio mínimo no deploy.

Regressões reais exercitam payloads com aspas, comentários e separadores de instruções, tipos inesperados, limites e uma referência maliciosa já armazenada. A referência é tratada literalmente no processamento/UPDATE, sem atingir a linha de controle nem produzir incremento extra. Esses testes validam os caminhos exercitados, não comprovam segurança global do ambiente ou dos futuros endpoints de conta.

Testes de rede adicionais sobem o bootstrap real, duas sessões e HTTP/WebSocket para injetar payloads nos contratos existentes. Rejeições mantêm perfil/estado autoritativo e não bloqueiam comandos válidos posteriores; cookies maliciosos não autenticam. Isso cobre a fronteira de rede até a autoridade em memória. Como endpoints persistentes ainda não existem, a garantia HTTP → banco permanece pendente de integração; os testes PostgreSQL são separados e não substituem esse percurso futuro.

Referências: [Bun.SQL — tagged templates](https://bun.sh/docs/runtime/sql), [OWASP — SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).

## Privacidade dos poderes (M3)

Compromissos aceitos na preparação são privados até fechar o lote; só o indicador pronto é público. Gastos, uso e ativações aparecem juntos depois da resolução. Espião fica somente na projeção do usuário; parceiros não recebem esse resultado. O snapshot de reconexão aplica a mesma allowlist. O histórico público de ativações informa poder/autor/alvo, sem descarte, substituição ou carta investigada.

Máscara em vaza aberta envia somente assento, marcador e status, sem identidade física nem IDs correlacionáveis; o dono conserva sua visão. A resolução de vaza revela a carta. Corrida ou término sem resolução não a revela. Cartas cobertas e remanescentes continuam privadas, inclusive após término. Simulações usam dados sintéticos locais, sem analytics externo ou dados pessoais.

Poderes não usados são redigidos na projeção autoritativa, antes da serialização: `players[].power` é `null` para outros assentos até existir ativação pública aceita naquela mão. O dono recebe sua atribuição. A lista pública de ativações só muda no fechamento da preparação ou na jogada atômica; indicador de pronto não revela escolhas. Reconexão e término preservam esse contrato. Isso não impede deduções a partir de uma política de sorteio espelhado conhecida, nem comunicação entre jogadores fora do jogo.

A face revelada por Espião é renderizada somente a partir de `powers.intel` da projeção individual. A escolha visual de um verso fica em memória do componente e não é um ID de carta física nem altera a amostragem. Após uma jogada ainda opaca do alvo, a observação fica separada dos versos remanescentes como memória histórica, até uma jogada já autorizada revelar o mesmo valor/naipe desse assento ou a contagem da mão chegar a zero; a UI nunca usa a remoção de um verso para descobrir qual carta mascarada/coberta saiu. Nenhuma carta extra, posição privada ou identificador de rastreamento foi acrescentado ao transporte ou armazenamento local.

## URL pública do backend

`VITE_BACKEND_URL` é configuração pública de build, nunca um segredo ou token. Aceita somente uma origem HTTP(S), sem credenciais, caminho, query ou fragmento. O cliente mantém cookies HttpOnly e envia requisições com credentials=include; CORS libera leitura credenciada somente para origens exatas de `ALLOWED_ORIGINS`, sem wildcard, inclusive respostas de erro. Preflights permitem apenas GET/POST e Content-Type e não criam sessão. A validação de origem das mutações e do handshake WS continua obrigatória; middleware CORS não altera os headers de upgrade.

SameSite=Strict permanece habilitado: front e backend acessados diretamente precisam compartilhar o mesmo site e esquema. Hospedagem entre sites diferentes exige proxy `/api` na origem do frontend, sem flexibilizar o cookie. A variável não comprova TLS, certificados ou configuração de hospedagem; nenhuma publicação foi feita nesta alteração.

A edição de apelido por POST `/api/guest` reutiliza a credencial atual, após a mesma validação de origem e schema. Ela não altera ID, token, expiração, assentos existentes nem permissões; só o apelido em memória usado nas próximas entradas. Não acrescenta persistência de dados pessoais.

`truco.locale` guarda apenas a preferência local de idioma (`pt-BR` ou `en`) do tutorial. Não é enviado ao servidor nem contém dados pessoais, cartas ou credenciais. Permanece até ser substituído ou os dados do site serem apagados; sua finalidade é reabrir o guia no idioma escolhido. Armazenamento bloqueado é tolerado. O tutorial não cria sessões nem salas.

## Ferramentas de teste e bot solo

Conforme [ADR 009](adr/009-solo-training-and-development-tools.md), a habilitação do bot é independente do ambiente. Ferramentas de edição exigem servidor explicitamente development, flag própria, sala solo e dono autenticado. Builds de produção não incluem o painel; requests forjados continuam sujeitos ao bloqueio autoritativo. Nunca use flags VITE, query strings, localStorage ou dados do cliente como autorização. O bot recebe somente sua projeção. Identificadores internos do assento do bot não são publicados. Salas sem humanos conectados expiram; bot não impede limpeza.
