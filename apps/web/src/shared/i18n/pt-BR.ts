import type { TutorialMessages } from './types';

export const ptBR: TutorialMessages = {
  title: 'Como jogar',
  subtitle: 'Aprenda na mesa, uma jogada de cada vez.',
  back: 'Voltar ao menu',
  previous: 'Anterior',
  next: 'Próxima etapa',
  finish: 'Concluir tutorial',
  language: 'Idioma do jogo',
  contents: 'Etapas do tutorial',
  practice: 'Sua vez de experimentar',
  correct: 'Acertou!',
  retry: 'Vamos entender juntos.',
  weakest: 'Mais fraca',
  strongest: 'Mais forte',
  vira: 'Escolha a vira',
  manilhas: 'Manilhas desta mão',
  suitOrder: 'Entre manilhas, o naipe decide:',
  suits: ['Ouros', 'Espadas', 'Copas', 'Paus'],
  energy: 'energia',
  lessons: [
    {
      id: 'start',
      title: 'O objetivo: chegar a 12',
      lead: 'Truco é um jogo de cartas, leitura do adversário e blefe. Aqui, poderes também entram na estratégia.',
      blocks: [
        {
          title: 'Partida → mão → vaza',
          body: 'A partida termina quando uma equipe chega a 12 pontos. Cada mão distribui 3 cartas por jogador e pode ter até 3 vazas. Uma vaza é uma rodada em que cada participante joga uma carta.',
        },
        {
          title: 'Sozinho ou em dupla',
          body: 'No 1v1, você enfrenta um adversário. No 2v2, os parceiros sentam alternados: A, B, A, B. A melhor carta da equipe disputa a vaza; as forças dos parceiros não se somam.',
        },
        {
          title: 'O caminho de uma mão',
          body: 'Receba suas cartas → confira a vira e seu poder → confirme a preparação → jogue uma carta por vez → veja quem ganhou. A mão normal começa valendo 1 ponto.',
        },
      ],
      question: 'Quantas cartas você recebe em cada mão?',
      choices: ['1 carta', '3 cartas', '12 cartas'],
      answer: 1,
      explanation:
        'São 3 cartas por jogador. Os 12 são a meta de pontos da partida, não a quantidade de cartas.',
    },
    {
      id: 'ranks',
      title: 'Conheça a força das cartas',
      lead: 'O baralho tem 40 cartas: não há 8, 9 ou 10. Leia a sequência da mais fraca para a mais forte.',
      blocks: [
        {
          title: 'O 3 manda nas comuns',
          body: 'A ordem é 4, 5, 6, 7, Q (dama), J (valete), K (rei), A (ás), 2 e 3. O ás perde para o 2 e o 3. Esta é a força normal; a vira pode transformar um desses valores em manilha.',
        },
        {
          title: 'Naipe não desempata carta comum',
          body: 'Um 2 de copas e um 2 de paus têm a mesma força quando não são manilhas. Não use a cor ou o naipe para escolher a vencedora entre cartas comuns.',
        },
      ],
      question: 'Sem manilhas ou poderes, qual carta ganha?',
      choices: ['A de copas', '2 de ouros', 'K de paus'],
      answer: 1,
      explanation:
        'O 2 é mais forte que o ás e o rei. Para cartas comuns, o naipe não muda a força.',
    },
    {
      id: 'manilhas',
      title: 'A vira muda tudo',
      lead: 'A vira é uma carta aberta na mesa. O próximo valor da sequência vira manilha — a classe mais forte da mão.',
      blocks: [
        {
          title: 'Experimente trocar a vira',
          body: 'Se a vira for Q, todos os J serão manilhas. Se for 3, o ciclo volta ao 4. O naipe da vira não importa: os quatro naipes do próximo valor viram manilhas.',
        },
        {
          title: 'Acima de qualquer comum',
          body: 'Até a manilha de ouros vence um 3 comum. Entre manilhas, vale a ordem ouros < espadas < copas < paus. Paus é a manilha mais forte, também chamada de zap.',
        },
      ],
      question: 'A vira é 3. Qual é a carta mais forte desta mão?',
      choices: ['3 de paus', '4 de paus', '4 de ouros'],
      answer: 1,
      explanation:
        'Depois do 3, o ciclo volta ao 4. Os quatro 4 são manilhas, e o de paus vence as outras três.',
    },
    {
      id: 'tricks',
      title: 'Ganhe a mão, não só uma vaza',
      lead: 'Cada jogador coloca uma carta. A maior força vence a vaza e seu autor abre a próxima.',
      blocks: [
        {
          title: 'Duas vitórias resolvem',
          body: 'Quem ganha duas vazas vence a mão. A mão termina assim que o resultado fica definido; nem sempre será preciso jogar a terceira carta.',
        },
        {
          title: 'E se empatar?',
          body: 'Vitória + empate ou empate + vitória já definem a mão. Se cada equipe vencer uma e a terceira empatar, ganha quem venceu a primeira. Dois empates deixam a terceira decidir; três empates anulam a mão, sem pontos. Vaza empatada mantém o mesmo iniciador.',
        },
        {
          title: 'Coberta é diferente de Máscara',
          body: 'Da segunda vaza em diante, você pode jogar coberta: ela perde para qualquer carta aberta ou mascarada. Todas cobertas empatam. A Máscara é um poder: esconde a carta até a resolução, mas preserva sua força.',
        },
      ],
      question: 'Você ganhou a primeira vaza e a segunda empatou. O que acontece?',
      choices: ['Você vence a mão', 'Sempre precisa da terceira', 'Ninguém ganha pontos'],
      answer: 0,
      explanation:
        'Uma vitória e um empate já garantem a mão. O jogo encerra a mão e soma a aposta aceita.',
    },
    {
      id: 'bets',
      title: 'Truco! Aumente com intenção',
      lead: 'A mão começa valendo 1. Os aumentos seguem 3 → 6 → 9 → 12 pontos. Blefar faz parte; pontos não têm valor monetário.',
      blocks: [
        {
          title: 'Pedir, aceitar ou correr',
          body: 'No seu turno, antes de jogar, você pode pedir aumento. O adversário aceita, corre ou contra-aumenta para o próximo nível. Durante a negociação, ninguém joga cartas ou poderes. Correr concede o valor já aceito, não o valor proposto.',
        },
        {
          title: 'Contra-aumento aceita o anterior',
          body: 'Você pede 3; o adversário pede 6; você corre: ele ganha 3. Após um aumento aceito, só a outra equipe pode pedir o próximo, no turno permitido. Em 12, só é possível aceitar ou correr. No 2v2, a primeira resposta válida de um parceiro decide.',
        },
        {
          title: 'Mão de onze e 11 × 11',
          body: 'Uma equipe em 11 escolhe jogar por 3 ou correr e conceder 1; em dupla, vê as cartas do parceiro durante essa escolha. Em 11 × 11, cada um vê só suas cartas, a mão vale 3 e não permite correr nem jogar coberta. Essas mãos especiais não têm aumentos, poderes ou regeneração de energia.',
        },
      ],
      question: 'A mão vale 3 e o adversário pede 6. Se você correr agora, ele ganha…',
      choices: ['1 ponto', '3 pontos', '6 pontos'],
      answer: 1,
      explanation:
        'Ele ganha os 3 pontos já aceitos. Os 6 só valeriam se você aceitasse a proposta.',
    },
    {
      id: 'powers',
      title: 'Quatro poderes, novas decisões',
      lead: 'Você recebe um poder aleatório por mão comum. Ele expira no fim da mão e só pode ser ativado uma vez com sucesso.',
      blocks: [
        {
          title: 'Gerencie sua energia',
          body: 'Você começa com 2 de energia, recupera 1 a cada nova mão comum após a primeira e pode guardar no máximo 3. Cada jogador tem sua própria energia e limite de uso, mesmo em dupla. Não há poderes comprados ou desbloqueados por nível.',
        },
        {
          title: 'Preparação antes da primeira carta',
          body: 'Espião e Segunda Chance são escolhidos na preparação. Você pode usar seu poder ou passar. As escolhas ficam seladas até todos responderem ou o prazo acabar. Primeiro acontecem as trocas, depois as espionagens. Não espere ver a escolha dos outros para mudar a sua.',
        },
        {
          title: 'Casual e competitivo',
          body: 'Casual sorteia independentemente para cada jogador. Competitivo 1v1 dá o mesmo poder aos dois; no 2v2, cada equipe recebe uma cópia dos mesmos dois poderes distintos. Os quatro poderes estão disponíveis em ambos os presets.',
        },
      ],
      question: 'Uma carta jogada com Máscara perde sua força?',
      choices: ['Sim, como uma coberta', 'Não, disputa normalmente'],
      answer: 1,
      explanation:
        'Máscara preserva a força, inclusive de manilhas, e revela na resolução. A carta coberta é que perde para qualquer carta aberta ou mascarada.',
    },
    {
      id: 'ready',
      title: 'Sua primeira partida',
      lead: 'Você já conhece o essencial. Use este roteiro para entrar na mesa com seus amigos.',
      blocks: [
        {
          title: '1 · Reúna a turma',
          body: 'Crie uma sala ou entre pelo código/link. Escolham 1v1 ou 2v2, preset e tempos. Em dupla, confira os times. Todos devem marcar pronto; o anfitrião inicia a partida.',
        },
        {
          title: '2 · Leia a mesa antes de agir',
          body: 'Confira a vira e as manilhas, a aposta aceita, seu turno, energia e poder. Na preparação, use Espião/Segunda Chance ou passe. Na sua jogada, selecione Impulso/Máscara antes da carta se quiser usá-los.',
        },
        {
          title: '3 · Aprenda com o resultado',
          body: 'A carta vencedora recebe destaque; o histórico explica as jogadas públicas. Aguarde a indicação da próxima vez. No fim, o anfitrião pode preparar a revanche; todos confirmam pronto novamente. Volte a este guia sempre que quiser.',
        },
        {
          title: 'Tempo e conexão',
          body: 'Se houver relógio, decida antes de ele acabar. Na preparação, o silêncio passa; na aposta, corre; na mão de onze, corre. Em um turno normal, o servidor joga a carta permitida mais fraca. Ao cair a conexão, a sala pode pausar para reconectar, mas a espera é limitada.',
        },
      ],
      question: 'Antes de jogar sua primeira carta, vale conferir…',
      choices: ['Só o desenho da carta', 'Vira, turno, aposta e poder'],
      answer: 1,
      explanation:
        'A vira muda a força; o turno diz quando agir; a aposta mostra o risco; seu poder pode abrir uma nova possibilidade. Boa partida!',
    },
  ],
  powers: [
    {
      id: 'spy',
      name: 'Espião',
      cost: 1,
      timing: 'Na preparação',
      description: 'Escolha um adversário e veja uma carta aleatória da mão dele após as trocas.',
      tip: 'Só você recebe a informação, não seu parceiro. Você escolhe o adversário, não qual carta será revelada. É uma lembrança da preparação, não rastreamento da mão.',
    },
    {
      id: 'exchange',
      name: 'Segunda Chance',
      cost: 2,
      timing: 'Na preparação',
      description: 'Escolha uma carta sua para descartar e receba outra do monte restante.',
      tip: 'Você continua com 3 cartas. A carta descartada não volta para o monte nesta mão, e a vira nunca pode ser comprada.',
    },
    {
      id: 'boost',
      name: 'Impulso',
      cost: 2,
      timing: 'Na sua jogada',
      description:
        'Uma carta comum ganha um nível de força normal nesta vaza. Exemplo: um ás passa a ter força de 2.',
      tip: 'Não funciona em manilhas, cobertas ou 3 comum. Nunca transforma uma carta em manilha: mesmo que o novo nível coincida com ela, continua comum.',
    },
    {
      id: 'mask',
      name: 'Máscara',
      cost: 1,
      timing: 'Na sua jogada',
      description:
        'Jogue uma carta oculta até a resolução da vaza, disputando com sua força integral.',
      tip: 'Pode ser comum ou manilha, mas não coberta. Os demais só conhecem a face na resolução. Se a mão terminar por corrida antes disso, ela permanece oculta.',
    },
  ],
};
