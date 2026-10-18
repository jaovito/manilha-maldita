# Truco Caótico — Game Design Document

**Versão:** 0.1 — Proposta de pré-produção  
**Estado:** Design inicial, pendente de playtests  
**Público:** Jogadores casuais, grupos de amigos e pessoas que gostam de Truco competitivo  
**Plataformas:** Desktop e navegadores mobile


> **Escopo consolidado do MVP:** quatro poderes — Espião, Segunda Chance, Impulso e Máscara — disponíveis tanto no casual quanto no competitivo. As modalidades diferem pela política de sorteio e pelos temporizadores. Salas públicas, eventos e poderes experimentais ficam fora do MVP. As ideias futuras abaixo não constituem funcionalidades aprovadas.
>
> **Contrato para implementação:** [docs/rules.md](docs/rules.md) consolida as convenções vigentes, incluindo preparação selada, apostas, mãos especiais, temporizadores e reconexão. Use esse documento para implementar e testar o comportamento. Este GDD mantém a visão de produto e as propostas de expansão; novas divergências devem ser resolvidas explicitamente, sem alterar decisões de produto silenciosamente.

---

## 1. Visão do produto

Truco Caótico é um jogo de cartas multiplayer baseado no Truco Paulista. O jogo preserva as regras fundamentais do Truco, incorporando poderes sorteados que alteram informações, força de cartas e possibilidades estratégicas.

O objetivo é oferecer partidas rápidas, sociais, competitivas e com alto potencial de rejogabilidade.

### Objetivos principais

1. Permitir jogar 1v1 ou 2v2 em salas privadas.
2. Ser compreensível para quem já conhece Truco.
3. Adicionar profundidade sem criar centenas de regras adicionais.
4. Oferecer modalidades casual e competitiva.
5. Permitir poderes aleatórios sem benefícios pagos.
6. Garantir que o servidor controle todas as decisões e informações secretas.

### Fora do escopo inicial

Não haverá ranking global, loja de itens, torneios, campanha, bots sofisticados ou aplicativos nativos no MVP.

---

## 2. Regras-base da partida

### Baralho

- 40 cartas, sem 8, 9, 10 ou curingas.
- Três cartas por jogador, distribuídas sem reposição.
- Uma carta adicional é revelada como vira.
- Um novo embaralhamento ocorre a cada mão.

**Hierarquia normal, da mais forte para a mais fraca:**

3 > 2 > A > K > J > Q > 7 > 6 > 5 > 4.

A manilha corresponde ao valor imediatamente seguinte à vira, no ciclo:

4 → 5 → 6 → 7 → Q → J → K → A → 2 → 3 → 4.

As quatro manilhas vencem qualquer carta normal. Entre manilhas, a ordem é:

Paus > Copas > Espadas > Ouros.

### Partida

- Uma partida termina quando uma equipe alcança 12 ou mais pontos.
- Uma mão tem até três vazas.
- Em cada vaza, cada jogador ativo coloca exatamente uma carta.
- O jogador ou a equipe vencedora da mão recebe a pontuação em disputa.
- Os parceiros são posicionados alternadamente no 2v2.
- O jogador que inicia a mão gira na ordem dos assentos a cada nova mão.
- A equipe vencedora de uma vaza inicia a próxima; em 2v2, inicia o jogador daquela equipe que jogou a carta vencedora.
- Em caso de empate de vaza, inicia a próxima o jogador que iniciou a vaza empatada.

### Empates

Para impedir interpretações diferentes, adotaremos estas regras:

| Resultado das vazas | Resultado da mão |
|---|---|
| A vence a primeira; segunda empata | A vence |
| Primeira empata; A vence a segunda | A vence |
| Primeira e segunda empatam; A vence a terceira | A vence |
| A vence a primeira; B vence a segunda; terceira empata | A vence |
| As três empatam | Mão anulada, sem pontos |
| A mesma equipe vence as duas primeiras | Mão encerrada imediatamente |

Em empates na primeira vaza, não há desempate artificial por naipe de cartas comuns. Os empates continuam obedecendo à precedência das vazas.

### Cartas cobertas

Permitidas apenas a partir da segunda vaza.

Uma carta coberta equivale a uma carta sem força de disputa: perde para qualquer carta aberta e empata com outra carta coberta quando ambas forem as mais fortes restantes do confronto.

A carta coberta é consumida normalmente e não tem seu valor revelado durante a mão.

### Pontuação e apostas

As apostas seguem a sequência:

1 → 3 → 6 → 9 → 12.

Em um pedido de aumento, a equipe adversária pode:

- **Aceitar:** a mão passa a valer o novo montante.
- **Correr:** a equipe que pediu recebe o valor anteriormente aceito.
- **Aumentar:** propõe o próximo valor, transferindo a decisão para a outra equipe.

O valor não aumenta enquanto o pedido estiver pendente.

Não é possível pular níveis de aposta, e uma equipe não pode fazer dois aumentos consecutivos sem que a outra equipe tenha assumido o aumento intermediário.

Os pedidos podem ser feitos pelo jogador cuja vez está ativa, antes de jogar sua carta. Enquanto existe uma resposta pendente, nenhuma carta pode ser jogada.

No 2v2, qualquer membro da equipe desafiada pode responder; a primeira resposta válida recebida pelo servidor é definitiva para a equipe.

### Mão de onze

Quando uma equipe chega a 11 pontos:

- A equipe recebe suas cartas e observa a vira.
- Os jogadores dessa equipe podem visualizar as cartas do parceiro durante a decisão, no 2v2.
- A equipe decide jogar por 3 pontos ou correr e conceder 1 ponto aos adversários.
- Se jogar, não são permitidos novos pedidos de Truco.
- Poderes ficam desativados nessa mão.

No 1v1, a decisão é individual.

Quando ambas as equipes têm 11 pontos, ocorre a **mão de ferro**: a mão vale 3 pontos, não há poderes, pedidos de aumento ou cartas cobertas. A partida termina quando houver um vencedor.

Estas são convenções escolhidas para o jogo; outras variantes de Truco podem tratar situações especiais de maneira diferente.

---

## 3. Modalidades

### Casual — Truco Caótico

O foco é jogar com amigos, experimentar poderes e produzir reviravoltas.

- Poderes sorteados independentemente para cada jogador.
- Pode haver poderes repetidos entre adversários.
- No MVP, apenas Espião, Segunda Chance, Impulso e Máscara, sem efeitos de pontuação.
- Habilidades experimentais e eventos são propostas futuras, fora do MVP.
- Sem ranking competitivo.
- Salas privadas no MVP; salas públicas ficam para depois.
- O anfitrião configura os temporizadores antes da partida.

### Competitivo — Truco Estratégico

O foco é reduzir vantagens criadas exclusivamente pelo sorteio de poderes.

- No MVP, os mesmos quatro poderes do casual, com sorteio espelhado; o equilíbrio ainda depende de playtests.
- Sorteio espelhado entre as duas equipes.
- Cada poder é conhecido somente pelo dono até sua ativação, inclusive em relação ao parceiro.
- Sem eventos aleatórios adicionais.
- Sem poderes que alterem a pontuação de uma mão.
- Regras fixas e temporizadores padronizados.
- Reconexão, desistência e limites de inatividade padronizados.

**Sorteio espelhado:**

No 1v1, o servidor sorteia um poder e ambos os jogadores recebem o mesmo.

No 2v2, o servidor sorteia dois poderes distintos, A e B. Cada equipe recebe uma instância de A e uma de B, distribuídas aleatoriamente entre seus integrantes.

Isso mantém a aleatoriedade desejada, mas evita que uma equipe receba um conjunto de habilidades objetivamente mais forte que o da outra.

O sorteio espelhado reduz a assimetria de acesso aos poderes, mas não garante equilíbrio perfeito, porque a ordem dos turnos, as cartas e a interação entre habilidades continuam afetando as vantagens. Mesmo sem exposição de atribuições alheias, essa política permite inferir poderes. Mudar o competitivo para sorteio independente está pendente de decisão do proprietário.

### Truco Clássico (futuro)

Um terceiro modo poderá simplesmente desativar todas as habilidades, reutilizando o mesmo motor de Truco.

---

## 4. Sistema de poderes

### Distribuição

No início de cada mão, depois da distribuição de cartas e da revelação da vira:

1. O servidor determina o conjunto de poderes permitido para a modalidade.
2. Sorteia um poder para cada jogador, obedecendo à política casual ou competitiva.
3. Entrega cada poder somente ao dono; parceiros e adversários não veem atribuições ainda não usadas.
4. Libera as janelas de ativação.
5. No encerramento da mão, descarta os poderes sorteados e sorteia novos na próxima.

O sorteio não utiliza níveis, vitórias anteriores, dinheiro, cosméticos ou progressão da conta.

### Energia

Cada jogador possui uma reserva individual.

| Propriedade | Regra |
|---|---|
| Energia inicial | 2 |
| Regeneração | +1 por nova mão, exceto na primeira |
| Energia máxima | 3 |
| Usos por mão | Máximo de 1 |
| Custo de habilidade | 1, 2 ou 3 |
| Energia insuficiente | Habilidade indisponível |

A energia pode acumular entre mãos, mas nunca ultrapassa 3.

No começo de uma partida, o primeiro sorteio já ocorre com 2 pontos de energia. Nas mãos especiais sem poderes, a reserva permanece inalterada.

A energia de todos os jogadores é pública. A identidade de um poder só se torna pública após uma ativação aceita: na resolução selada da preparação ou junto da jogada. Poderes nunca usados continuam ocultos ao encerrar a mão/partida. O resultado de um poder de informação permanece privado ao beneficiário.

### Janelas de ativação

Os poderes devem especificar uma janela única:

- **Preparação:** após o sorteio de poderes e antes da primeira jogada.
- **Sua vez:** antes de colocar uma carta, enquanto não existe pedido de Truco pendente.
- **Reação:** somente quando um efeito específico oferece uma oportunidade de resposta.
- **Resolução:** efeitos previamente ativados são processados automaticamente.

A primeira versão deve evitar reações aninhadas e múltiplas ativações concorrentes.

Um jogador pode passar pela preparação sem ativar nada, mantendo seu poder disponível caso ele possua uma janela posterior.

### Limitações universais

1. Nenhuma habilidade pode criar uma manilha física.
2. Modificadores de força não podem superar manilhas.
3. Nenhuma habilidade pode impedir uma equipe de correr de um pedido de Truco.
4. Poderes não podem modificar cartas que já tiveram o resultado resolvido.
5. Efeitos não podem continuar indefinidamente entre mãos.
6. O cliente nunca decide o resultado de uma habilidade.
7. Poderes direcionados precisam indicar explicitamente seu alvo válido.
8. Se não houver alvo válido, a ativação é rejeitada sem consumo de energia.
9. A resolução de efeitos deve ser determinística após sorteios gerados pelo servidor.
10. Informações privadas nunca são incluídas nas atualizações públicas da sala.

---

## 5. Catálogo inicial de habilidades

### Poderes do MVP — casual e competitivo

| Poder | Custo | Efeito | Janela |
|---|---:|---|---|
| Espião | 1 | Revela ao usuário uma carta aleatória ainda não jogada de um adversário | Preparação |
| Segunda Chance | 2 | Troca uma carta escolhida da própria mão por outra sorteada do baralho restante | Preparação |
| Impulso | 2 | Aumenta em um nível a força efetiva da próxima carta comum jogada | Sua vez |
| Máscara | 1 | Oculta temporariamente a identidade da próxima carta, revelando-a na resolução da vaza | Sua vez |

**Especificações especiais:**

**Espião:** no 2v2, o jogador escolhe qual adversário investigar. A carta revelada é aleatória. A informação é enviada exclusivamente ao jogador que ativou a habilidade, não ao parceiro. O poder não altera a mão investigada.

**Segunda Chance:** a carta descartada vai para uma zona fora do baralho, sem retornar nesta mão. A nova carta vem do conjunto restante, sem reposição. A vira nunca pode ser comprada. A troca ocorre antes da primeira vaza.

**Impulso:** funciona apenas com uma carta que não é manilha. Aumenta a força efetiva em exatamente um nível da hierarquia comum, com teto no nível do 3. O efeito altera somente a comparação; o identificador, o naipe e a identidade física da carta não mudam. A habilidade é anunciada antes da escolha da carta.

**Máscara:** a carta permanece oculta para os adversários até todos os jogadores concluírem a vaza. Quando revelada, conserva sua força integral. É diferente de uma carta coberta tradicional, que não disputa força. A interface deve distinguir claramente os dois efeitos.

### Ideias para o casual — fora do MVP

| Poder | Custo | Efeito |
|---|---:|---|
| Reflexo | 2 | A carta comum jogada empata com a carta comum mais forte já revelada na vaza |
| Aposta Arriscada | 2 | Antes da primeira jogada, aposta na vitória da equipe; adiciona 1 ponto ao vencedor se a previsão estiver correta, ou 1 ponto aos adversários caso esteja errada |
| Tudo ou Nada | 3 | Antes da primeira jogada, acrescenta 1 ponto à recompensa de quem vencer a mão |
| Pressão | 1 | Reduz para 5 segundos a próxima decisão de carta do adversário escolhido, respeitando as configurações de acessibilidade |

Esses quatro poderes são **experimentais e não aprovados para implementação**. As regras abaixo registram a proposta original para avaliação futura. Se retomados, os modificadores de pontos precisariam ser aplicados somente à pontuação final da mão, sem mudar o valor dos pedidos intermediários de Truco.

Para evitar combinações difíceis de controlar, apenas um modificador adicional de pontuação pode ser registrado por equipe em uma mão, e cada equipe pode receber, no máximo, um ponto adicional por habilidade naquela mão. O placar fica limitado a 12 pontos.

**Reflexo** exige pelo menos uma carta comum adversária já revelada na vaza e não afeta manilhas.

**Pressão** não substitui configurações de acessibilidade obrigatórias. Por esse motivo, não estará disponível em partidas competitivas e poderá ser desativada pelo anfitrião.

### Poderes rejeitados para o lançamento

- Roubar uma carta da mão de outro jogador.
- Escolher uma manilha diferente.
- Anular uma vaza já resolvida.
- Impedir o adversário de pedir Truco.
- Obrigar um adversário a descartar sua melhor carta.
- Duplicar todos os pontos da mão.

Essas habilidades podem ser interessantes visualmente, mas criam assimetrias grandes, prejudicam a identidade do Truco ou tornam o resultado excessivamente dependente do sorteio.

---

## 6. Eventos especiais — fora do MVP

Nenhum evento será implementado no MVP. O restante desta seção registra uma proposta futura, sujeita a aprovação e playtests: eventos restritos ao modo casual e desativados por padrão.

Quando ativados, ocorrem a cada três mãos concluídas. O evento é sorteado e anunciado antes da distribuição da próxima mão.

### Conjunto inicial

- **Energia Extra:** todos recebem uma energia adicional até o limite de 3.
- **Mão Misteriosa:** a vira é revelada somente depois da primeira vaza; as cartas jogadas nessa vaza são resolvidas após a revelação, sem modificar suas identidades.
- **Rodada Rápida:** todos os jogadores passam a ter um temporizador menor.
- **Silêncio Mágico:** nenhum poder pode ser ativado naquela mão.

Eventos não ocorrem na mão de onze nem na mão de ferro.

Se a expansão de eventos for aprovada, a proposta é começar por Energia Extra e Silêncio Mágico. Os outros exigem validações adicionais de jogabilidade.

---

## 7. Fluxo da sala

### Criação

O jogador acessa o site e escolhe **Criar Sala**.

Ele informa um apelido, escolhe 1v1 ou 2v2, casual ou competitivo, e recebe um código curto e um link de convite.

Não é obrigatório criar uma conta.

### Lobby

O lobby apresenta:

- Jogadores conectados.
- Assentos e equipes.
- Configurações da partida.
- Indicadores de pronto.
- Controle para iniciar, disponível ao anfitrião quando todos estiverem prontos.

No 2v2, é possível escolher parceiros ou usar distribuição aleatória de equipes.

Jogadores podem sair e retornar ao lobby. Após iniciar uma partida, as equipes não podem ser modificadas.

### Durante a partida

A interface mostra cartas próprias, vira, manilhas, placar, energia, poderes, vez atual, pedidos de Truco e histórico público de jogadas.

Cada jogador vê apenas suas próprias cartas, salvo efeitos permitidos por habilidades e regras especiais.

### Finalização

Ao terminar, a tela de resultado apresenta:

- Equipe vencedora.
- Placar final.
- Mãos disputadas.
- Poderes utilizados.
- Principais viradas da partida.
- Opção de revanche com as mesmas equipes.

As informações ocultas podem ser disponibilizadas no replay posterior, mas não durante a partida ativa.

---

## 8. Temporizadores e desconexões

### Limites iniciais propostos

| Situação | Casual | Competitivo |
|---|---:|---:|
| Jogar uma carta | 30 s | 20 s |
| Responder a Truco | 20 s | 15 s |
| Preparação da mão | 15 s | 10 s |
| Reconexão protegida | 60 s | 30 s |

Esses valores são hipóteses de design que serão ajustadas durante os testes.

No casual, o anfitrião poderá desativar o temporizador de cartas.

No competitivo, o temporizador é obrigatório. Se um jogador atingir o limite, o servidor registra uma jogada automática válida. A política inicial será jogar a carta comum de menor força, ou a carta disponível de menor força caso só existam manilhas.

A resolução automática é determinística e nunca ativa poderes.

Quando houver pedido de Truco pendente e o tempo acabar, a equipe desafiada corre automaticamente. Se o jogador responsável pela decisão especial de mão de onze não responder, a equipe corre.

### Reconexão

A desconexão não apaga as cartas nem o estado da partida.

- O jogador retorna usando um token de retomada vinculado ao assento.
- O servidor fornece um snapshot privado completo e os eventos públicos necessários para sincronização.
- Ações enviadas antes da desconexão não são processadas duas vezes.
- Ao exceder a tolerância de reconexão, o temporizador normal da ação volta a valer.
- A partida pode terminar por abandono se não houver participantes suficientes para continuar.

Mecanismos para evitar abuso de pausa ou reconexão deverão ser definidos antes de disponibilizar partidas ranqueadas.

---

## 9. Progressão cosmética

Todos os poderes estarão disponíveis desde o início. Não haverá cartas mais fortes por nível de conta nem vantagens adquiridas com moeda virtual.

Os jogadores poderão desbloquear:

- Versos e estilos de cartas.
- Mesas e fundos.
- Animações de Truco.
- Efeitos de vitória.
- Emotes.
- Avatares.
- Títulos e molduras.

A progressão poderá utilizar experiência recebida por partidas concluídas, desafios semanais e marcos de participação.

A quantidade de experiência não deve depender exclusivamente de vitórias, para evitar que jogadores casuais sintam necessidade de competir intensamente.

No MVP, contas e progressão serão opcionais. Os recursos cosméticos entram em uma fase posterior.

---

## 10. Critérios de aceitação do gameplay

O primeiro lançamento jogável deverá satisfazer:

1. Dois ou quatro usuários entram na mesma sala e disputam uma partida completa.
2. As regras de manilha e desempate são resolvidas corretamente.
3. Nenhuma carta pode ser duplicada durante a distribuição ou habilidades.
4. O estado público nunca contém cartas privadas de outros jogadores.
5. O servidor rejeita ações fora do turno.
6. Um pedido de Truco pendente bloqueia jogadas incompatíveis.
7. Ativar um poder consome energia uma única vez.
8. Um jogador desconectado pode retomar sua posição sem reiniciar a partida.
9. A partida determina corretamente o vencedor ao atingir 12 pontos.
10. As modalidades casual e competitiva utilizam políticas de sorteio distintas.
11. Todos os estados relevantes são reproduzíveis em testes automatizados.
12. Nenhuma condição de corrida deve permitir duas ações incompatíveis no mesmo estado da mão.

---

## 11. Questões em aberto para playtest

As seguintes escolhas não são consideradas balanceadas ou definitivas apenas por terem sido especificadas:

- Energia inicial e regeneração.
- Frequência de sorteio dos poderes.
- Potência real do Impulso.
- Efetividade da Máscara no 1v1.
- Frequência adequada de efeitos de informação.
- Duração das decisões.
- Necessidade de limitar habilidades de pontuação.
- Impacto de habilidades na duração das partidas.

Esses elementos precisarão ser ajustados a partir de partidas simuladas e testes reais com jogadores.
