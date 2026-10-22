import type { guidedEnglish } from '../../../../../shared/i18n/guided';

type Text = keyof typeof guidedEnglish;
export type GuidedLesson = {
  id: string;
  focus: 'hand' | 'ranks' | 'vira' | 'suits' | 'plays' | 'score' | 'raise' | 'energy' | 'power';
  title: Text;
  body: Text;
  result?: Text;
  action?: 'card' | 'raise' | 'spy' | 'power-card';
  card?: number;
  power?: 'spy' | 'exchange' | 'boost' | 'mask';
};

export const firstLesson: GuidedLesson = {
  id: 'hand',
  focus: 'hand',
  title: 'Estas são suas três cartas',
  body: 'Cada mão começa com três cartas para cada jogador. Você escolhe uma por vaza. Uma partida tem várias mãos e termina quando uma equipe chega a 12 pontos.',
};

/** Authored demonstrations, not a second multiplayer rules engine. No secrets or network state. */
export const guidedLessons: readonly GuidedLesson[] = [
  firstLesson,
  {
    id: 'ranks',
    focus: 'ranks',
    title: 'Conheça a força das cartas',
    body: 'Leia da esquerda para a direita, de cima para baixo: 4 é a mais fraca e 3 é a comum mais forte. Q é dama, J é valete e K é rei. Os naipes não desempatam cartas comuns.',
  },
  {
    id: 'vira',
    focus: 'vira',
    title: 'A vira escolhe as manilhas',
    body: 'A vira é uma carta aberta na mesa. O próximo valor na ordem vira manilha. Aqui a vira é A, então todos os 2 são manilhas e vencem qualquer carta comum. Se a vira fosse 3, as manilhas seriam os 4.',
  },
  {
    id: 'suits',
    focus: 'suits',
    title: 'Entre manilhas, o naipe decide',
    body: 'Da mais fraca para a mais forte: ouros ♦ < espadas ♠ < copas ♥ < paus ♣. Aqui, 2 de Paus vence 2 de Copas. Essa ordem vale somente para manilhas.',
  },
  {
    id: 'low',
    focus: 'hand',
    title: 'Experimente uma carta mais fraca',
    body: 'O adversário jogou K de Espadas. Neste exercício, jogue sua Q de Paus para comparar as forças. Toque na carta destacada.',
    action: 'card',
    card: 0,
    result:
      'Você perdeu esta vaza: K é mais forte que Q. O naipe de Paus não ajuda, porque nenhuma dessas cartas é manilha. Perder uma vaza ainda não significa perder a mão.',
  },
  {
    id: 'trump',
    focus: 'hand',
    title: 'Agora jogue uma manilha',
    body: 'O adversário jogou 3 de Copas, a comum mais forte. A vira continua sendo A. Jogue seu 2 de Ouros, uma manilha.',
    action: 'card',
    card: 2,
    result:
      'Você ganhou esta vaza! O 2 é manilha nesta mão e vence o 3. Até a manilha de Ouros, a menor entre as manilhas, vence qualquer carta comum.',
  },
  {
    id: 'suit-play',
    focus: 'hand',
    title: 'Desempate entre manilhas',
    body: 'O adversário jogou 2 de Copas. Jogue o 2 de Paus destacado e veja o naipe decidir.',
    action: 'card',
    card: 2,
    result: 'Você ganhou: Paus ♣ vence Copas ♥ entre manilhas. A ordem completa é ♦ < ♠ < ♥ < ♣.',
  },
  {
    id: 'tie',
    focus: 'plays',
    title: 'E quando as cartas empatam?',
    body: 'K de Ouros e K de Paus empatam quando não são manilhas. Os naipes não resolvem esse empate. Uma primeira vaza empatada dá vantagem a quem vencer a próxima; três empates anulam a mão, sem pontos.',
  },
  {
    id: 'score',
    focus: 'score',
    title: 'Vaza, mão e partida',
    body: 'Uma vaza recebe uma carta de cada jogador. Duas vitórias garantem a mão, que normalmente vale 1 ponto. Vitória seguida de empate também encerra a mão. Se cada equipe vencer uma e a terceira empatar, ganha quem venceu a primeira. A partida vai até 12.',
  },
  {
    id: 'raise',
    focus: 'raise',
    title: 'Aumente a aposta com truco',
    body: 'Antes de jogar, na sua vez, você pode pedir truco. Toque no botão destacado para propor que esta mão valha 3 pontos.',
    action: 'raise',
    result:
      'O adversário aceitou: a mão agora vale 3. Os aumentos seguem 1 → 3 → 6 → 9 → 12. Correr concede o valor já aceito, não a proposta pendente. Contra-aumentar aceita a proposta anterior e oferece o próximo nível.',
  },
  {
    id: 'energy',
    focus: 'energy',
    title: 'Energia e preparação',
    body: 'Você começa com 2 de energia, recupera 1 por nova mão comum e pode guardar até 3. Cada mão sorteia um poder; você pode usá-lo uma vez, se tiver energia. Espião e Segunda Chance são escolhidos na preparação e resolvidos quando todos respondem.',
  },
  {
    id: 'spy',
    focus: 'power',
    title: 'Espião: informação só para você',
    body: 'Ative o Espião e toque no verso do adversário. Ele custa 1 de energia e revela uma carta aleatória da mão final dele após a preparação, sem escolher a identidade da carta.',
    action: 'spy',
    power: 'spy',
    result:
      'Você viu K de Espadas. Só você recebe essa informação, nem sua dupla vê automaticamente. O histórico guarda a observação nesta mão; ela não rastreia cartas mascaradas ou cobertas.',
  },
  {
    id: 'exchange',
    focus: 'power',
    title: 'Segunda Chance: troque uma carta',
    body: 'Na preparação, ative Segunda Chance e toque na Q de Paus destacada. O poder custa 2 de energia e troca uma carta escolhida por outra do monte restante.',
    action: 'power-card',
    card: 0,
    power: 'exchange',
    result:
      'Neste exemplo, Q de Paus saiu e você comprou 7 de Espadas. Uma troca não garante carta melhor. As trocas são resolvidas antes do Espião.',
  },
  {
    id: 'boost',
    focus: 'power',
    title: 'Impulso: um nível de força',
    body: 'Na sua vez, ative Impulso e jogue o 7 de Espadas destacado. Ele custa 2 de energia e aumenta em um nível a força de uma carta comum nesta vaza.',
    action: 'power-card',
    card: 0,
    power: 'boost',
    result:
      'O 7 continua sendo a mesma carta, mas disputa esta vaza com força de Q. Impulso não cria manilha, não afeta manilhas e não ultrapassa a força comum do 3.',
  },
  {
    id: 'mask',
    focus: 'power',
    title: 'Máscara: esconda sem perder força',
    body: 'Na sua vez, ative Máscara e jogue o 3 de Copas destacado. Ela custa 1 de energia e esconde a carta dos outros jogadores até a resolução.',
    action: 'power-card',
    card: 1,
    power: 'mask',
    result:
      'O adversário vê uma carta mascarada, mas ela disputa com toda a força do 3. Você continua sabendo qual carta jogou. A identidade será revelada quando a vaza resolver.',
  },
  {
    id: 'covered',
    focus: 'plays',
    title: 'Coberta não é mascarada',
    body: 'Da segunda vaza em diante, você pode jogar coberta: ela perde para qualquer aberta ou mascarada, e todas cobertas empatam. Máscara esconde a identidade temporariamente e mantém a força. Não combine carta coberta com poder.',
  },
  {
    id: 'finish',
    focus: 'score',
    title: 'Você já conhece o caminho',
    body: 'No 2v2, os parceiros ficam em assentos alternados e a carta mais forte vence, sem somar forças. Consulte a vira, planeje a energia e observe o histórico. Em mãos de onze e 11×11, poderes e aumentos ficam desativados. Você pode repetir este treino ou consultar as lições do guia.',
  },
];
