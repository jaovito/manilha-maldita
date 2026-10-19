# Regras implementáveis do Truco Caótico

Fonte normativa do comportamento do jogo no MVP. Leia antes de alterar regras, poderes, pontuação, turnos, temporizadores ou reconexão. A visão de produto está em [GDD.md](../GDD.md); intenções futuras ali descritas não ampliam este contrato. Custos e tempos continuam sujeitos a playtests, sem ajustes silenciosos.

## Regras-base: contrato implementável

Vocabulário: **partida** (`match`) vai até 12 pontos; **mão** (`hand`) distribui três cartas; **vaza** (`trick`) recebe uma carta de cada participante.

### Baralho, assentos e comparação

40 cartas, quatro naipes, ranks em força normal crescente: `4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3`. Embaralhe a cada mão; distribua três cartas por jogador e uma vira, sem reposição.

Manilha é o sucessor da vira nesse ciclo, incluindo `3 -> 4`. Toda manilha vence qualquer comum; entre manilhas: `ouros < espadas < copas < paus`. Naipes não desempatarão comuns. Identidade física e força efetiva são distintas.

Assentos horários: A0/B0 no 1v1; A0/B0/A1/B1 no 2v2. Sorteie o iniciador da partida e avance um assento por nova mão, inclusive após anulação. Cada jogador coloca uma carta por vaza; parceiros não somam forças.

A maior força determina o resultado: máximas nas duas equipes empatam; máximas somente numa equipe fazem essa equipe vencer. Inicia a próxima vaza o autor da carta vencedora; havendo máximas iguais entre parceiros, o primeiro a jogá-la. Empate entre equipes conserva o iniciador da vaza empatada.

### Encerramento e empates

Encerre assim que definido, nos dois formatos. Tabela simétrica para A/B:

| Resultados das vazas | Vencedor da mão |
|---|---|
| A, A | A, imediatamente |
| A, empate | A, imediatamente |
| empate, A | A, imediatamente |
| A, B, A | A |
| A, B, B | B |
| A, B, empate | A, vencedor da primeira |
| empate, empate, A | A |
| empate, empate, empate | Anulada, zero pontos |

Três empates sem pontos são convenção do produto, não regra universal de Truco.

### Cartas cobertas

Permitidas da segunda vaza em diante. Consomem carta e perdem para qualquer aberta ou mascarada revelada; todas cobertas produzem empate. Não revele identidade aos demais. Não combine coberta com poder de carta.

### Apostas

Escala `1 -> 3 -> 6 -> 9 -> 12`. Só o jogador do turno inicia pedido antes de jogar. Negociação pendente bloqueia cartas/poderes.

Separe `acceptedStake`, `pendingStake`, `lastRaisingTeam`, `resumeTurnSeat`:

- Aceitar confirma o valor proposto e retoma o turno salvo.
- Correr concede ao solicitante o valor já aceito, não o pendente.
- Contra-aumentar **aceita implicitamente a proposta anterior**, propõe o próximo nível e transfere a resposta.
- Não pule níveis nem aumente a própria proposta. Após aceitação, só a outra equipe pode iniciar novo aumento, num turno permitido.
- No 2v2, qualquer parceiro desafiado responde; a primeira resposta válida serializada é definitiva. Responder não muda a vez.
- Em 12, somente aceitar/correr. Correr fora de aposta pendente ou decisão de onze não existe no MVP; desistência de partida é separada.

Regressões: A pede 3, B propõe 6, A corre: **B ganha 3**. Com 6 aceito e 9 pendente, correr concede 6.

Pontue uma única vez, limitando o placar a 12 e registrando a recompensa original no evento. Ao alcançar 12, encerre sem nova distribuição. Abandono/falha técnica usam motivos próprios.

### Onze e mão decisiva

Uma só equipe em 11: observa cartas/vira e escolhe jogar por 3 ou correr, concedendo 1. No 2v2, vê cartas do parceiro durante a decisão; informação revelada não pode ser considerada esquecida. Primeira resposta válida da equipe prevalece.

Em 11×11: **mão decisiva aberta para o dono das cartas**. Cada um vê só as próprias cartas, não as do parceiro. Vale 3, sem decisão de correr nem cartas cobertas. Não implemente jogo às cegas por associá-lo ao nome “mão de ferro”. Três empates repetem a mão com iniciador rotacionado.

Ambas as mãos especiais proíbem aumentos, poderes e futuros eventos; não sorteiam poderes nem alteram energia, inclusive regeneração. Essas convenções prevalecem sobre efeitos comuns.

## Distribuição e ciclo dos poderes

### Sorteio e energia

Por mão comum: distribuir cartas, revelar vira, regenerar energia quando aplicável, sortear poderes e entregar cada poder somente ao seu dono; energia permanece pública. O poder expira ao fim da mão; não é guardável ou negociável.

- Energia individual: inicial 2, máxima 3, regeneração +1 por nova mão habilitada, exceto a primeira da partida.
- Uma ativação bem-sucedida por jogador/mão, também no 2v2; não é limite por equipe.
- Casual: um poder uniforme e independente por jogador; repetições permitidas.
- Competitivo 1v1: um poder uniforme, igual para ambos.
- Competitivo 2v2: dois poderes distintos uniformemente sorteados; uma cópia de cada por equipe, atribuídas aleatoriamente aos parceiros.
- Ambos os presets usam os mesmos quatro poderes no MVP. Não adicione experimentos só para diferenciá-los.
- Não adapte sorteio a conta, placar, cartas, energia ou histórico. Energia insuficiente desabilita a ativação, sem reroll compensatório.
- O poder sorteado é privado ao dono, inclusive em relação ao parceiro. Outros jogadores e a projeção pública só recebem sua identidade após uma ativação aceita.
- Energia, pronto, ativação resolvida e alvo são públicos; resultados de informação e trocas respeitam privacidade. Pronto não revela a intenção selada.
- Espião/Segunda Chance revelam o poder somente no fechamento do lote da preparação; Impulso/Máscara, junto da jogada aceita. A revelação da Máscara não revela a identidade da carta antes da resolução.
- Rejeição, passe, expiração, fim da mão/partida e reconexão não revelam poderes nunca usados. Cada nova mão oculta novamente as novas atribuições.

A política competitiva espelhada ainda permite deduzir poderes a partir da própria atribuição; ocultar o snapshot não elimina essa inferência. Sua substituição por sorteio independente está pendente de decisão do proprietário. Espelhamento é simetria de acesso, não garantia de equilíbrio posicional. Não elimine a aleatoriedade escolhida pelo proprietário.

### Preparação selada e ordem de resolução

Antes da primeira vaza, cada jogador envia uma intenção única e definitiva: poder de preparação com parâmetros válidos ou passe. Poder de turno permanece disponível após o passe. Timeout passa. Indicador público de pronto não distingue passe de ativação.

Não publique escolhas, gastos, alvos ou resultados até todos responderem ou expirar o prazo. Valide energia, uso e alvo ao aceitar cada intenção. Resolva o lote atomicamente:

1. Retire todas as cartas escolhidas para Segunda Chance.
2. Distribua substituições sem reposição, por assento a partir do iniciador.
3. Resolva Espião nas mãos **já atualizadas**.
4. Aplique gastos/usos, publique ativações e envie resultados privados aos destinatários.
5. Abra o primeiro turno.

Descartes não retornam ao monte na mão. Não intercale jogadas nem permita rever a intenção após observar os outros. A resolução independe da ordem de chegada dos pacotes.

### Catálogo do MVP

| Poder | Custo | Janela | Contrato |
|---|---:|---|---|
| Espião | 1 | Preparação | Escolher adversário e descobrir uma carta uniforme de sua mão final. |
| Segunda Chance | 2 | Preparação | Descartar uma carta própria escolhida e comprar do monte restante. |
| Impulso | 2 | Sua jogada | Carta comum ganha um nível normal de força nesta vaza, teto no 3. |
| Máscara | 1 | Sua jogada | Carta oculta para todos, exceto dono, até resolução; disputa com força integral. |

**Espião:** resultado só ao usuário, não automaticamente ao parceiro. Não permite escolher a identidade física da carta, não altera mãos e não revela o monte. Na interface, clicar em um verso anônimo escolhe o adversário; a observação aleatória aparece naquele verso após a resolução. Após jogar outra carta aberta, a face observada continua ocupando um dos slots restantes, nunca um slot extra. Se houver jogada ainda opaca do alvo, a observação vira uma anotação textual de memória fora dos slots, pois não é possível confirmar se continua na mão. Essa memória não rastreia cartas ainda na mão nem jogadas ocultas. Quando uma jogada visível desse alvo, atual ou em vaza concluída, revela o mesmo valor e naipe, a observação deixa o assento; também desaparece quando a contagem da mão chega a zero. Carta coberta ou Máscara ainda oculta não informa se a carta observada saiu. Dois espiões podem descobrir a mesma carta, sem compensação.

**Segunda Chance:** não compra vira, cartas distribuídas ou descartadas, inclusive a devolvida. Descarte/substituição são privados; mão continua com três cartas.

**Impulso:** rejeite manilha, coberta e 3 comum, sem gastar. Ganhar nível normal de um rank que coincide com manilha não cria manilha: a classe continua comum. Não altere identidade física.

**Máscara:** aceita comum/manilha, nunca coberta. Mostre marcador inequívoco; não envie valor real antecipadamente para apenas escondê-lo com CSS. Se a mão encerrar por corrida antes da revelação, a carta permanece oculta aos demais durante a partida. Fim de mão não revela automaticamente mãos remanescentes/descartes.

Impulso/Máscara acompanham `PLAY_CARD` atomicamente. A UI seleciona poder antes da carta; o servidor valida junto e publica efeito antes da representação da jogada. Não crie buff órfão nem permita intercalar aposta. Rejeição não consome carta, energia, uso ou aleatoriedade.

### Limites e expansões

Sem reações aninhadas, contra-mágicas, retroatividade ou cadeias infinitas. Poder não cria/copia manilha, supera manilha com força comum, obriga aceitar Truco, muda pontos ou desfaz vaza.

Não implementar agora: Pressão, Reflexo, Tudo ou Nada, Aposta Arriscada, Escudo, Conexão e eventos. Poderes de pontuação do rascunho eram redundantes, não funcionalidades aprovadas. Expansões exigem alvo, janela, custo, duração, visibilidade, ordem, interações, falhas e testes. Configuração de balanceamento é versionada e congelada por partida.

## Tempo, reconexão e término anormal

Defaults de playtest; casual configura antes da partida, competitivo usa preset fixo:

| Decisão | Casual | Competitivo |
|---|---:|---:|
| Preparação | 15 s | 10 s |
| Carta | 30 s | 20 s |
| Aposta/onze | 20 s | 15 s |
| Proteção cumulativa de reconexão por assento/partida | 60 s | 30 s |

Servidor controla deadlines; timers identificam partida/fase/decisão e ignoram contexto obsoleto. Comando recebido no deadline ou depois está expirado. UI só estima o restante.

Timeout: preparação passa; aposta/onze corre; carta joga aberta a de menor força efetiva, sem poder, empatando por identidade interna determinística. Fallback não depende de cartas ocultas alheias.

Reconexão preserva assento. Pausa protegida consome orçamento cumulativo, sem recarga, só quando uma decisão depende do ausente. Parceiro conectado ainda responde decisões de equipe. Retome tempo restante, não inteiro; pausas simultâneas não se somam artificialmente.

Após proteção, aplique fallbacks. Três decisões exigidas do mesmo jogador expiradas consecutivamente causam abandono; ação válida dele zera a sequência. No 2v2, abandono derrota a equipe. Ambas as equipes inteiramente ausentes: expire sem vencedor, sem autojogadas ilimitadas.

Casual pode desligar relógio de cartas, não expiração de salas vazias/desconectadas. Distinga desistência, abandono e falha técnica. Queda do processo com estado em memória é falha técnica, não derrota: documente que o MVP não recupera partidas após reinício sem persistência implementada.

## Treino solo e cenários de desenvolvimento

Por autorização de 19/10/2026, “Jogar” pode iniciar treino 1v1 contra bot simples, sem alterar regras, poderes ou pontuação. O bot usa somente informação autorizada de seu assento. A criação depende de flag independente. Revanche solo é imediata; não exige confirmação de um segundo humano.

Somente em development e em mesa solo do dono, um comando de ferramentas reinicia a mão com cartas/poder/energia escolhidos. Mantém placar, unicidade das cartas e restrições de onze/11×11. É ferramenta de teste, indisponível em partidas multiplayer e produção. Veja [ADR 009](adr/009-solo-training-and-development-tools.md).
