# ADR 005 — Composição pura das regras-base do M1

Estado: aceita para o M1, 18/10/2026.

## Contexto

O bootstrap e os resolvedores de cartas/vazas não permitiam concluir uma partida. O M1 exige apostas, onze e um ciclo testável, preservando privacidade e autoridade sem antecipar o servidor do M2 ou poderes do M3.

## Decisão

Compor funções puras em `game-core/match`, com fases discriminadas e transições imutáveis. `startMatch` recebe contagem, iniciador e escolhas de Fisher–Yates confiáveis. `executeCommand` recebe assento resolvido pela aplicação e revisão esperada. `dealNextHand` distribui somente após `HAND_END`, com rotação e nova entropia explícita. Distribuição e resolução são síncronas; não há espera por animação ou relógio.

Apostas têm valor aceito e proposto separados; contra-aumento aceita o anterior antes de propor o próximo. Onze e 11×11 são discriminadas por `hand.kind`, proibindo apostas. Pontuação ocorre apenas no encerramento, limita o placar a 12 e preserva a recompensa original em evento. As cartas continuam conservadas entre mãos restantes, vira, monte e jogadas concluídas/em curso.

Projeções por allowlist são separadas do estado. Mãos ocultas expõem contagem, e cartas cobertas não recebem identidade pública. A equipe de onze mantém a informação já conhecida na mão; 11×11 concede somente a mão própria. Eventos do motor não contêm cartas privadas.

## Consequências e limites

O motor conclui partidas de regras-base em testes sem runtime, rede ou banco. Isso não cria um modo clássico de produto. Poderes/energia/preparação ainda não existem e entram no M3, com mãos especiais sem sorteio nem regeneração. Sessões, filas por sala, identidade da partida, relógios e reconexão entram no M2.

Revisão antiga impede reaplicar uma transição aceita. Esse mecanismo não substitui a deduplicação da aplicação com `commandId`, autenticação e devolução do ACK original. O adaptador também deve impedir comandos de outra partida e gerar entropia uniforme criptográfica. O estado interno nunca deve ser enviado diretamente ao cliente. Não há persistência ou recuperação de partidas após queda do processo.
