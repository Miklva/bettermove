// Referencement en anglais : pages de l'app (cle = adresse francaise) et guides ecrits pour les recherches anglophones.
import type { Article } from './articles';

type PageText = { title: string; description: string; h1: string; intro: string };

export const EN_PAGES: Record<string, PageText> = {
  '/': {
    title: 'BetterMove · Learn and improve at chess, for free',
    description:
      'Play chess for free against bots that play like humans, solve puzzles, take lessons and get your games analyzed. No ads.',
    h1: 'Learn chess and improve, for free',
    intro:
      'BetterMove helps you get better at chess at your own pace: bots from 400 to 2700 Elo, thousands of puzzles at your level, step-by-step lessons, a personal coach that tracks your mistakes, and online games. Free and ad-free.',
  },
  '/jouer/bot': {
    title: 'Play chess against the computer · BetterMove',
    description:
      'Take on chess bots from 400 to 2700 Elo that play and chat like humans. Free, no sign-up, with game analysis.',
    h1: 'Play chess against the computer',
    intro:
      'Pick your opponent among bots from 400 to 2700 Elo, each with its own style. Your rating adjusts after every game, and every game can be analyzed move by move with Stockfish.',
  },
  '/jouer/monde': {
    title: 'Play chess online against real players · BetterMove',
    description: 'Rated online chess games against players of your level, in blitz, rapid or classical. Free.',
    h1: 'Play chess online',
    intro: 'Start a rated game against a BetterMove player of your level, picked at random, and raise your online rating.',
  },
  '/jouer/local': {
    title: 'Play chess with two players on one screen · BetterMove',
    description: 'A two-player chess game on a single device, with a clock and a board that flips. Free.',
    h1: 'Play chess with two players on one screen',
    intro: 'Two players, one device: choose the time control, play with a friend, then analyze the game together.',
  },
  '/apprendre/cours': {
    title: 'Free chess lessons for beginners and improvers · BetterMove',
    description:
      'Learn chess step by step: rules, tactics (forks, pins), checkmates, endgames and openings. Free interactive lessons.',
    h1: 'Interactive chess lessons',
    intro:
      'From the basics to endgames: the board and the pieces, essential tactics, classic checkmates, endgames and the main openings, with exercises in every lesson.',
  },
  '/apprendre/problemes': {
    title: 'Chess puzzles at your level · BetterMove',
    description:
      'Thousands of chess puzzles matched to your rating, by theme: mate in 2, forks, pins, endgames. Explanations when you go wrong.',
    h1: 'Chess puzzles',
    intro:
      'Train your tactics with thousands of positions picked for your level. Your puzzle rating changes with every attempt, and the app explains your mistakes.',
  },
  '/apprendre/rush': {
    title: 'Puzzle Rush: chess puzzles against the clock · BetterMove',
    description: 'Solve as many chess puzzles as you can against the clock: three mistakes and you are out. Beat your record.',
    h1: 'Puzzle Rush',
    intro: 'As many chess puzzles as possible in limited time, getting harder and harder. Three mistakes and the run ends.',
  },
  '/apprendre/professeur': {
    title: 'Play against a chess teacher who explains every move · BetterMove',
    description: 'A chess game where every move is explained: understand why a move is good or bad.',
    h1: 'Play against the teacher',
    intro: 'A real chess game with move-by-move commentary, to understand the ideas behind every decision.',
  },
  '/apprendre/repertoire': {
    title: 'Learn your chess openings · BetterMove',
    description: 'Build your opening repertoire and review it move by move until you know it by heart.',
    h1: 'Opening repertoire',
    intro: 'Pick your openings and review them: the app plays the opponent and makes you repeat each line at the right time.',
  },
  '/progresser/suivi': {
    title: 'Chess game analysis and personal coaching · BetterMove',
    description:
      'Stockfish analyzes your games (bots, chess.com, Lichess) and finds your recurring mistakes. Exercises taken from your own games.',
    h1: 'Personal coaching from your chess games',
    intro:
      'Import your chess.com or Lichess games: BetterMove spots the mistakes you keep making (hanging pieces, missed tactics, endgames) and gives you exercises taken from your own games.',
  },
  '/progresser/historique': {
    title: 'Chess game history and analysis · BetterMove',
    description: 'All your chess games in one place, analyzed move by move with Stockfish. Import from chess.com and Lichess.',
    h1: 'Game history and analysis',
    intro: 'All your games in one place, with statistics and move-by-move analysis by the Stockfish engine.',
  },
  '/communaute/classement': {
    title: 'Chess player leaderboard · BetterMove',
    description: 'The best BetterMove players online, against bots and in puzzles.',
    h1: 'Player leaderboard',
    intro: 'The top players of the BetterMove community, in online games, against bots and in puzzles.',
  },
  '/communaute/evenements': {
    title: 'Events · BetterMove',
    description: 'BetterMove community events and their exclusive rewards.',
    h1: 'Events',
    intro: 'Limited-time events with exclusive rewards for players.',
  },
  '/aide': {
    title: 'Help and contact · BetterMove',
    description: 'A question, a bug or an idea? Contact the BetterMove team.',
    h1: 'Help and contact',
    intro: 'Ask your question, report a bug or suggest an idea: the team replies by email.',
  },
  '/guides': {
    title: 'Free chess guides: rules, tactics, openings · BetterMove',
    description: 'Clear guides to learn and improve at chess: rules, tactics, checkmates, openings, game analysis and Elo ratings.',
    h1: 'Guides to learn and improve at chess',
    intro: 'Answers to the questions every player asks, from the first move to Elo ratings.',
  },
};

/** Guides en anglais ; frSlug relie chaque guide a sa version francaise */
export const EN_ARTICLES: (Article & { frSlug: string })[] = [
  {
    frSlug: 'comment-apprendre-les-echecs',
    slug: 'how-to-learn-chess',
    title: 'How to learn chess as a beginner: the complete guide',
    description: 'Where to start in chess: the rules, your first tactics, how long to practice and the beginner mistakes to avoid.',
    h1: 'How to learn chess as a beginner',
    intro:
      'Learning chess takes neither special talent nor hours a day. With a simple method and 15 to 20 minutes of regular practice, you improve fast. Here is the order to follow.',
    sections: [
      {
        h2: '1. Know the rules perfectly',
        paragraphs: [
          'First, you need to know how each piece moves, what checkmate is, and the three special moves: castling, en passant and promotion. Many beginners lose games simply because they do not know a rule.',
          'One or two sessions are enough to feel comfortable. Then play a few slow games so the rules become second nature.',
        ],
      },
      {
        h2: '2. Learn three opening principles',
        paragraphs: ['There is no need to memorize openings at first. Three principles are enough to get a good position:'],
        list: [
          'Take the center with a pawn (e4 or d4).',
          'Develop your knights and bishops before moving your queen.',
          'Castle early to keep your king safe.',
        ],
      },
      {
        h2: '3. Practice tactics every day',
        paragraphs: [
          'At every level up to about 1500 Elo, most games are decided by a tactical mistake: an undefended piece, a missed fork, a missed mate. Solving a few puzzles every day is the most effective training there is.',
          'Start with the basic patterns: the fork, the pin, the skewer and the discovered attack.',
        ],
      },
      {
        h2: '4. Play, then analyze your games',
        paragraphs: [
          'Playing is essential, but analysis is what makes you improve. After each game, look for the moment it turned. An engine like Stockfish shows the mistake; the most important part is understanding why you made it.',
        ],
      },
      {
        h2: 'Beginner mistakes to avoid',
        paragraphs: [],
        list: [
          'Bringing the queen out too early: she gets chased around and you lose time.',
          'Playing without checking what your opponent threatens after their last move.',
          'Forgetting to castle and leaving the king in the center.',
          'Playing fast game after fast game without ever reviewing them.',
        ],
      },
    ],
    cta: { label: 'Start the free beginner course', path: '/apprendre/cours' },
  },
  {
    frSlug: 'regles-des-echecs',
    slug: 'chess-rules',
    title: 'Chess rules explained simply (castling, en passant, stalemate)',
    description:
      'All the rules of chess: how the pieces move, checkmate, castling, en passant, promotion, stalemate and draws.',
    h1: 'Chess rules explained simply',
    intro:
      'Chess is played by two players on a board of 64 squares. Each player has 16 pieces and the goal is to checkmate the opposing king. Here are all the rules, including the ones many people forget.',
    sections: [
      {
        h2: 'Setting up the board',
        paragraphs: [
          'The board is placed with a light square in the bottom right corner. The rooks go in the corners, then the knights, the bishops, and the queen and king in the middle. The queen goes on her own color: the white queen on a light square, the black queen on a dark square. White always moves first.',
        ],
      },
      {
        h2: 'How the pieces move',
        paragraphs: [],
        list: [
          'The king: one square in any direction.',
          'The queen: any number of squares in a straight line or diagonally.',
          'The rook: in a straight line, horizontally or vertically.',
          'The bishop: diagonally, so it always stays on the same color.',
          'The knight: in an L shape (two squares, then one to the side); it is the only piece that jumps over others.',
          'The pawn: moves forward one square (or two from its starting square) and captures diagonally.',
        ],
      },
      {
        h2: 'Check, checkmate and stalemate',
        paragraphs: [
          'A king under attack is in check: it must get out of check right away by moving, blocking with a piece or capturing the attacker. If it cannot, it is checkmate and the game is lost.',
          'Stalemate is different: the player to move is not in check but has no legal move. The game is then a draw, even with a huge material advantage.',
        ],
      },
      {
        h2: 'The three special moves',
        paragraphs: [
          'Castling: the king moves two squares toward a rook, which jumps to the other side of it. It is not allowed if the king or that rook has already moved, if the king is in check, or if it passes through or lands on an attacked square.',
          'En passant: when a pawn moves two squares and lands next to an enemy pawn, that pawn can capture it as if it had moved only one square, but only on the very next move.',
          'Promotion: a pawn that reaches the last rank turns into a queen, rook, bishop or knight, as you choose.',
        ],
      },
      {
        h2: 'Draws',
        paragraphs: ['A game can also end in a draw:'],
        list: [
          'By stalemate.',
          'By agreement between the two players.',
          'When the same position occurs three times.',
          'Under the 50-move rule, with no capture and no pawn move.',
          'When there is not enough material left to checkmate (for example king against king).',
        ],
      },
    ],
    cta: { label: 'Learn the rules by playing', path: '/apprendre/cours' },
  },
  {
    frSlug: 'comment-progresser-aux-echecs',
    slug: 'how-to-get-better-at-chess',
    title: 'How to get better at chess and gain Elo points',
    description: 'A practical method to raise your rating: daily tactics, slower games, analyzing your mistakes and studying endgames.',
    h1: 'How to get better at chess and gain Elo points',
    intro:
      'You play regularly but your rating is stuck? That is very common. Improving mostly means playing more slowly, working on your weaknesses and understanding your own mistakes.',
    sections: [
      {
        h2: 'Play slower games',
        paragraphs: [
          'One to three minute games are fun, but you learn little from them: there is no time to think. A time control of 10 minutes or more gives you time to check every move, and that habit is what wins points.',
        ],
      },
      {
        h2: 'Check before every move',
        paragraphs: ['Before you move, ask yourself three questions, always in the same order:'],
        list: [
          'What is my opponent threatening with their last move?',
          'Do I have a check, a capture or a strong threat?',
          'After my move, is any of my pieces left undefended?',
        ],
      },
      {
        h2: 'Solve puzzles every day',
        paragraphs: [
          'Ten to fifteen puzzles a day train your eye to recognize tactical patterns. A little every day beats one long session a week. Pick puzzles at your level: too hard and you get discouraged, too easy and you learn nothing.',
        ],
      },
      {
        h2: 'Analyze your own mistakes',
        paragraphs: [
          'Your losses contain your best exercises. Spot the mistakes you keep making: hanging pieces, a king left in the center, poorly played endgames. Working on exactly those points makes you improve much faster than general lessons.',
        ],
      },
      {
        h2: 'Learn the basic endgames',
        paragraphs: [
          'Knowing how to mate with a queen or a rook, and the rule of the square in pawn endgames, turns drawn or lost games into wins. A few hours are enough to master them.',
        ],
      },
    ],
    cta: { label: 'Try the personal coach', path: '/progresser/suivi' },
  },
  {
    frSlug: 'meilleures-ouvertures-debutant',
    slug: 'best-chess-openings-for-beginners',
    title: 'The best chess openings for beginners',
    description:
      'The best beginner openings for White and Black: the Italian Game, the London System, the French Defense and the Caro-Kann.',
    h1: 'Which chess openings should beginners play?',
    intro:
      'A good beginner opening is not the most complicated one: it is one that follows the simple principles (center, development, castling) and whose ideas you understand. Here are a few that are easy to pick up.',
    sections: [
      {
        h2: 'With White: the Italian Game',
        paragraphs: [
          'After 1.e4 e5 2.Nf3 Nc6 3.Bc4, White takes the center, develops two pieces and eyes the weak f7 square. Castling comes very quickly. It is an ideal opening to learn the principles.',
        ],
      },
      {
        h2: 'With White: the London System',
        paragraphs: [
          'With d4, Bf4, e3, Nf3 and c3, White builds almost the same solid setup whatever Black plays. There is little theory to learn, so you can focus on the middlegame.',
        ],
      },
      {
        h2: 'With Black against 1.e4',
        paragraphs: [
          'Answering 1...e5 leads to classical, open positions. For a more solid game, the Caro-Kann Defense (1...c6) and the French Defense (1...e6) give pawn structures that are easy to understand.',
        ],
      },
      {
        h2: 'With Black against 1.d4',
        paragraphs: [
          'The Queen’s Gambit Declined (1.d4 d5 2.c4 e6) is a safe choice played at every level. It teaches you to hold the center and free your position at the right moment.',
        ],
      },
      {
        h2: 'Understand rather than memorize',
        paragraphs: [
          'Memorizing 15 moves is useless if your opponent leaves the book on move 4. Remember the ideas: where the pieces go, which pawns to push, where to put the king. Then review your lines regularly so they stick.',
        ],
      },
    ],
    cta: { label: 'Learn your openings', path: '/apprendre/repertoire' },
  },
  {
    frSlug: 'tactiques-aux-echecs',
    slug: 'chess-tactics',
    title: 'Chess tactics you must know: fork, pin, skewer',
    description:
      'The essential tactical patterns explained simply: fork, pin, skewer, discovered attack, double attack and overloading.',
    h1: 'The chess tactics you absolutely need to know',
    intro:
      'A tactic is a short sequence of forcing moves that wins material or delivers mate. A few patterns come up again and again: recognizing them wins you a lot of games.',
    sections: [
      {
        h2: 'The fork',
        paragraphs: [
          'One piece attacks two targets at once, and the opponent can only save one. The knight is the king of forks, especially when it hits the king and the queen at the same time.',
        ],
      },
      {
        h2: 'The pin',
        paragraphs: [
          'A piece cannot move without exposing a more valuable piece behind it. When the piece behind is the king, the pin is absolute: the pinned piece is not allowed to move.',
        ],
      },
      {
        h2: 'The skewer',
        paragraphs: [
          'It is a pin in reverse: you attack a valuable piece, it has to move, and you take the piece that was behind it. Rooks, bishops and the queen are the skewering pieces.',
        ],
      },
      {
        h2: 'The discovered attack',
        paragraphs: [
          'A piece moves and opens the line of another piece, which now attacks. If the moving piece also creates a threat, the opponent faces two attacks at once. When the discovery gives check, it is called a discovered check.',
        ],
      },
      {
        h2: 'Overloading and deflection',
        paragraphs: [
          'A piece that defends two things at once is overloaded. By forcing it to deal with one, you win the other. Deflection means luring a defending piece away from the square it protects.',
        ],
      },
      {
        h2: 'How to remember them',
        paragraphs: [
          'The best way is repetition: solve puzzles sorted by theme, starting with forks and pins, until the pattern jumps out at you in your games.',
        ],
      },
    ],
    cta: { label: 'Practice with puzzles', path: '/apprendre/problemes' },
  },
  {
    frSlug: 'mats-a-connaitre',
    slug: 'checkmate-patterns',
    title: 'Checkmate patterns to know: Scholar’s Mate, back rank, ladder mate',
    description:
      'The classic checkmates every player should know: Scholar’s Mate and how to defend against it, the back rank mate and the ladder mate.',
    h1: 'The checkmates every chess player should know',
    intro: 'Some mating patterns show up in thousands of games. Knowing them lets you deliver them… and above all avoid falling for them.',
    sections: [
      {
        h2: 'Scholar’s Mate',
        paragraphs: [
          'After 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#, the queen, supported by the bishop, mates on f7, Black’s weakest square at the start of the game.',
          'To defend, just protect f7 and chase the queen: 3...g6 or 3...Qe7 hold easily, and the white queen that came out too early becomes a target.',
        ],
      },
      {
        h2: 'The back rank mate',
        paragraphs: [
          'The king has castled behind its pawns, which have not moved. A rook or queen lands on the back rank and the king, boxed in by its own pawns, is mated. To avoid it, create an escape square (“luft”) by pushing a pawn in front of the king at the right moment.',
        ],
      },
      {
        h2: 'The ladder mate',
        paragraphs: [
          'Two rooks (or a rook and a queen) push the king back rank by rank: one cuts the king off, the other gives check, and so on until the edge. It is the first mate to learn when you have a lot of material.',
        ],
      },
      {
        h2: 'Mating with a lone queen or rook',
        paragraphs: [
          'With king and queen against king, you shrink the enemy king’s space step by step until the edge, watching out for stalemate. With a rook the method takes longer but rests on the same idea: cut the king off, then bring your own king closer.',
        ],
      },
    ],
    cta: { label: 'Learn checkmates by playing', path: '/apprendre/cours' },
  },
  {
    frSlug: 'analyser-ses-parties-d-echecs',
    slug: 'how-to-analyze-chess-games',
    title: 'How to analyze your chess games to improve',
    description: 'A simple method to analyze your chess games with or without an engine, spot your recurring mistakes and turn them into exercises.',
    h1: 'How to analyze your chess games',
    intro:
      'Analyzing your games is the most effective way to improve, as long as you do it with a method. The goal is not to find every best move, but to understand your own mistakes.',
    sections: [
      {
        h2: 'First, without an engine',
        paragraphs: [
          'Right after the game, replay it from memory and note the moments where you hesitated and what you were thinking. This is the most useful part: it shows your reasoning, not just your moves.',
        ],
      },
      {
        h2: 'Then with Stockfish',
        paragraphs: [
          'The engine points out blunders (lost pieces, missed mates) and inaccuracies. Do not stop at the best move it suggests: ask yourself what it was threatening and why you did not see it.',
        ],
      },
      {
        h2: 'Spot what keeps coming back',
        paragraphs: ['After a dozen analyzed games, patterns appear:'],
        list: [
          'Pieces left undefended.',
          'Opponent tactics you missed (often the knight fork).',
          'A king left in the center for too long.',
          'Winning endgames that end in a draw.',
        ],
      },
      {
        h2: 'Turn your mistakes into exercises',
        paragraphs: [
          'Take the positions where you went wrong and replay them a few days later, like puzzles. Reviewing your mistakes at the right time locks in the right reaction for next time.',
        ],
      },
    ],
    cta: { label: 'Analyze my games', path: '/progresser/historique' },
  },
  {
    frSlug: 'classement-elo-echecs',
    slug: 'chess-elo-rating',
    title: 'The chess Elo rating system explained simply',
    description: 'How the Elo rating works in chess, how many points you win or lose, and what level a player is at for a given rating.',
    h1: 'How does the chess Elo rating work?',
    intro:
      'The Elo rating, invented by physicist Arpad Elo, measures a player’s strength relative to others. It goes up when you win, down when you lose, and the rating gap with your opponent decides how many points are at stake.',
    sections: [
      {
        h2: 'The principle',
        paragraphs: [
          'Before each game, the rating difference gives a probability of winning. Beating a stronger player earns a lot of points; losing to a weaker player costs a lot. Beating a much weaker player earns almost nothing.',
        ],
      },
      {
        h2: 'Rough levels',
        paragraphs: ['Numbers vary between sites and federations, but as a rule of thumb:'],
        list: [
          'Under 1000: a beginner discovering the game.',
          '1000 to 1400: a casual player who knows the basics.',
          '1400 to 1800: a good club player.',
          '1800 to 2200: a strong player with tournament experience.',
          'Above 2500: international grandmaster level.',
        ],
      },
      {
        h2: 'Why your rating differs from one site to another',
        paragraphs: [
          'Each site has its own player pool and its own settings. A 1500 on one site may be worth 1300 elsewhere. What matters is your progress on the same site, in the same time control.',
        ],
      },
      {
        h2: 'Raising your rating',
        paragraphs: [
          'Points mostly come from making fewer mistakes: checking threats before every move, practicing tactics and analyzing your losses. Progress often comes in steps, after a plateau.',
        ],
      },
    ],
    cta: { label: 'Measure my rating against bots', path: '/jouer/bot' },
  },
];
