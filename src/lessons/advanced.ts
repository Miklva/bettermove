// Lecons d'approfondissement (niveau 2) des sections existantes.
// Les demonstrations viennent de vrais problemes Lichess (CC0) ; les finales ont ete verifiees avec Stockfish.
import type { Lesson } from './courses';
import { themeLesson } from './builders';

export const TACTICS_ADVANCED: Lesson[] = [
  themeLesson({
    id: 'deflection',
    title: 'La déviation',
    icon: '↪️',
    summary: 'Forcer un défenseur à quitter son poste.',
    intro:
      'Une pièce adverse a un rôle (protéger une case, une pièce, une rangée). La déviation consiste à l’obliger à bouger, souvent par un échec ou une prise, pour que ce qu’elle défendait tombe.',
    demo: {
      fen: '8/3R3p/6pk/5p2/5PP1/7P/rr1B1K2/8 w - - 1 47',
      line: ['g4g5', 'h6h5', 'd7h7'],
      title: 'Le roi dévié',
      text: 'Le roi h6 protège le pion h7. g5+ le chasse en h5 : il ne défend plus h7, et Txh7 est mat.',
    },
    theme: 'deflection',
  }),
  themeLesson({
    id: 'attraction',
    title: 'L’attraction',
    icon: '🧲',
    summary: 'Attirer le roi sur une case mortelle.',
    intro:
      'L’attraction est un sacrifice qui attire une pièce adverse (très souvent le roi) sur une case où elle devient la cible d’un mat ou d’une fourchette. On donne du matériel, mais le coup suivant est décisif.',
    demo: {
      fen: 'r1b2r1k/2p1q1pp/1p3p2/p3p2R/P3P3/1B1P4/1PP1Q1PP/5RK1 w - - 2 23',
      line: ['h5h7', 'h8h7', 'e2h5'],
      title: 'Txh7+ !',
      text: 'La tour se sacrifie en h7 et attire le roi. Après Rxh7, Dh5 est mat : le fou b3 contrôle g8, le roi n’a plus de case.',
    },
    theme: 'attraction',
  }),
  themeLesson({
    id: 'remove-defender',
    title: 'Éliminer le défenseur',
    icon: '🛡️',
    summary: 'Prendre la pièce qui protège la cible.',
    intro:
      'Avant d’attaquer une pièce bien défendue, regarde QUI la défend. Si tu peux prendre (ou échanger) ce défenseur, la cible tombe ensuite.',
    demo: {
      fen: 'r2r2k1/1b2bppp/p1n2n2/1pp1N3/5P2/7P/PPP3P1/RNB1RBK1 w - - 1 15',
      line: ['e5c6', 'b7c6', 'e1e7'],
      title: 'Le cavalier c6 défendait e7',
      text: 'Cxc6 élimine le cavalier qui protégeait le fou e7, et démasque la tour e1. Après Fxc6, Txe7 gagne une pièce.',
    },
    theme: 'capturingDefender',
  }),
  themeLesson({
    id: 'intermezzo',
    title: 'Le coup intermédiaire',
    icon: '⏸️',
    summary: 'Ne pas reprendre tout de suite.',
    intro:
      'Quand une prise ou une reprise semble évidente, demande-toi s’il existe d’abord un coup plus fort (un échec, une menace). Ce « coup intermédiaire » change souvent tout le bilan de l’échange.',
    demo: {
      fen: 'r3kb1r/pp3ppp/1nn1p3/8/3q4/5BB1/PP3PPP/RN1QK2R w KQkq - 0 12',
      line: ['f3c6', 'b7c6', 'd1d4'],
      title: 'D’abord l’échec',
      text: 'Dxd4 tout de suite ? Le cavalier c6 reprendrait. Alors Fxc6+ d’abord : l’échec élimine le défenseur, et Dxd4 gagne ensuite la dame.',
    },
    theme: 'intermezzo',
  }),
  themeLesson({
    id: 'xray',
    title: 'Le rayon X',
    icon: '🩻',
    summary: 'Une pièce qui agit à travers une autre.',
    intro:
      'Une tour, un fou ou une dame continue de « voir » à travers une pièce placée sur sa ligne. Quand cette pièce disparaît (échange, sacrifice), la pièce de derrière entre en action.',
    demo: {
      fen: '4r1k1/pp3ppp/4r3/3q4/Q2p4/3P3P/PP3PP1/4RRK1 w - - 2 22',
      line: ['a4e8', 'e6e8', 'e1e8'],
      title: 'La tour derrière la tour',
      text: 'La tour e1 vise e8 à travers la tour e6. Dxe8+ ! Txe8 et Txe8 est mat : c’est aussi un mat du couloir.',
    },
    theme: 'xRayAttack',
  }),
];

export const KING_ADVANCED: Lesson[] = [
  themeLesson({
    id: 'mate3',
    title: 'Mat en 3',
    icon: '🧩',
    summary: 'Trois coups forcés jusqu’au mat.',
    intro:
      'Un mat en 3 se calcule comme un mat en 2 : chaque coup doit être forcé (échec, prise, menace de mat). Visualise la position après chaque réponse adverse avant de jouer.',
    demo: {
      fen: 'r5k1/1q2Rp2/p5rp/1p1b2p1/5n2/8/PQ4PP/4R1K1 w - - 4 36',
      line: ['e7e8', 'a8e8', 'e1e8', 'g8h7', 'b2h8'],
      title: 'Échec, échec, mat',
      text: 'Te8+ force Txe8, Txe8+ repousse le roi en h7, et Dh8 est mat grâce à la grande diagonale.',
    },
    theme: 'mateIn3',
  }),
  themeLesson({
    id: 'arabian',
    title: 'Le mat arabe',
    icon: '🐪',
    summary: 'Tour et cavalier contre un roi dans le coin.',
    intro:
      'Un des plus vieux mats connus : le cavalier protège la tour et contrôle une case de fuite, la tour mate le roi coincé dans un angle.',
    demo: {
      fen: '5bk1/2R5/6p1/p2N3p/3n3P/6PK/r7/1q6 w - - 2 54',
      line: ['d5f6', 'g8h8', 'c7h7'],
      title: 'Cf6+ puis Th7#',
      text: 'Cf6+ chasse le roi en h8. Le cavalier f6 protège h7 et contrôle g8 : Th7 est mat.',
    },
    theme: 'arabianMate',
  }),
  themeLesson({
    id: 'anastasia',
    title: 'Le mat d’Anastasia',
    icon: '🌹',
    summary: 'Cavalier et tour sur le bord.',
    intro:
      'Le cavalier enferme le roi contre le bord de l’échiquier (et ses propres pions), puis la tour mate sur la colonne du bord.',
    demo: {
      fen: 'r2b4/1p5p/p3N1pk/2p5/P1P5/1n1R4/1r3PPP/3R2K1 w - - 4 27',
      line: ['d3h3', 'd8h4', 'h3h4'],
      title: 'La colonne h',
      text: 'Le cavalier e6 prive le roi de g5 et g7. Th3+ : le fou s’interpose en h4, et Txh4 est mat.',
    },
    theme: 'anastasiaMate',
  }),
  themeLesson({
    id: 'boden',
    title: 'Le mat de Boden',
    icon: '✂️',
    summary: 'Deux fous qui se croisent.',
    intro:
      'Deux fous sur des diagonales qui se croisent devant le roi suffisent à le mater quand ses propres pièces bloquent les autres cases.',
    demo: {
      fen: 'rq2kbr1/1b3p2/5Bpp/Np2p3/4P3/8/PPP3PP/2K2B1R w q - 0 19',
      line: ['f1b5', 'b7c6', 'b5c6'],
      title: 'Les ciseaux',
      text: 'Fxb5+ : le fou noir s’interpose en c6, et Fxc6 est mat. Le fou f6 tient d8 et e7, le fou c6 fait échec.',
    },
    theme: 'bodenMate',
  }),
  themeLesson({
    id: 'double-check',
    title: 'L’échec double',
    icon: '⚡',
    summary: 'L’arme la plus forcée qui existe.',
    intro:
      'Contre un échec double, on ne peut ni prendre ni s’interposer : le roi DOIT bouger. Cherche les pièces qui, en bougeant, démasquent un échec tout en donnant échec elles-mêmes.',
    demo: {
      fen: 'r4rk1/2p2ppp/4q3/pB2b3/1P6/P4Q1P/2P2PP1/1R1NK2R b K - 0 18',
      line: ['e5c3', 'e1f1', 'e6e1'],
      title: 'Fc3+ !',
      text: 'Le fou donne échec ET démasque la dame e6 sur la colonne e : échec double. Le roi doit fuir en f1, et De1 est mat.',
    },
    theme: 'doubleCheck',
  }),
];

export const ENDGAME_ADVANCED: Lesson[] = [
  {
    id: 'key-squares',
    title: 'Les cases clés',
    icon: '🗝️',
    summary: 'Où placer le roi pour faire dame.',
    steps: [
      {
        type: 'theory',
        title: 'Le roi devant, sur les cases clés',
        text: 'Dans la finale roi + pion contre roi, pour un pion qui n’a pas dépassé sa 4e rangée, les « cases clés » sont les trois cases situées deux rangées devant lui. Si ton roi atteint l’une d’elles, le pion fait dame quoi que fasse l’adversaire.',
        fen: '8/8/5k2/8/2K1P3/8/8/8 w - - 0 1',
        circles: [
          ['d6', 'green'],
          ['e6', 'green'],
          ['f6', 'green'],
        ],
      },
      {
        type: 'goal',
        title: 'Défi : un seul coup gagne',
        text: 'Un seul premier coup gagne. Trouve-le, puis amène ton pion à la promotion contre Stockfish.',
        fen: '8/8/5k2/8/2K1P3/8/8/8 w - - 0 1',
        goal: 'promote',
        maxMoves: 20,
        tips: ['Le roi passe devant le pion.', 'Vise les cases clés d6, e6, f6.', 'Le pion attend.'],
      },
      { type: 'puzzles', title: 'Finales de pions', theme: 'pawnEndgame', count: 3, mode: 'practice' },
    ],
  },
  {
    id: 'eat-pawn',
    title: 'Manger le pion',
    icon: '🍽️',
    summary: 'Quand ton roi doit d’abord croquer.',
    steps: [
      {
        type: 'theory',
        title: 'Le pion adverse d’abord',
        text: 'Avec un pion de chaque côté, la question est souvent : mon roi doit-il aller manger le pion adverse avant de pousser le mien ? Si ton roi est tout près du pion ennemi et que le roi adverse est loin du tien, manger d’abord supprime tout le contre-jeu.',
      },
      {
        type: 'goal',
        title: 'Défi : mange, puis fais dame',
        text: 'Un seul coup gagne ici. Ensuite, amène ton pion c à dame.',
        fen: '3k4/8/5p2/5K2/8/8/2P5/8 w - - 0 1',
        goal: 'promote',
        maxMoves: 20,
        tips: ['Le pion f6 est à portée de ton roi.', 'Sans pion noir, la nulle devient impossible.'],
      },
      {
        type: 'goal',
        title: 'Défi bonus',
        text: 'Même idée : un seul coup gagne. Les autres annulent.',
        fen: '8/1k6/8/8/8/3pK3/5P2/8 w - - 0 1',
        goal: 'promote',
        maxMoves: 20,
        tips: ['Le pion d3 est presque à dame… mais il est à côté de ton roi.'],
      },
    ],
  },
  {
    id: 'race',
    title: 'Courir plutôt que manger',
    icon: '🏃',
    summary: 'Quand chasser le pion fait perdre la partie.',
    steps: [
      {
        type: 'theory',
        title: 'Compter les coups',
        text: 'Manger un pion n’est pas toujours la bonne idée : pendant que ton roi le chasse, le roi adverse rattrape TON pion. Compte les coups : combien pour que ton pion fasse dame ? Combien pour le sien ? Si tu gagnes la course, cours !',
      },
      {
        type: 'goal',
        title: 'Défi : la course',
        text: 'Rxd7 semble naturel… mais il ne fait que nulle. Trouve le coup gagnant et fais dame.',
        fen: '8/2Kp4/8/8/5P2/3k4/8/8 w - - 0 1',
        goal: 'promote',
        maxMoves: 15,
        tips: ['Ton pion f4 a besoin de 4 coups.', 'Le pion d7 en a besoin de 6.', 'Le roi noir peut-il rattraper ton pion ?'],
      },
      {
        type: 'goal',
        title: 'Défi bonus',
        text: 'Même piège : ne te laisse pas tenter par la prise.',
        fen: '8/3Kp3/8/8/8/4P3/7k/8 w - - 0 1',
        goal: 'promote',
        maxMoves: 15,
        tips: ['Compte les coups de chaque pion.'],
      },
    ],
  },
  {
    id: 'lucena',
    title: 'La position de Lucena',
    icon: '🌉',
    summary: 'Gagner tour + pion contre tour : le pont.',
    steps: [
      {
        type: 'theory',
        title: 'Construire un pont',
        text: 'Ton pion est en 7e, ton roi devant lui, le roi adverse coupé d’une colonne. 1) Coupe encore le roi adverse avec un échec de la tour. 2) Mets ta tour en 4e rangée. 3) Sors ton roi : quand les échecs arrivent, ta tour s’interpose. C’est le « pont ».',
        fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
        arrows: [['c1', 'd1', 'green']],
      },
      {
        type: 'goal',
        title: 'Défi : fais dame',
        text: 'Gagne contre Stockfish : fais dame avec le pion b7.',
        fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
        goal: 'promote',
        maxMoves: 20,
        tips: ['Td1+ d’abord pour éloigner le roi noir.', 'Puis amène ta tour sur la 4e rangée : c’est le pont.', 'Sors ton roi ; quand les échecs arrivent, interpose ta tour.'],
      },
      { type: 'puzzles', title: 'Finales de tours', theme: 'rookEndgame', count: 3, mode: 'practice' },
    ],
  },
  {
    id: 'philidor',
    title: 'La défense Philidor',
    icon: '🧱',
    summary: 'Tenir la nulle tour contre tour + pion.',
    steps: [
      {
        type: 'theory',
        title: 'La tour sur la 6e rangée',
        text: 'En défense, garde ta tour sur ta 3e rangée (la 6e pour les Noirs) : le roi blanc ne peut pas avancer. Quand le pion avance sur cette rangée, il n’abrite plus son roi : ta tour part alors tout au fond et donne des échecs par derrière.',
        fen: '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',
        arrows: [['a6', 'h6', 'green']],
      },
      {
        type: 'goal',
        title: 'Défi : tiens 20 coups',
        text: 'Tu as les Noirs. Tiens 20 coups sans perdre contre Stockfish.',
        fen: '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',
        goal: 'hold',
        maxMoves: 20,
        tips: ['Reste sur la 6e rangée tant que le pion n’y est pas.', 'Pion en e6 : tour en bas, échecs par derrière.', 'Garde ton roi devant le pion.'],
      },
    ],
  },
];

export const OPENING_REFLEXES_ADVANCED: Lesson[] = [
  themeLesson({
    id: 'f7',
    title: 'Le point faible f7',
    icon: '🎯',
    summary: 'Le pion que seul le roi défend.',
    intro:
      'En début de partie, f7 (f2 pour les Blancs) n’est défendu que par le roi. La dame, le fou c4 et le cavalier g5 aiment le viser. Pense à le protéger, et à l’attaquer quand l’adversaire l’oublie.',
    demo: {
      fen: 'rn2k1nr/p1pp1p2/4p3/1p6/4P1pq/5Q2/PPPP2KP/RNB2R2 w kq - 0 12',
      line: ['f3f7', 'e8d8', 'f7f8'],
      title: 'Dxf7+ puis Df8#',
      text: 'La dame prend en f7 avec échec, le roi fuit en d8, et Df8 est mat.',
    },
    theme: 'attackingF2F7',
  }),
  themeLesson({
    id: 'castling-tricks',
    title: 'Le roque comme arme',
    icon: '🏰',
    summary: 'Roquer en donnant échec.',
    intro:
      'Le roque met le roi à l’abri et active une tour d’un coup. Parfois, la tour arrive même avec échec, ou sur une colonne ouverte avec une menace.',
    demo: {
      fen: 'rn1k2nr/5ppp/4p3/p7/1b2b3/1PN5/1B3PPP/R3KBNR w KQ - 0 13',
      line: ['e1c1', 'd8e7', 'c3e4'],
      title: 'O-O-O+ !',
      text: 'Le grand roque amène la tour en d1 avec échec au roi d8. Après Re7, Cxe4 ramasse le fou.',
    },
    theme: 'castling',
  }),
  themeLesson({
    id: 'en-passant',
    title: 'La prise en passant',
    icon: '👻',
    summary: 'La règle que tout le monde oublie.',
    intro:
      'Quand un pion avance de deux cases et arrive à côté d’un de tes pions, tu peux le prendre comme s’il n’avait avancé que d’une case, mais seulement au coup suivant. Ça peut même donner… mat.',
    demo: {
      fen: '3R4/p1r2pbk/Bp5p/4P1p1/5pK1/5P2/P4r2/1R6 w - - 0 33',
      line: ['a6d3', 'f7f5', 'e5f6'],
      title: 'exf6 en passant, mat !',
      text: 'Fd3+ : le seul moyen de parer est f5. Mais exf6 en passant est mat, la découverte du fou d3 fait échec.',
    },
    theme: 'enPassant',
  }),
  themeLesson({
    id: 'underpromotion',
    title: 'La sous-promotion',
    icon: '🐴',
    summary: 'Quand le cavalier vaut mieux que la dame.',
    intro:
      'Un pion qui arrive au bout peut devenir dame, tour, fou ou cavalier. Le plus souvent c’est la dame… sauf quand un cavalier donne échec avec une fourchette, ou qu’une dame ferait pat.',
    demo: {
      fen: '8/4RP1k/1p4qp/p4r2/8/4r1P1/1P1R1PK1/8 w - - 0 45',
      line: ['f7f8n', 'h7g8', 'f8g6'],
      title: 'f8=C+ !',
      text: 'Le pion devient cavalier avec échec, et ce cavalier attaque aussi la dame g6. Après Rg8, Cxg6 gagne la dame.',
    },
    theme: 'underPromotion',
  }),
  {
    id: 'early-queen',
    title: 'Punir la dame trop tôt',
    icon: '👸',
    summary: 'Développer en gagnant du temps.',
    steps: [
      {
        type: 'theory',
        title: 'Chaque attaque sur la dame = un temps gagné',
        text: 'Une dame sortie très tôt est une cible : chaque pièce que tu développes en l’attaquant te fait gagner un temps. Mais attention, elle a souvent une menace (sur f7, sur e5) : pare-la d’abord.',
        fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
        arrows: [['h5', 'e5', 'red']],
      },
      {
        type: 'quiz',
        fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
        question: 'La dame blanche attaque e5. Quel coup est le meilleur ?',
        options: ['b8c6', 'g7g6', 'a7a6', 'e8e7'],
        answer: 0,
        explain: 'Cc6 défend e5 en développant. g6 ?? perd la tour h8 après Dxe5+ (fourchette roi et tour), a6 ignore la menace et laisse prendre e5 avec échec, et Re7 ?? enferme le roi et perd.',
      },
      { type: 'puzzles', title: 'Punir les erreurs d’ouverture', theme: 'opening', count: 3, mode: 'practice' },
    ],
  },
];
