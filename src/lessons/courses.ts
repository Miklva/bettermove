import { ENDGAME_ADVANCED, KING_ADVANCED, OPENING_REFLEXES_ADVANCED, TACTICS_ADVANCED } from './advanced';
import { BLACK_OPENINGS, WHITE_OPENINGS } from './openings';
import { INITIATION } from './initiation';

// Contenu des cours. Positions, lignes, quiz et defis ont ete verifies avec Stockfish lors de la redaction :
// pense a reverifier toute nouvelle position (legalite, et pour un quiz que la bonne reponse est nettement la meilleure).

export type Brush = 'green' | 'red' | 'blue' | 'yellow';

export type Step =
  | {
      type: 'theory';
      title: string;
      text: string;
      fen?: string;
      arrows?: [string, string, Brush][];
      circles?: [string, Brush][];
      /** Coups UCI rejoues automatiquement pour illustrer */
      line?: string[];
    }
  | {
      type: 'quiz';
      fen: string;
      question: string;
      /** Coups proposes en UCI (affiches en notation algebrique) */
      options: string[];
      answer: number;
      explain: string;
    }
  | {
      type: 'puzzles';
      title: string;
      theme: string;
      count: number;
      /** guided : problemes faciles avec le theme rappele ; practice : a ton niveau */
      mode: 'guided' | 'practice';
    }
  | {
      /** Deplacer une piece seule pour prendre toutes les cibles (initiation) */
      type: 'collect';
      title: string;
      text: string;
      /** Piece blanche : R B Q N K P */
      piece: 'R' | 'B' | 'Q' | 'N' | 'K' | 'P';
      start: string;
      /** Pions noirs a prendre */
      targets: string[];
      /** Pions blancs qui bloquent le passage */
      blockers?: string[];
      tips?: string[];
    }
  | {
      /** Question a choix (texte), avec un plateau d'illustration facultatif */
      type: 'choice';
      question: string;
      options: string[];
      answer: number;
      explain: string;
      fen?: string;
      circles?: [string, Brush][];
      arrows?: [string, string, Brush][];
    }
  | {
      type: 'goal';
      title: string;
      text: string;
      fen: string;
      /** hold : tenir maxMoves coups sans perdre (defense) */
      goal: 'mate' | 'promote' | 'capturePawns' | 'hold';
      /** Nombre maximum de coups pour atteindre l'objectif */
      maxMoves: number;
      tips: string[];
    };

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  summary: string;
  steps: Step[];
}

export interface Chapter {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  lessons: Lesson[];
  /** Approfondissement : debloque avec 3 etoiles sur toutes les lecons de la section */
  advanced?: Lesson[];
}

const BASE_CHAPTERS: Chapter[] = [
  {
    id: 'tactics',
    title: 'Les armes tactiques',
    icon: '⚔️',
    color: '#8bd450',
    description: 'Les motifs qui gagnent du matériel. La base de 90 % des parties gagnées à ton niveau.',
    lessons: [
      {
        id: 'fork',
        title: 'La fourchette',
        icon: '🍴',
        summary: 'Attaquer deux cibles d’un seul coup.',
        steps: [
          {
            type: 'theory',
            title: 'Deux cibles, un seul coup',
            text: 'Une fourchette, c’est une pièce qui attaque deux pièces adverses en même temps. L’adversaire ne peut en sauver qu’une : tu gagnes l’autre. Ici, le cavalier en c7 attaque le roi ET la tour : c’est une « fourchette royale ». Les Noirs doivent bouger le roi, et la tour tombe.',
            fen: 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1',
            arrows: [
              ['c7', 'e8', 'red'],
              ['c7', 'a8', 'red'],
            ],
          },
          {
            type: 'theory',
            title: 'Toutes les pièces peuvent fourchetter',
            text: 'Le cavalier est le roi de la fourchette, mais toutes les pièces en font. Même un simple pion : ici, e5 attaque à la fois le cavalier et le fou. Les meilleures cibles sont le roi (échec), la dame, et les pièces non défendues.',
            fen: '4k3/8/3n1b2/4P3/8/8/8/4K3 b - - 0 1',
            arrows: [
              ['e5', 'd6', 'red'],
              ['e5', 'f6', 'red'],
            ],
          },
          {
            type: 'theory',
            title: 'Le réflexe à prendre',
            text: 'À chaque coup, repère les pièces adverses mal protégées et le roi. Puis demande-toi : « Existe-t-il une case d’où une de mes pièces attaquerait deux de ces cibles ? » Un échec qui attaque aussi une pièce est la fourchette la plus fréquente.',
          },
          { type: 'puzzles', title: 'Fourchettes guidées', theme: 'fork', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'fork', count: 4, mode: 'practice' },
        ],
      },
      {
        id: 'pin',
        title: 'Le clouage',
        icon: '📌',
        summary: 'Immobiliser une pièce devant une plus précieuse.',
        steps: [
          {
            type: 'theory',
            title: 'Le clouage absolu',
            text: 'Le fou b5 attaque le cavalier c6, et derrière lui se trouve le roi. Le cavalier n’a pas le droit de bouger : il exposerait son roi. On dit qu’il est cloué. Une pièce clouée ne défend plus vraiment rien.',
            fen: '4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1',
            arrows: [['b5', 'e8', 'red']],
            circles: [['c6', 'yellow']],
          },
          {
            type: 'theory',
            title: 'Le clouage relatif',
            text: 'Ici la tour cloue le cavalier d5 sur la dame d8. Le cavalier PEUT bouger, mais alors la dame est prise. Contre une pièce clouée, la meilleure idée est souvent de l’attaquer encore une fois (avec un pion par exemple) : elle ne peut pas fuir.',
            fen: '3qk3/8/8/3n4/8/8/8/3RK3 w - - 0 1',
            arrows: [['d1', 'd8', 'red']],
            circles: [['d5', 'yellow']],
          },
          { type: 'puzzles', title: 'Clouages guidés', theme: 'pin', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'pin', count: 4, mode: 'practice' },
        ],
      },
      {
        id: 'skewer',
        title: 'L’enfilade',
        icon: '🍢',
        summary: 'Le clouage à l’envers : la grosse pièce doit fuir.',
        steps: [
          {
            type: 'theory',
            title: 'La pièce précieuse devant',
            text: 'Dans une enfilade, c’est la pièce la plus précieuse qui est devant. Le fou fait échec au roi d5 : le roi doit s’écarter, et la dame b7 cachée derrière tombe.',
            fen: '8/1q6/8/3k4/8/5B2/8/4K3 b - - 0 1',
            arrows: [
              ['f3', 'd5', 'red'],
              ['d5', 'b7', 'yellow'],
            ],
          },
          {
            type: 'theory',
            title: 'Sur une rangée',
            text: 'Même idée avec une tour : échec sur la 4e rangée, le roi s’écarte et la dame h4 est perdue. Les enfilades arrivent surtout quand le roi et la dame sont alignés : méfie-toi toujours de cet alignement !',
            fen: '8/8/8/8/R2k3q/8/8/K7 b - - 0 1',
            arrows: [
              ['a4', 'd4', 'red'],
              ['d4', 'h4', 'yellow'],
            ],
          },
          { type: 'puzzles', title: 'Enfilades guidées', theme: 'skewer', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'skewer', count: 4, mode: 'practice' },
        ],
      },
      {
        id: 'discovered',
        title: 'L’attaque à la découverte',
        icon: '🎭',
        summary: 'Bouger une pièce pour en démasquer une autre.',
        steps: [
          {
            type: 'theory',
            title: 'Deux menaces en un coup',
            text: 'Le cavalier e4 cache la tour e1. S’il bouge, la tour fait échec au roi : c’est un échec à la découverte. Et le cavalier en profite pour prendre la dame f6 ! Les Noirs doivent parer l’échec : la dame est perdue. Regarde la suite.',
            fen: '4k3/8/5q2/8/4N3/8/8/4R1K1 w - - 0 1',
            arrows: [
              ['e4', 'f6', 'green'],
              ['e1', 'e8', 'red'],
            ],
            line: ['e4f6'],
          },
          {
            type: 'theory',
            title: 'Le cas spécial : l’échec double',
            text: 'Dans l’exemple, le cavalier en f6 fait AUSSI échec : deux pièces donnent échec en même temps. Contre un échec double, on ne peut ni prendre ni s’interposer : seul le roi peut bouger. C’est l’arme la plus puissante des échecs.',
          },
          { type: 'puzzles', title: 'Découvertes guidées', theme: 'discoveredAttack', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'discoveredAttack', count: 4, mode: 'practice' },
        ],
      },
      {
        id: 'hanging',
        title: 'Les pièces en prise',
        icon: '🎁',
        summary: 'Ne rien laisser traîner, tout ramasser.',
        steps: [
          {
            type: 'theory',
            title: 'Compte les attaquants et les défenseurs',
            text: 'Une pièce est en prise quand elle est attaquée plus de fois qu’elle n’est défendue (ou attaquée par une pièce de moindre valeur). Avant chaque coup, deux questions : « Qu’est-ce que mon adversaire vient de laisser sans défense ? » et « Qu’est-ce que MON coup laisse sans défense ? ». La plupart des parties sous 1500 se décident là.',
          },
          {
            type: 'theory',
            title: 'Les valeurs des pièces',
            text: 'Pion = 1, cavalier = 3, fou = 3, tour = 5, dame = 9. Le roi est inestimable. Échanger une pièce contre une plus forte est un gain ; prendre un pion défendu avec ta dame, c’est perdre 8 points.',
          },
          { type: 'puzzles', title: 'Ramasse le matériel', theme: 'hangingPiece', count: 4, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'hangingPiece', count: 3, mode: 'practice' },
        ],
      },
    ],
  },
  {
    id: 'king',
    title: 'Le roi en danger',
    icon: '👑',
    color: '#f2c14e',
    description: 'Les mats à connaître par cœur et l’art de finir une partie.',
    lessons: [
      {
        id: 'mate1',
        title: 'Mat en 1',
        icon: '🎯',
        summary: 'Voir le mat quand il est là.',
        steps: [
          {
            type: 'theory',
            title: 'Échecs, prises, menaces',
            text: 'Pour trouver un mat, passe en revue TOUS tes échecs, même ceux qui semblent absurdes (comme sacrifier ta dame). Pour chacun, regarde : le roi peut-il fuir, prendre la pièce, ou s’interposer ? Si la réponse est non trois fois : c’est mat.',
          },
          { type: 'puzzles', title: 'Mats en 1 faciles', theme: 'mateIn1', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'mateIn1', count: 4, mode: 'practice' },
        ],
      },
      {
        id: 'backrank',
        title: 'Le mat du couloir',
        icon: '🚪',
        summary: 'Le roi prisonnier de ses propres pions.',
        steps: [
          {
            type: 'theory',
            title: 'Enfermé chez lui',
            text: 'Le roi g8 est roqué derrière ses pions f7, g7, h7. Ils le protègent… mais l’empêchent aussi de fuir. Une tour (ou une dame) sur la 8e rangée, et c’est mat : Te8#.',
            fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
            arrows: [['e1', 'e8', 'red']],
            line: ['e1e8'],
          },
          {
            type: 'theory',
            title: 'La parade : faire une « fenêtre »',
            text: 'Pour éviter ce mat, on joue tôt ou tard h6 (ou h3 avec les Blancs) : le roi gagne une case de fuite. Ici, après Te8+ le roi va simplement en h7. Pense à ton propre roi aussi !',
            fen: '6k1/5pp1/7p/8/8/8/8/4R1K1 w - - 0 1',
            arrows: [
              ['e1', 'e8', 'red'],
              ['g8', 'h7', 'green'],
            ],
          },
          { type: 'puzzles', title: 'Mats du couloir', theme: 'backRankMate', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'backRankMate', count: 4, mode: 'practice' },
        ],
      },
      {
        id: 'mate2',
        title: 'Mat en 2',
        icon: '🧠',
        summary: 'Calculer deux coups à l’avance.',
        steps: [
          {
            type: 'theory',
            title: 'Un coup forcé, puis le mat',
            text: 'Un mat en 2 commence presque toujours par un coup qui ne laisse pas le choix à l’adversaire : un échec, une prise, ou un sacrifice. Cherche le coup qui force sa réponse, puis vérifie que tu as bien un mat derrière, quelle que soit sa défense.',
          },
          { type: 'puzzles', title: 'Mats en 2 faciles', theme: 'mateIn2', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'mateIn2', count: 4, mode: 'practice' },
        ],
      },
      {
        id: 'smothered',
        title: 'Le mat à l’étouffée',
        icon: '🐴',
        summary: 'Le plus beau mat du cavalier.',
        steps: [
          {
            type: 'theory',
            title: 'Étouffé par ses propres pièces',
            text: 'Le roi h8 est entouré par sa tour g8 et ses pions g7 et h7. Il n’a aucune case. Le cavalier saute en f7 : échec, et rien ne peut l’arrêter. C’est mat !',
            fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
            arrows: [['g5', 'f7', 'green']],
            line: ['g5f7'],
          },
          { type: 'puzzles', title: 'À toi d’étouffer', theme: 'smotheredMate', count: 3, mode: 'guided' },
        ],
      },
      {
        id: 'sacrifice',
        title: 'Le sacrifice',
        icon: '🔥',
        summary: 'Donner pour mieux reprendre.',
        steps: [
          {
            type: 'theory',
            title: 'Le matériel n’est qu’un moyen',
            text: 'Sacrifier, c’est donner du matériel volontairement pour obtenir plus : un mat, une attaque imparable, ou plus de matériel ensuite. Un sacrifice doit être calculé : après « il prend », qu’est-ce que je joue, et est-ce vraiment gagnant ?',
          },
          {
            type: 'theory',
            title: 'Les sacrifices typiques',
            text: 'Sacrifice d’attraction (attirer le roi sur une case mortelle), de déviation (éloigner un défenseur), ou de démolition (casser l’abri du roi). Dans les problèmes qui suivent, n’aie pas peur de donner une pièce.',
          },
          { type: 'puzzles', title: 'Sacrifices guidés', theme: 'sacrifice', count: 3, mode: 'guided' },
          { type: 'puzzles', title: 'À ton niveau', theme: 'sacrifice', count: 4, mode: 'practice' },
        ],
      },
    ],
  },
  {
    id: 'endgames',
    title: 'Finales essentielles',
    icon: '🏁',
    color: '#78a6ff',
    description: 'Savoir convertir un avantage en victoire. Contre Stockfish, sans filet.',
    lessons: [
      {
        id: 'kq',
        title: 'Mat roi + dame',
        icon: '♛',
        summary: 'Le mat de base, à connaître les yeux fermés.',
        steps: [
          {
            type: 'theory',
            title: 'Rétrécir la boîte',
            text: 'Place ta dame à un saut de cavalier du roi adverse : elle l’enferme dans une « boîte ». À chaque coup, rétrécis la boîte. Quand le roi est sur le bord, amène TON roi pour aider. Attention au pat : laisse toujours au moins une case au roi adverse tant que tu ne fais pas échec.',
            fen: '8/8/8/3k4/8/2Q5/8/4K3 b - - 0 1',
            circles: [
              ['d5', 'red'],
              ['c3', 'green'],
            ],
          },
          {
            type: 'goal',
            title: 'Défi : mate Stockfish',
            text: 'Mate le roi noir en 20 coups maximum. Stockfish défend parfaitement.',
            fen: '8/8/8/3k4/8/8/8/2Q1K3 w - - 0 1',
            goal: 'mate',
            maxMoves: 20,
            tips: ['Dame à un saut de cavalier du roi.', 'Amène ton roi quand l’autre est au bord.', 'Gare au pat !'],
          },
        ],
      },
      {
        id: 'kr',
        title: 'Mat roi + tour',
        icon: '♜',
        summary: 'Plus long, mais tout aussi incontournable.',
        steps: [
          {
            type: 'theory',
            title: 'Couper le roi',
            text: 'La tour coupe le roi adverse sur une rangée ou une colonne. Ton roi s’approche en « opposition » (face au roi adverse, une case entre eux). À ce moment, un échec de la tour repousse le roi d’une rangée. On recommence jusqu’au bord, puis mat.',
            fen: '8/8/3k4/8/3K4/8/8/7R w - - 0 1',
            arrows: [['h1', 'h5', 'green']],
            circles: [
              ['d4', 'blue'],
              ['d6', 'red'],
            ],
          },
          {
            type: 'goal',
            title: 'Défi : mate Stockfish',
            text: 'Mate le roi noir en 30 coups maximum avec ta tour.',
            fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
            goal: 'mate',
            maxMoves: 30,
            tips: ['Coupe le roi avec la tour.', 'Mets ton roi en opposition, puis échec.', 'Si la tour est attaquée, éloigne-la sur la même ligne.'],
          },
        ],
      },
      {
        id: 'square',
        title: 'La règle du carré',
        icon: '⬛',
        summary: 'Savoir d’un coup d’œil si ton roi rattrape le pion.',
        steps: [
          {
            type: 'theory',
            title: 'Le carré du pion',
            text: 'Trace un carré entre le pion et sa case de promotion. Ici le pion a5 doit aller en a1 : le carré va de a5 à e1. Si ton roi peut entrer dans ce carré à son coup, il rattrape le pion. Sinon, le pion fait dame.',
            fen: '8/8/8/p7/5K2/8/8/7k w - - 0 1',
            arrows: [
              ['a5', 'a1', 'red'],
              ['a5', 'e5', 'yellow'],
              ['e5', 'e1', 'yellow'],
            ],
          },
          {
            type: 'goal',
            title: 'Défi : rattrape le pion',
            text: 'Prends le pion noir avant qu’il ne fasse dame. Un seul mauvais pas et c’est trop tard !',
            fen: '8/8/8/p7/5K2/8/8/7k w - - 0 1',
            goal: 'capturePawns',
            maxMoves: 10,
            tips: ['Entre dans le carré dès le premier coup.', 'Le roi avance en diagonale aussi vite qu’en ligne droite.'],
          },
        ],
      },
      {
        id: 'opposition',
        title: 'L’opposition',
        icon: '🤺',
        summary: 'La clé des finales de pions.',
        steps: [
          {
            type: 'theory',
            title: 'Face à face',
            text: 'Deux rois face à face avec une case entre eux : celui qui N’EST PAS au trait « a l’opposition ». L’autre doit céder le passage. Dans les finales roi + pion contre roi, le camp fort gagne si son roi passe DEVANT son pion, en gagnant l’opposition.',
            fen: '8/8/3k4/8/3K4/8/3P4/8 b - - 0 1',
            circles: [
              ['d4', 'green'],
              ['d6', 'red'],
            ],
          },
          {
            type: 'theory',
            title: 'Le roi devant le pion',
            text: 'Règle d’or : avance d’abord le roi, le pion après. Le pion sert de réserve de temps : un petit coup de pion peut te redonner l’opposition au bon moment.',
          },
          {
            type: 'goal',
            title: 'Défi : fais dame',
            text: 'Amène ton pion à la promotion contre Stockfish. Indice : la position est gagnante seulement si ton roi prend les devants tout de suite.',
            fen: '8/8/3k4/8/8/3K4/3P4/8 w - - 0 1',
            goal: 'promote',
            maxMoves: 20,
            tips: ['Roi devant le pion !', 'Prends l’opposition.', 'Garde le coup de pion en réserve.'],
          },
          {
            type: 'goal',
            title: 'Défi bonus : un seul coup gagne',
            text: 'Même idée, mais ici un seul premier coup gagne. Les autres annulent.',
            fen: '8/8/8/3k4/8/8/3PK3/8 w - - 0 1',
            goal: 'promote',
            maxMoves: 20,
            tips: ['Le roi doit se placer devant le pion, au plus vite.'],
          },
        ],
      },
    ],
  },
  {
    id: 'openings',
    title: 'Ouvertures : les bons réflexes',
    icon: '📖',
    color: '#d1826b',
    description: 'Pas besoin de réciter des variantes : des principes et quelques pièges.',
    lessons: [
      {
        id: 'center',
        title: 'Le centre',
        icon: '🎯',
        summary: 'Occuper et contrôler les cases centrales.',
        steps: [
          {
            type: 'theory',
            title: 'Pourquoi le centre ?',
            text: 'Les cases d4, e4, d5, e5 sont le carrefour de l’échiquier : une pièce au centre contrôle beaucoup plus de cases qu’au bord. Les pions centraux prennent de la place et ouvrent la route à tes pièces.',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            circles: [
              ['d4', 'green'],
              ['e4', 'green'],
              ['d5', 'green'],
              ['e5', 'green'],
            ],
          },
          {
            type: 'quiz',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            question: 'Quel premier coup prend le plus de place au centre ?',
            options: ['e2e4', 'g2g4', 'f2f3', 'g1h3'],
            answer: 0,
            explain: 'e4 occupe le centre, contrôle d5 et f5, et libère la dame et le fou f1. g4 et f3 affaiblissent ton roi, Ch3 envoie le cavalier au bord.',
          },
          {
            type: 'quiz',
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
            question: 'Quel coup développe une pièce en attaquant quelque chose ?',
            options: ['g1f3', 'b1a3', 'f1a6', 'e1e2'],
            answer: 0,
            explain: 'Cf3 développe le cavalier vers le centre et attaque le pion e5. Ca3 met le cavalier au bord, Fa6 perd le fou (bxa6) et Re2 bloque ton fou et ta dame.',
          },
          {
            type: 'quiz',
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
            question: 'Les Noirs doivent défendre le pion e5. Quel coup est une erreur ?',
            options: ['b8c6', 'd7d6', 'f7f6', 'g8f6'],
            answer: 2,
            explain: 'f6 ?! affaiblit le roi (diagonale h5-e8) et ôte la meilleure case du cavalier. Après Cxe5 !, si fxe5 alors Dh5+ est très fort. Cc6, d6 et Cf6 sont tous de bons coups.',
          },
        ],
      },
      {
        id: 'develop',
        title: 'Développement et roque',
        icon: '🏰',
        summary: 'Sortir ses pièces et mettre le roi à l’abri.',
        steps: [
          {
            type: 'theory',
            title: 'Les 3 règles d’or',
            text: '1. Sors tes cavaliers et tes fous avant la dame et les tours. 2. Ne joue pas deux fois la même pièce sans raison. 3. Roque tôt : le roi est en sécurité et ta tour entre en jeu.',
          },
          {
            type: 'quiz',
            fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
            question: 'Quel coup développe une nouvelle pièce vers le centre ?',
            options: ['f1c4', 'h2h4', 'h1g1', 'b1a3'],
            answer: 0,
            explain: 'Fc4 sort le fou sur une belle diagonale qui vise f7, le point faible des Noirs. h4 et Tg1 ne développent rien, et « un cavalier au bord est un cavalier mort » : Ca3 est passif.',
          },
          {
            type: 'quiz',
            fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
            question: 'Ton roi est encore au centre. Que joues-tu ?',
            options: ['e1g1', 'e1f1', 'h1g1', 'g2g4'],
            answer: 0,
            explain: 'O-O met le roi à l’abri derrière ses pions et active la tour. Rf1 fait perdre le droit de roquer, Tg1 aussi (côté roi), et g4 ouvre ton propre roi au lieu de l’abriter.',
          },
        ],
      },
      {
        id: 'traps',
        title: 'Les pièges classiques',
        icon: '🪤',
        summary: 'Ne plus jamais tomber dedans (et les tendre).',
        steps: [
          {
            type: 'theory',
            title: 'Le coup du berger',
            text: 'La dame h5 et le fou c4 visent f7, défendu seulement par le roi. Si les Noirs ne font rien, Dxf7 est mat. Regarde.',
            fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
            arrows: [
              ['h5', 'f7', 'red'],
              ['c4', 'f7', 'red'],
            ],
            line: ['g8f6', 'h5f7'],
          },
          {
            type: 'quiz',
            fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
            question: 'À toi de défendre : quel coup pare le mat ?',
            options: ['g7g6', 'g8f6', 'a7a6', 'd7d6'],
            answer: 0,
            explain: 'g6 ferme la route de la dame vers f7 et l’attaque en même temps. Cf6 ?? semble développer mais laisse Dxf7#, comme a6 et d6. (De7 était aussi possible.)',
          },
          {
            type: 'theory',
            title: 'Le piège de Légal',
            text: 'Un piège vieux de 270 ans. Les Noirs clouent le cavalier f3 sur la dame… mais Cxe5 ! sacrifie la dame. Si Fxd1 ??, alors Fxf7+ Re7 et Cd5 est mat. Regarde la partie.',
            fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
            line: ['f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'],
          },
          { type: 'puzzles', title: 'Pièges d’ouverture', theme: 'opening', count: 4, mode: 'guided' },
        ],
      },
    ],
  },
];

// Approfondissements (niveau 2) et sections d'ouvertures
const ADVANCED: Record<string, Lesson[]> = {
  tactics: TACTICS_ADVANCED,
  king: KING_ADVANCED,
  endgames: ENDGAME_ADVANCED,
  openings: OPENING_REFLEXES_ADVANCED,
};
for (const c of BASE_CHAPTERS) c.advanced = ADVANCED[c.id];

export const CHAPTERS: Chapter[] = [INITIATION, ...BASE_CHAPTERS, WHITE_OPENINGS, BLACK_OPENINGS];

export const ALL_LESSONS = CHAPTERS.flatMap((c) => [...c.lessons, ...(c.advanced ?? [])].map((l) => ({ ...l, chapter: c })));

/** L'approfondissement est debloque quand toutes les lecons de base ont 3 etoiles */
export function advancedUnlocked(c: Chapter, stars: Record<string, { stars: number }>): boolean {
  return c.lessons.every((l) => (stars[l.id]?.stars ?? 0) >= 3);
}
