import type { TutorialMessages } from './types';

export const en: TutorialMessages = {
  title: 'How to play',
  subtitle: 'Learn at the table, one play at a time.',
  back: 'Back to menu',
  previous: 'Previous',
  next: 'Next lesson',
  finish: 'Finish tutorial',
  language: 'Game language',
  contents: 'Tutorial lessons',
  practice: 'Try it yourself',
  correct: 'Correct!',
  retry: 'Let’s work it out.',
  weakest: 'Weakest',
  strongest: 'Strongest',
  vira: 'Choose the vira',
  manilhas: 'This hand’s trump cards',
  suitOrder: 'Among trump cards, suits decide:',
  suits: ['Diamonds', 'Spades', 'Hearts', 'Clubs'],
  energy: 'energy',
  lessons: [
    {
      id: 'start',
      title: 'The goal: reach 12',
      lead: 'Truco is about cards, reading your opponent and bluffing. Here, powers add another layer of strategy.',
      blocks: [
        {
          title: 'Match → hand → trick',
          body: 'The match ends when a team reaches 12 points. Each hand deals 3 cards to each player and contains up to 3 tricks. A trick is one round in which every player plays one card.',
        },
        {
          title: 'Solo or in pairs',
          body: 'In 1v1, you face one opponent. In 2v2, partners sit in alternating seats: A, B, A, B. Your team’s strongest card competes for the trick; partners do not add their card strengths together.',
        },
        {
          title: 'The flow of a hand',
          body: 'Receive your cards → check the vira and your power → confirm preparation → play one card at a time → see who won. A normal hand starts at 1 point.',
        },
      ],
      question: 'How many cards do you receive each hand?',
      choices: ['1 card', '3 cards', '12 cards'],
      answer: 1,
      explanation:
        'Each player gets 3 cards. Twelve is the target score for the match, not the number of cards.',
    },
    {
      id: 'ranks',
      title: 'Learn the card strengths',
      lead: 'The deck has 40 cards: no 8s, 9s or 10s. Read the sequence from weakest to strongest.',
      blocks: [
        {
          title: 'The 3 rules ordinary cards',
          body: 'The order is 4, 5, 6, 7, Q (queen), J (jack), K (king), A (ace), 2 and 3. An ace loses to a 2 or 3. This is the ordinary order; the vira can turn one of these ranks into trump cards, called manilhas.',
        },
        {
          title: 'Suits do not break ordinary ties',
          body: 'A 2 of hearts and a 2 of clubs have equal strength when they are not trump cards. Color and suit do not decide which ordinary card wins.',
        },
      ],
      question: 'Without trump cards or powers, which card wins?',
      choices: ['Ace of hearts', '2 of diamonds', 'King of clubs'],
      answer: 1,
      explanation:
        'The 2 beats both the ace and the king. Suit does not affect an ordinary card’s strength.',
    },
    {
      id: 'manilhas',
      title: 'The vira changes everything',
      lead: 'The vira is a face-up card on the table. The next rank in the sequence becomes trump — the strongest class of cards for that hand.',
      blocks: [
        {
          title: 'Try changing the vira',
          body: 'If the vira is Q, every J becomes a trump card. If it is 3, the cycle wraps around to 4. The vira’s suit does not matter: all four suits of the next rank become trump cards.',
        },
        {
          title: 'Above every ordinary card',
          body: 'Even the diamond trump beats an ordinary 3. Among trump cards, the order is diamonds < spades < hearts < clubs. Clubs is the strongest trump, also called zap.',
        },
      ],
      question: 'The vira is 3. Which is the strongest card this hand?',
      choices: ['3 of clubs', '4 of clubs', '4 of diamonds'],
      answer: 1,
      explanation:
        'After 3, the cycle wraps to 4. All four 4s are trump cards, and clubs beats the other three suits.',
    },
    {
      id: 'tricks',
      title: 'Win the hand, not just a trick',
      lead: 'Everyone plays one card. The highest strength wins the trick, and its player leads the next one.',
      blocks: [
        {
          title: 'Two wins settle it',
          body: 'Winning two tricks wins the hand. The hand ends as soon as its outcome is settled; you will not always play your third card.',
        },
        {
          title: 'What about ties?',
          body: 'A win plus a tie, or a tie plus a win, settles the hand. If each team wins one trick and the third ties, the first trick’s winner wins the hand. Two ties leave the third to decide; three ties void the hand with no points. A tied trick keeps the same leader.',
        },
        {
          title: 'Covered is not Mask',
          body: 'From the second trick onward, you may play a covered card: it loses to any face-up or masked card. All covered cards tie. Mask is a power: it hides the card until resolution while preserving its strength.',
        },
      ],
      question: 'You won the first trick and the second tied. What happens?',
      choices: ['You win the hand', 'A third trick is always needed', 'Nobody earns points'],
      answer: 0,
      explanation:
        'One win and one tie secure the hand. The game ends the hand and awards the accepted stake.',
    },
    {
      id: 'bets',
      title: 'Truco! Raise with intent',
      lead: 'A hand starts at 1 point. Raises follow 3 → 6 → 9 → 12 points. Bluffing is part of the game; points have no monetary value.',
      blocks: [
        {
          title: 'Raise, accept or fold',
          body: 'On your turn, before playing, you may ask to raise. The opponent accepts, folds or counter-raises to the next level. No cards or powers can be played during negotiation. Folding awards the already accepted stake, not the proposed one.',
        },
        {
          title: 'Counter-raising accepts the previous offer',
          body: 'You ask for 3; your opponent asks for 6; you fold: they earn 3. After a raise is accepted, only the other team may request the next raise on an eligible turn. At 12, only accept or fold remain. In 2v2, the first valid partner response decides.',
        },
        {
          title: 'Eleven and 11 × 11',
          body: 'A team at 11 chooses to play for 3 or fold and concede 1; partners can see each other’s cards during this choice. At 11 × 11, everyone sees only their own cards, the hand is worth 3, and folding or covered cards are unavailable. These special hands have no raises, powers or energy regeneration.',
        },
      ],
      question: 'The accepted stake is 3 and your opponent asks for 6. If you fold, they earn…',
      choices: ['1 point', '3 points', '6 points'],
      answer: 1,
      explanation:
        'They earn the 3 points already accepted. Six would apply only if you accepted the new offer.',
    },
    {
      id: 'powers',
      title: 'Four powers, new decisions',
      lead: 'You receive a random power each normal hand. It expires at the end of the hand and can be successfully activated only once.',
      blocks: [
        {
          title: 'Manage your energy',
          body: 'You start with 2 energy, regain 1 each new normal hand after the first, and can hold at most 3. Each player has their own energy and usage limit, including in pairs. Powers are never purchased or unlocked by level.',
        },
        {
          title: 'Prepare before the first card',
          body: 'Spy and Second Chance are chosen during preparation. Use your power or pass. Choices stay sealed until everyone responds or time runs out. Exchanges happen first, then spying. You cannot wait to see other choices and revise yours.',
        },
        {
          title: 'Casual and competitive',
          body: 'Casual draws independently for every player. Competitive 1v1 gives both players the same power; in 2v2, each team gets one copy of the same two distinct powers. All four powers are available in both presets.',
        },
      ],
      question: 'Does a card played with Mask lose its strength?',
      choices: ['Yes, like a covered card', 'No, it competes normally'],
      answer: 1,
      explanation:
        'Mask preserves strength, including trump strength, and reveals at resolution. A covered card is the one that loses to every face-up or masked card.',
    },
    {
      id: 'ready',
      title: 'Your first match',
      lead: 'You know the essentials. Follow this checklist to join your friends at the table.',
      blocks: [
        {
          title: '1 · Gather your friends',
          body: 'Create a room or join through a code/link. Choose 1v1 or 2v2, a preset and timers. In pairs, check the teams. Everyone marks ready; the host starts the match.',
        },
        {
          title: '2 · Read the table before acting',
          body: 'Check the vira and trump cards, accepted stake, your turn, energy and power. During preparation, use Spy/Second Chance or pass. On your turn, select Boost/Mask before choosing the card if you want to use them.',
        },
        {
          title: '3 · Learn from the result',
          body: 'The winning card is highlighted; history explains public plays. Wait for the next-turn indicator. At the end, the host can prepare a rematch; everyone confirms ready again. Return to this guide whenever you like.',
        },
        {
          title: 'Timers and connection',
          body: 'If a timer is enabled, act before it expires. Preparation times out to pass; a raise or eleven decision times out to fold. On a normal turn, the server plays the weakest legal card. A disconnect may pause the room for reconnection, but the wait is limited.',
        },
      ],
      question: 'Before playing your first card, check…',
      choices: ['Only the card illustration', 'Vira, turn, stake and power'],
      answer: 1,
      explanation:
        'The vira changes strength; the turn tells you when to act; the stake shows the risk; your power may open another option. Have a great match!',
    },
  ],
  powers: [
    {
      id: 'spy',
      name: 'Spy',
      cost: 1,
      timing: 'During preparation',
      description: 'Choose an opponent and see one random card from their hand after exchanges.',
      tip: 'Only you receive the information, not your partner. You choose the opponent, not the card. This is a memory from preparation, not live tracking of their hand.',
    },
    {
      id: 'exchange',
      name: 'Second Chance',
      cost: 2,
      timing: 'During preparation',
      description: 'Choose one of your cards to discard and draw another from the remaining deck.',
      tip: 'You still hold 3 cards. The discarded card does not return to the deck this hand, and the vira can never be drawn.',
    },
    {
      id: 'boost',
      name: 'Boost',
      cost: 2,
      timing: 'On your turn',
      description:
        'An ordinary card gains one normal strength level for this trick. For example, an ace gets the strength of a 2.',
      tip: 'Cannot target trump cards, covered cards or an ordinary 3. Never creates a trump card: even if the new strength matches the trump rank, the card remains ordinary.',
    },
    {
      id: 'mask',
      name: 'Mask',
      cost: 1,
      timing: 'On your turn',
      description: 'Play a card hidden until the trick resolves, competing at full strength.',
      tip: 'Works on ordinary or trump cards, never covered cards. Others learn the face at resolution. If the hand ends through folding before that, the card remains hidden.',
    },
  ],
};
