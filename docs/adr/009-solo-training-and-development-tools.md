# ADR 009 — Treino solo e ferramentas de desenvolvimento

Status: aceito por solicitação explícita do usuário em 19/10/2026. Amplia o escopo anterior que adiava bots de produção somente para um bot simples de treino, sem ranking ou progressão.

## Decisão

“Jogar” cria uma sala solo 1v1 privada e inicia automaticamente ao conectar o dono. O bot ocupa o outro assento; terceiros não podem entrar. Reutiliza `chooseAction` de game-sim pela entrada pública do pacote, com política conservadora e exclusivamente `projectPlayerView` do próprio assento. Não lê mãos adversárias, monte, sementes ou estado secreto para decidir. Todos os comandos continuam passando pelo motor e pela fila única da sala. Pausas de apresentação permanecem; o bot pensa por 1 s em cada decisão. Sem humano conectado, o bot não joga e a sala expira normalmente. Revanche solo inicia outra partida; Voltar ao menu sai da sala. Multiplayer mantém o fluxo de lobby existente.

`ENABLE_SOLO=true` habilita a criação independentemente do ambiente. Padrão do servidor: desabilitado. `/api/features` comunica somente a disponibilidade pública. A flag é conferida também na aplicação, não apenas no botão.

`ENABLE_DEV_TOOLS=true` requer **NODE_ENV exatamente development**, além de sala solo e assento do dono. Produção, test ou ambiente ausente nunca habilitam essas mutações, mesmo com a flag ligada. O frontend exige adicionalmente `import.meta.env.DEV`; o painel é importado condicionalmente e não entra no build de produção. Esconder a UI não substitui a validação do servidor.

`DEV_RESET_HAND` aceita três cartas distintas opcionais, poder e energia (0–3). Tem o mesmo envelope de contexto/revisão, autenticação, limite de mensagens e cache de idempotência dos demais comandos. Rejeições precedem consumo de entropia. A aplicação inicia nova mão sem aplicar pontos, limpa compromissos/intel/jogadas, incrementa revisão e troca o contexto do timer. Cartas escolhidas são permutadas com a distribuição nova, inclusive vira/monte/mão do bot, conservando as 40 identidades. Não é uma operação disponível a partidas multiplayer. Mãos de onze/11×11 preservam suas regras e não permitem forçar poderes.

A opção “Aplicar cenário e reiniciar mão” explicita que editar um cenário reinicia a mão completa, preservando o placar. Não altera uma vaza parcialmente resolvida. “Reiniciar mão aleatória” redistribui sem forçar cartas/poder. O jogo continua enquanto o painel está aberto, informado na UI. Ferramentas futuras como pausar simulação, editar adversário ou escolher vira exigem novos comandos validados, não acesso direto ao estado.

## Verificação

Testes cobrem partida completa contra bot, revanche, expiração sem humanos, projeções, conservação do baralho, rejeição de duplicatas, contextos obsoletos, idempotência e flags independentes. Integração real HTTP/WS comprova que produção e test recusam mutações dev. `test:e2e:solo` separa Vite dev e build de produção, nos perfis desktop/mobile. Nenhum deploy é parte deste incremento.
