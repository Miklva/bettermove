// Sections "Strategie et plans" et "Defense et calcul".
// Positions verifiees avec Stockfish 17.1 (profondeur 20) : chaque quiz a une seule bonne reponse,
// au moins 1,5 pion meilleure que les autres options.
import type { Chapter } from './courses';

const OUTPOST = 'r1bq1rk1/pp2bppp/3p1n2/2p1p3/2P1P3/2NP1N2/PP2BPPP/R2Q1RK1 w - - 0 10';
const OPEN_FILE = 'r4rk1/ppp2ppp/2n1b3/4p3/4P3/2N1B3/PPP2PPP/R4RK1 w - - 0 12';
const SEVENTH = '6k1/1pp2pp1/p6p/8/8/8/PP3PPP/3R2K1 w - - 0 1';
const BAD_BISHOP = '6k1/5ppp/3p1n2/2pPp3/2P1P3/3B4/5PPP/6K1 w - - 0 1';
const ISOLATED = '4k3/pp3ppp/2p5/2p5/3P4/8/PP3PPP/4K3 w - - 0 1';
const PASSED = '4k3/p4ppp/8/1P1P4/8/8/P4PPP/4K3 w - - 0 1';
// Attaque yougoslave (Dragon) : 1.e4 c5 2.Cf3 d6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 g6 6.Fe3 Fg7 7.f3 O-O 8.Dd2 Cc6 9.O-O-O
const OPPOSITE = 'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R b - - 4 9';

const THREAT = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
const CANDIDATES = 'r3k2r/pp3ppp/n1p1b3/1N1p1q2/3P4/1BP5/PP4PP/R1BQ3K w kq - 0 15';
const QUIET = '8/8/1K6/p5pp/P1P3k1/1P6/8/8 w - - 0 53';
const LONG = '4rr1k/p1Qn2pp/3p1q2/8/8/2P5/PP3PPP/RN3RK1 b - - 0 16';
const PERPETUAL = '6k1/R4ppp/8/Q7/2q5/7P/5PP1/6K1 b - - 0 1';
const STALEMATE = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';

export const STRATEGY: Chapter = {
  id: 'strategy',
  title: 'Stratégie et plans',
  icon: '🧭',
  color: '#c9a3ff',
  description: 'Que faire quand il n’y a pas de tactique ? Les idées qui guident un plan, coup après coup.',
  lessons: [
    {
      id: 'outpost',
      title: 'Les avant-postes',
      icon: '🏰',
      summary: 'La case idéale pour un cavalier, que l’adversaire ne peut plus chasser.',
      steps: [
        {
          type: 'theory',
          title: 'Une case que personne ne peut chasser',
          text: 'Un avant-poste est une case dans le camp adverse, protégée par un de tes pions, qu’aucun pion adverse ne peut plus attaquer. Ici, d5 est soutenue par les pions c4 et e4, et les pions noirs c5 et e5 sont déjà passés à côté : plus aucun pion noir ne pourra chasser une pièce blanche installée en d5.',
          fen: OUTPOST,
          circles: [
            ['d5', 'green'],
            ['c4', 'blue'],
            ['e4', 'blue'],
          ],
        },
        {
          type: 'theory',
          title: 'Le cavalier, roi des avant-postes',
          text: 'Un cavalier en d5 rayonne au cœur du camp adverse, et on ne peut le déloger qu’en l’échangeant contre une pièce. Le plan blanc est simple : Cc3-d5, puis appuyer avec les autres pièces. L’erreur des Noirs a été de pousser c5 et e5 : chaque coup de pion laisse derrière lui des cases qu’il ne pourra plus jamais défendre.',
          fen: OUTPOST,
          arrows: [
            ['c3', 'd5', 'green'],
            ['d5', 'e7', 'yellow'],
            ['d5', 'f6', 'yellow'],
            ['d5', 'b6', 'yellow'],
          ],
        },
        {
          type: 'choice',
          question: 'Quelle case est un avant-poste pour un cavalier blanc ?',
          options: ['d5', 'f5', 'b5', 'd4'],
          answer: 0,
          explain: 'd5 : protégée par c4 et e4, et plus aucun pion noir ne peut l’attaquer. Un cavalier en f5 serait chassé par …g6, un cavalier en b5 par …a6, et d4 n’est pas dans le camp adverse (les pions c5 et e5 la contrôlent).',
          fen: OUTPOST,
        },
      ],
    },
    {
      id: 'open-file',
      title: 'Les colonnes ouvertes',
      icon: '🗼',
      summary: 'Où placer ses tours, et comment entrer chez l’adversaire.',
      steps: [
        {
          type: 'theory',
          title: 'Une colonne sans pion',
          text: 'Une colonne sans aucun pion est « ouverte » : une tour y voit jusqu’au bout du plateau. Ici, seule la colonne d est ouverte. La première tour qui s’y installe la contrôle, et l’autre camp ne pourra plus l’utiliser sans échanger.',
          fen: OPEN_FILE,
          arrows: [['f1', 'd1', 'green']],
          circles: [
            ['d4', 'yellow'],
            ['d5', 'yellow'],
            ['d6', 'yellow'],
          ],
        },
        {
          type: 'theory',
          title: 'Objectif : la 7e rangée',
          text: 'Une fois la colonne prise, la tour entre sur la 7e rangée (la 2e pour les Noirs). Là, elle attaque les pions qui n’ont pas encore bougé et enferme souvent le roi adverse sur sa dernière rangée. Deux tours sur la 7e rangée, c’est souvent décisif.',
          fen: SEVENTH,
          arrows: [
            ['d1', 'd7', 'green'],
            ['d7', 'c7', 'red'],
            ['d7', 'f7', 'red'],
          ],
        },
        {
          type: 'choice',
          question: 'Aucun camp n’a de tactique. Quel coup de tour est le plus logique pour les Blancs ?',
          options: ['Tfd1 : prendre la colonne d, la seule ouverte', 'Tab1 : préparer b4', 'Tfe1 : défendre e4', 'Rh1 : mettre le roi à l’abri'],
          answer: 0,
          explain: 'Tfd1 : la colonne d est la seule ouverte, la tour y devient active et pourra entrer en d7. Les autres coups sont passifs : e4 n’est pas attaqué et le roi est déjà en sécurité.',
          fen: OPEN_FILE,
        },
      ],
    },
    {
      id: 'bad-bishop',
      title: 'Bon et mauvais fou',
      icon: '♝',
      summary: 'Des pions bien placés libèrent tes fous.',
      steps: [
        {
          type: 'theory',
          title: 'Un fou gêné par ses propres pions',
          text: 'Le fou blanc d3 se déplace sur les cases blanches. Or les pions blancs c4, d5 et e4 sont eux aussi sur des cases blanches : ils lui bouchent la route. C’est un « mauvais fou ». Le cavalier noir, lui, n’a pas ce problème et peut viser les cases noires que le fou ne contrôlera jamais.',
          fen: BAD_BISHOP,
          circles: [
            ['d3', 'yellow'],
            ['c4', 'red'],
            ['d5', 'red'],
            ['e4', 'red'],
          ],
        },
        {
          type: 'theory',
          title: 'La règle simple',
          text: 'Mets tes pions sur des cases de la couleur opposée à celle de ton fou. Ils contrôlent alors les cases que le fou ne voit pas, et le fou garde ses diagonales libres. Si ton fou est mauvais, cherche à l’échanger, ou à le faire sortir devant ta chaîne de pions.',
          fen: BAD_BISHOP,
        },
        {
          type: 'choice',
          question: 'Il te reste un fou de cases noires. Où placer de préférence tes pions ?',
          options: ['Sur les cases blanches', 'Sur les cases noires', 'Peu importe'],
          answer: 0,
          explain: 'Sur les cases blanches : ils couvrent les cases que ton fou ne voit pas, et ne bloquent pas ses diagonales.',
        },
      ],
    },
    {
      id: 'pawn-structure',
      title: 'Les structures de pions',
      icon: '🧱',
      summary: 'Pions isolés, doublés, passés : qui est faible, qui est fort.',
      steps: [
        {
          type: 'theory',
          title: 'Isolés et doublés',
          text: 'Un pion isolé n’a plus de voisin sur les colonnes d’à côté : aucun pion ne peut le défendre, il faut le protéger avec des pièces (ici d4). Des pions doublés, deux sur la même colonne, se gênent et se défendent mal (ici c5 et c6). Ce sont des cibles, surtout en finale.',
          fen: ISOLATED,
          circles: [
            ['d4', 'red'],
            ['c5', 'red'],
            ['c6', 'red'],
          ],
        },
        {
          type: 'theory',
          title: 'Le pion passé',
          text: 'Un pion est « passé » quand aucun pion adverse ne se trouve devant lui, ni sur les deux colonnes voisines. Seules des pièces peuvent encore l’arrêter. En finale, un pion passé vaut bien plus qu’un pion : pousse-le, en le soutenant avec ton roi et tes pièces.',
          fen: PASSED,
          circles: [['d5', 'green']],
          arrows: [['d5', 'd8', 'green']],
        },
        {
          type: 'choice',
          question: 'Quel pion blanc est passé ?',
          options: ['b5', 'd5', 'a2', 'h2'],
          answer: 1,
          explain: 'd5 : aucun pion noir sur les colonnes c, d ou e. Le pion b5, lui, n’est pas passé : s’il avance en b6, le pion a7 le prend.',
          fen: PASSED,
        },
        { type: 'puzzles', title: 'Pions passés guidés', theme: 'advancedPawn', count: 3, mode: 'guided' },
        { type: 'puzzles', title: 'À ton niveau', theme: 'advancedPawn', count: 3, mode: 'practice' },
      ],
    },
    {
      id: 'king-attack',
      title: 'Attaquer le roi',
      icon: '🔥',
      summary: 'Roques opposés, poussée de pions, et plus d’attaquants que de défenseurs.',
      steps: [
        {
          type: 'theory',
          title: 'Les roques opposés',
          text: 'Quand les rois ont roqué chacun de leur côté, on peut pousser les pions devant le roi adverse sans affaiblir le sien. Ici, les Blancs vont jouer g4, h4-h5, ouvrir la colonne h et chercher le mat. Les Noirs attaquent de leur côté sur l’aile dame. C’est une course : le plus rapide gagne.',
          fen: OPPOSITE,
          arrows: [
            ['h2', 'h4', 'green'],
            ['g2', 'g4', 'green'],
            ['b7', 'b5', 'red'],
          ],
        },
        {
          type: 'theory',
          title: 'Compter les attaquants',
          text: 'Une attaque réussit quand tu as plus de pièces près du roi adverse qu’il n’a de défenseurs. Avant de foncer, amène tes pièces : ici Fh6 échange le fou g7, le meilleur défenseur du roi noir, et la dame d2 suit vers h6. Une attaque avec une seule pièce échoue presque toujours.',
          fen: OPPOSITE,
          arrows: [
            ['e3', 'h6', 'green'],
            ['d2', 'h6', 'green'],
          ],
          circles: [['g7', 'red']],
        },
        {
          type: 'choice',
          question: 'Les rois ont roqué de côtés opposés. Quel est le bon plan pour les Blancs ?',
          options: ['Pousser g4 et h4-h5 vers le roi noir', 'Pousser a4 et b4 devant ton propre roi', 'Échanger les dames au plus vite'],
          answer: 0,
          explain: 'Avec des roques opposés, on attaque avec les pions qui ne protègent pas son propre roi. Pousser a4-b4 ouvrirait ton roi, et échanger les dames enlèverait la pièce la plus forte de l’attaque.',
          fen: OPPOSITE,
        },
        { type: 'puzzles', title: 'Attaques guidées', theme: 'kingsideAttack', count: 3, mode: 'guided' },
        { type: 'puzzles', title: 'À ton niveau', theme: 'kingsideAttack', count: 3, mode: 'practice' },
      ],
    },
  ],
};

export const DEFENSE: Chapter = {
  id: 'defense',
  title: 'Défense et calcul',
  icon: '🛡️',
  color: '#ff9b6b',
  description: 'Voir les menaces adverses, chercher les coups dans le bon ordre, calculer avant de jouer.',
  lessons: [
    {
      id: 'threats',
      title: 'Que menace l’adversaire ?',
      icon: '👀',
      summary: 'La question à se poser après chaque coup adverse.',
      steps: [
        {
          type: 'theory',
          title: 'Le réflexe anti-gaffe',
          text: 'La plupart des parties se perdent sur une menace qu’on n’a pas vue. Après chaque coup adverse, demande-toi : « Qu’attaque ce coup ? Que prépare-t-il ? » Regarde la pièce qui vient de bouger, et les lignes qu’elle vient d’ouvrir. Ici, la dame et le fou blancs visent tous les deux f7.',
          fen: THREAT,
          arrows: [
            ['h5', 'f7', 'red'],
            ['c4', 'f7', 'red'],
          ],
        },
        {
          type: 'quiz',
          fen: THREAT,
          question: 'Les Blancs menacent Dxf7#. Quel coup pare la menace ?',
          options: ['g7g6', 'g8f6', 'a7a6', 'd7d5'],
          answer: 0,
          explain: 'g6 chasse la dame et ferme la diagonale vers f7. Cf6 ?? a l’air naturel mais laisse Dxf7#, comme a6 ?? qui ne fait rien. d5 attaque le fou, mais la menace sur f7 reste et les Noirs perdent du matériel.',
        },
        {
          type: 'theory',
          title: 'Vérifie aussi ton propre coup',
          text: 'Avant de jouer, trois questions : ma pièce sera-t-elle protégée sur sa nouvelle case ? Est-ce que je laisse une autre pièce sans défense ? Quels échecs et quelles prises l’adversaire aura-t-il après mon coup ? Dix secondes de vérification évitent la plupart des gaffes.',
        },
        { type: 'puzzles', title: 'Trouve la défense', theme: 'defensiveMove', count: 3, mode: 'guided' },
        { type: 'puzzles', title: 'À ton niveau', theme: 'defensiveMove', count: 3, mode: 'practice' },
      ],
    },
    {
      id: 'candidates',
      title: 'Échecs, prises, menaces',
      icon: '🔍',
      summary: 'Dans quel ordre chercher ses coups.',
      steps: [
        {
          type: 'theory',
          title: 'Les coups forcés d’abord',
          text: 'Avant de chercher un plan, regarde les coups qui forcent la réponse de l’adversaire : d’abord tous tes échecs, puis toutes tes prises, puis tes menaces. Ce sont eux qui gagnent du matériel ou qui matent. La même méthode, appliquée aux coups adverses, t’évite de rater ce qu’il peut te faire.',
        },
        {
          type: 'quiz',
          fen: CANDIDATES,
          question: 'Applique la méthode : commence par les échecs. Quel coup gagne ?',
          options: ['b5d6', 'b3c2', 'a2a4', 'd1e2'],
          answer: 0,
          explain: 'Cd6+ ! L’échec attaque aussi la dame f5 : c’est une fourchette. Le roi noir doit bouger, puis Cxf5 gagne la dame. Les autres coups laissent passer l’occasion, et les Noirs restent mieux.',
        },
        { type: 'puzzles', title: 'Coups forcés', theme: 'crushing', count: 3, mode: 'guided' },
        { type: 'puzzles', title: 'À ton niveau', theme: 'crushing', count: 4, mode: 'practice' },
      ],
    },
    {
      id: 'quiet-move',
      title: 'Le coup tranquille',
      icon: '🤫',
      summary: 'Parfois, le meilleur coup n’est ni un échec ni une prise.',
      steps: [
        {
          type: 'theory',
          title: 'Quand rien n’est forcé',
          text: 'Les échecs, prises et menaces passent en premier, mais ils ne gagnent pas toujours. Parfois, un coup calme est le plus fort : il prépare une menace imparable, enferme une pièce ou fait avancer un pion que plus rien n’arrêtera. Si tes coups forcés ne donnent rien, cherche ce coup qui améliore ta position sans laisser de contre-jeu.',
        },
        {
          type: 'quiz',
          fen: QUIET,
          question: 'Prendre le pion a5 est tentant. Y a-t-il mieux ?',
          options: ['c4c5', 'b6a5', 'b6b5', 'b6c5'],
          answer: 0,
          explain: 'c5 ! Le pion file vers c8 et le roi noir est bien trop loin pour le rattraper : les Blancs font dame les premiers. Rxa5 ramasse un pion mais perd un temps précieux, et les pions noirs g et h suffisent alors pour annuler. Rc5 ?? perd même la course.',
        },
        { type: 'puzzles', title: 'Coups tranquilles', theme: 'quietMove', count: 3, mode: 'guided' },
        { type: 'puzzles', title: 'À ton niveau', theme: 'quietMove', count: 3, mode: 'practice' },
      ],
    },
    {
      id: 'calculation',
      title: 'Calculer plus loin',
      icon: '🧮',
      summary: 'Voir deux ou trois coups à l’avance, sans toucher les pièces.',
      steps: [
        {
          type: 'theory',
          title: 'Une suite forcée',
          text: 'Calculer, c’est jouer la suite dans ta tête : ton coup, la meilleure réponse adverse, ton coup suivant… Plus les coups sont forcés (échecs, prises), plus le calcul est sûr. À chaque étape, demande-toi quelles réponses l’adversaire a vraiment, et ne joue le premier coup qu’une fois la position finale bien vue.',
        },
        {
          type: 'quiz',
          fen: LONG,
          question: 'Les Noirs ont un mat en 3. Calcule avant de jouer : quel est le premier coup ?',
          options: ['f6f2', 'e8e1', 'd7e5', 'f6f4'],
          answer: 0,
          explain: 'Dxf2+ ! Après Txf2, Te1+ Tf1 Txf1#. Si le roi fuit en h1, Dxf1# mate encore plus vite. Le roi blanc, enfermé par ses propres pions, n’a aucune case de fuite.',
        },
        {
          type: 'theory',
          title: 'La solution, coup par coup',
          text: 'Dxf2+ Txf2 Te1+ Tf1 Txf1#. Trois coups, tous forcés : c’est ce qui rend ce calcul possible. Entraîne-toi à voir la position finale avant de jouer le premier coup.',
          fen: LONG,
          line: ['f6f2', 'f1f2', 'e8e1', 'f2f1', 'e1f1'],
        },
        { type: 'puzzles', title: 'Suites longues', theme: 'long', count: 3, mode: 'guided' },
        { type: 'puzzles', title: 'À ton niveau', theme: 'long', count: 3, mode: 'practice' },
      ],
    },
    {
      id: 'save-draw',
      title: 'Sauver une partie perdue',
      icon: '🛟',
      summary: 'Échec perpétuel et pat : quand la nulle vaut une victoire.',
      steps: [
        {
          type: 'theory',
          title: 'L’échec perpétuel',
          text: 'Quand tu es perdu, cherche la nulle. Si ta dame peut donner échec sans fin et que le roi adverse ne peut pas s’abriter, la partie est nulle par répétition. Un roi entouré de ses pions, sans pièce pour bloquer l’échec, est la cible idéale.',
          fen: PERPETUAL,
          arrows: [['c4', 'c1', 'green']],
        },
        {
          type: 'quiz',
          fen: PERPETUAL,
          question: 'Les Noirs ont une tour de moins. Comment sauver la partie ?',
          options: ['c4c1', 'g7g6', 'h7h6', 'c4c8'],
          answer: 0,
          explain: 'Dc1+ ! Après Rh2, Df4+ Rg1 Dc1+ : la dame donne échec sans arrêt, c’est nulle. g6 laisse les Blancs gagner tranquillement, et h6 ?? ou Dc8 ?? perdent tout de suite face aux menaces de mat.',
        },
        {
          type: 'theory',
          title: 'Le pat',
          text: 'Si le joueur au trait n’a aucun coup légal et n’est pas en échec, c’est pat : partie nulle. Ici, les Noirs sont au trait et le roi h8 n’a plus aucune case. Quand tu défends avec un roi seul, cherche ces positions ; quand tu gagnes, laisse toujours une case au roi adverse !',
          fen: STALEMATE,
          circles: [['h8', 'red']],
        },
        { type: 'puzzles', title: 'Trouve la défense', theme: 'equality', count: 3, mode: 'practice' },
      ],
    },
  ],
};
