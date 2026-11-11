// Guides : reponses aux questions que se posent les joueurs (lisibles dans l'app et par les moteurs de recherche).

export interface Article {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: { h2: string; paragraphs: string[]; list?: string[] }[];
  cta: { label: string; path: string };
}

export const ARTICLES: Article[] = [
  {
    slug: 'comment-apprendre-les-echecs',
    title: 'Comment apprendre les échecs quand on débute ? Le guide complet',
    description:
      'Par où commencer aux échecs : les règles, les premières tactiques, combien de temps s’entraîner et les erreurs de débutant à éviter.',
    h1: 'Comment apprendre les échecs quand on débute ?',
    intro:
      'Apprendre les échecs ne demande ni don particulier ni des heures par jour. Avec une méthode simple et 15 à 20 minutes régulières, on progresse vite. Voici dans quel ordre s’y prendre.',
    sections: [
      {
        h2: '1. Connaître parfaitement les règles',
        paragraphs: [
          'Avant tout, il faut savoir comment se déplace chaque pièce, ce qu’est l’échec et mat, et connaître les trois coups spéciaux : le roque, la prise en passant et la promotion. Beaucoup de débutants perdent des parties simplement parce qu’ils ignorent une règle.',
          'Comptez une ou deux séances pour être à l’aise. Ensuite, jouez quelques parties lentes pour que les règles deviennent des réflexes.',
        ],
      },
      {
        h2: '2. Apprendre trois principes d’ouverture',
        paragraphs: ['Inutile d’apprendre des ouvertures par cœur au début. Trois principes suffisent à obtenir une bonne position :'],
        list: [
          'Occuper le centre avec un pion (e4 ou d4).',
          'Sortir les cavaliers et les fous avant de jouer la dame.',
          'Roquer tôt pour mettre le roi à l’abri.',
        ],
      },
      {
        h2: '3. Travailler la tactique tous les jours',
        paragraphs: [
          'À tous les niveaux jusqu’à environ 1500 Elo, la grande majorité des parties se décident sur une erreur tactique : une pièce laissée sans défense, une fourchette ratée, un mat raté. Résoudre quelques problèmes chaque jour est l’entraînement le plus rentable.',
          'Commencez par les motifs de base : la fourchette, le clouage, l’enfilade et l’attaque à la découverte.',
        ],
      },
      {
        h2: '4. Jouer, puis analyser ses parties',
        paragraphs: [
          'Jouer est indispensable, mais c’est l’analyse qui fait progresser. Après chaque partie, cherchez le moment où elle a basculé. Un moteur comme Stockfish montre l’erreur ; le plus important est de comprendre pourquoi vous l’avez faite.',
        ],
      },
      {
        h2: 'Les erreurs de débutant à éviter',
        paragraphs: [],
        list: [
          'Sortir la dame trop tôt : elle se fait chasser et vous perdez du temps.',
          'Jouer sans regarder ce que menace l’adversaire après son dernier coup.',
          'Oublier de roquer et laisser le roi au centre.',
          'Enchaîner les parties rapides sans jamais les revoir.',
        ],
      },
    ],
    cta: { label: 'Commencer l’initiation gratuite', path: '/apprendre/cours' },
  },
  {
    slug: 'regles-des-echecs',
    title: 'Les règles des échecs expliquées simplement (roque, prise en passant, pat)',
    description:
      'Toutes les règles du jeu d’échecs : déplacement des pièces, échec et mat, roque, prise en passant, promotion, pat et parties nulles.',
    h1: 'Les règles des échecs expliquées simplement',
    intro:
      'Les échecs se jouent à deux sur un plateau de 64 cases. Chaque joueur dispose de 16 pièces et le but est de mettre le roi adverse échec et mat. Voici toutes les règles, y compris celles que beaucoup oublient.',
    sections: [
      {
        h2: 'La mise en place',
        paragraphs: [
          'Le plateau se place avec une case claire en bas à droite. Les tours occupent les coins, puis viennent les cavaliers, les fous, et au centre la dame et le roi. La dame se place sur sa couleur : la dame blanche sur une case claire, la dame noire sur une case foncée. Les Blancs jouent toujours le premier coup.',
        ],
      },
      {
        h2: 'Le déplacement des pièces',
        paragraphs: [],
        list: [
          'Le roi : une case dans n’importe quelle direction.',
          'La dame : autant de cases qu’elle veut, en ligne droite ou en diagonale.',
          'La tour : en ligne droite, horizontalement ou verticalement.',
          'Le fou : en diagonale, il reste toujours sur la même couleur.',
          'Le cavalier : en L (deux cases puis une sur le côté), c’est la seule pièce qui saute par-dessus les autres.',
          'Le pion : avance d’une case (ou deux depuis sa case de départ) et prend en diagonale.',
        ],
      },
      {
        h2: 'Échec, échec et mat et pat',
        paragraphs: [
          'Un roi attaqué est en échec : il doit immédiatement s’en sortir en se déplaçant, en interposant une pièce ou en prenant l’attaquant. S’il ne le peut pas, il est échec et mat et la partie est perdue.',
          'Le pat est différent : le joueur qui doit jouer n’est pas en échec mais n’a aucun coup légal. La partie est alors nulle, même avec un énorme avantage matériel.',
        ],
      },
      {
        h2: 'Les trois coups spéciaux',
        paragraphs: [
          'Le roque : le roi se déplace de deux cases vers une tour, qui passe de l’autre côté de lui. Il est interdit si le roi ou la tour ont déjà bougé, si le roi est en échec, ou s’il traverse ou atteint une case attaquée.',
          'La prise en passant : quand un pion avance de deux cases et arrive à côté d’un pion adverse, celui-ci peut le prendre comme s’il n’avait avancé que d’une case, mais uniquement au coup suivant.',
          'La promotion : un pion qui atteint la dernière rangée se transforme en dame, tour, fou ou cavalier, au choix.',
        ],
      },
      {
        h2: 'Les parties nulles',
        paragraphs: ['Une partie peut aussi se terminer par une nulle :'],
        list: [
          'Par pat.',
          'Par accord entre les deux joueurs.',
          'Par répétition de la même position trois fois.',
          'Par la règle des 50 coups sans prise ni mouvement de pion.',
          'Quand il ne reste pas assez de matériel pour mater (par exemple roi contre roi).',
        ],
      },
    ],
    cta: { label: 'Apprendre les règles en jouant', path: '/apprendre/cours' },
  },
  {
    slug: 'comment-progresser-aux-echecs',
    title: 'Comment progresser aux échecs et gagner des points Elo',
    description:
      'Une méthode concrète pour monter en Elo : tactique quotidienne, parties lentes, analyse des erreurs et travail des finales.',
    h1: 'Comment progresser aux échecs et gagner des points Elo ?',
    intro:
      'Vous jouez régulièrement mais votre classement stagne ? C’est très courant. Progresser demande surtout de jouer moins vite, de travailler ses points faibles et de comprendre ses propres erreurs.',
    sections: [
      {
        h2: 'Jouer des parties plus lentes',
        paragraphs: [
          'Les parties de 1 à 3 minutes sont amusantes, mais on y apprend peu : il n’y a pas le temps de réfléchir. Une cadence de 10 minutes ou plus laisse le temps de vérifier chaque coup, et c’est ce réflexe qui fait gagner des points.',
        ],
      },
      {
        h2: 'Vérifier avant chaque coup',
        paragraphs: ['Avant de jouer, posez-vous trois questions, toujours dans le même ordre :'],
        list: [
          'Qu’est-ce que mon adversaire menace avec son dernier coup ?',
          'Ai-je un échec, une prise ou une menace forte à jouer ?',
          'Après mon coup, une de mes pièces reste-t-elle sans défense ?',
        ],
      },
      {
        h2: 'Résoudre des problèmes chaque jour',
        paragraphs: [
          'Dix à quinze problèmes par jour entraînent l’œil à reconnaître les motifs tactiques. Mieux vaut un peu tous les jours qu’une longue séance par semaine. Choisissez des problèmes à votre niveau : trop durs, on se décourage ; trop faciles, on n’apprend rien.',
        ],
      },
      {
        h2: 'Analyser ses propres erreurs',
        paragraphs: [
          'Vos défaites contiennent vos meilleurs exercices. Repérez les erreurs qui reviennent : pièces laissées en prise, roi resté au centre, finales mal jouées. Travailler précisément ces points fait progresser bien plus vite que des cours généraux.',
        ],
      },
      {
        h2: 'Apprendre les finales de base',
        paragraphs: [
          'Savoir mater avec une dame ou une tour, et connaître la règle du carré dans les finales de pions, transforme des parties nulles ou perdues en victoires. Quelques heures suffisent pour les maîtriser.',
        ],
      },
    ],
    cta: { label: 'Découvrir le suivi personnalisé', path: '/progresser/suivi' },
  },
  {
    slug: 'meilleures-ouvertures-debutant',
    title: 'Quelles ouvertures d’échecs choisir quand on débute ?',
    description:
      'Les meilleures ouvertures pour débutants avec les Blancs et les Noirs : partie italienne, système de Londres, défense française, Caro-Kann.',
    h1: 'Quelles ouvertures choisir quand on débute aux échecs ?',
    intro:
      'Une bonne ouverture pour débutant n’est pas la plus compliquée : c’est celle qui respecte les principes simples (centre, développement, roque) et dont on comprend les idées. En voici quelques-unes, faciles à prendre en main.',
    sections: [
      {
        h2: 'Avec les Blancs : la partie italienne',
        paragraphs: [
          'Après 1.e4 e5 2.Cf3 Cc6 3.Fc4, les Blancs occupent le centre, développent deux pièces et visent le point faible f7. Le roque arrive très vite. C’est une ouverture idéale pour apprendre les principes.',
        ],
      },
      {
        h2: 'Avec les Blancs : le système de Londres',
        paragraphs: [
          'Avec d4, Ff4, e3, Cf3 et c3, les Blancs construisent presque toujours la même structure solide, quelle que soit la réponse adverse. Peu de théorie à apprendre : on se concentre sur le milieu de partie.',
        ],
      },
      {
        h2: 'Avec les Noirs contre 1.e4',
        paragraphs: [
          'Répondre 1...e5 mène à des positions classiques et ouvertes. Pour un jeu plus solide, la défense Caro-Kann (1...c6) et la défense française (1...e6) donnent des structures de pions faciles à comprendre.',
        ],
      },
      {
        h2: 'Avec les Noirs contre 1.d4',
        paragraphs: [
          'Le gambit dame refusé (1.d4 d5 2.c4 e6) est une valeur sûre, jouée à tous les niveaux. Il apprend à défendre le centre et à libérer son jeu au bon moment.',
        ],
      },
      {
        h2: 'Comprendre plutôt que réciter',
        paragraphs: [
          'Apprendre 15 coups par cœur ne sert à rien si l’adversaire sort de la théorie au 4e coup. Retenez les idées : où vont les pièces, quels pions pousser, où placer le roi. Puis révisez vos lignes régulièrement pour les garder en mémoire.',
        ],
      },
    ],
    cta: { label: 'Apprendre ses ouvertures', path: '/apprendre/repertoire' },
  },
  {
    slug: 'tactiques-aux-echecs',
    title: 'Les tactiques aux échecs à connaître : fourchette, clouage, enfilade',
    description:
      'Les motifs tactiques essentiels expliqués simplement : fourchette, clouage, enfilade, attaque à la découverte, double attaque et surcharge.',
    h1: 'Les tactiques aux échecs à connaître absolument',
    intro:
      'Une tactique est une courte suite de coups forcés qui gagne du matériel ou donne mat. Quelques motifs reviennent sans cesse : les reconnaître, c’est gagner beaucoup de parties.',
    sections: [
      {
        h2: 'La fourchette',
        paragraphs: [
          'Une pièce attaque deux cibles en même temps, et l’adversaire ne peut en sauver qu’une. Le cavalier est le roi de la fourchette, surtout quand il attaque le roi et la dame à la fois.',
        ],
      },
      {
        h2: 'Le clouage',
        paragraphs: [
          'Une pièce ne peut pas bouger, sinon elle découvre une pièce plus importante derrière elle. Quand c’est le roi qui est derrière, le clouage est absolu : la pièce clouée n’a pas le droit de bouger.',
        ],
      },
      {
        h2: 'L’enfilade',
        paragraphs: [
          'C’est un clouage à l’envers : on attaque une pièce importante, qui doit se déplacer, et on prend celle qui se trouvait derrière elle. Les tours, les fous et la dame sont les pièces de l’enfilade.',
        ],
      },
      {
        h2: 'L’attaque à la découverte',
        paragraphs: [
          'Une pièce se déplace et libère la ligne d’une autre pièce, qui attaque à son tour. Si la pièce qui bouge crée aussi une menace, l’adversaire doit faire face à deux attaques d’un coup. Quand la découverte donne échec, on parle d’échec à la découverte.',
        ],
      },
      {
        h2: 'La surcharge et la déviation',
        paragraphs: [
          'Une pièce défend deux choses à la fois : elle est surchargée. En l’obligeant à s’occuper de l’une, on gagne l’autre. La déviation consiste à attirer une pièce défensive loin de la case qu’elle protège.',
        ],
      },
      {
        h2: 'Comment les retenir',
        paragraphs: [
          'Le meilleur moyen est la répétition : résoudre des problèmes classés par thème, en commençant par la fourchette et le clouage, jusqu’à ce que le motif saute aux yeux en partie.',
        ],
      },
    ],
    cta: { label: 'S’entraîner sur des problèmes', path: '/apprendre/problemes' },
  },
  {
    slug: 'mats-a-connaitre',
    title: 'Les échecs et mats à connaître : berger, couloir, escalier',
    description:
      'Les mats classiques que tout joueur doit connaître : le coup du berger et comment s’en défendre, le mat du couloir, le mat de l’escalier.',
    h1: 'Les échecs et mats que tout joueur doit connaître',
    intro:
      'Certains schémas de mat reviennent dans des milliers de parties. Les connaître permet de les infliger… et surtout de ne pas les subir.',
    sections: [
      {
        h2: 'Le coup du berger',
        paragraphs: [
          'Après 1.e4 e5 2.Fc4 Cc6 3.Dh5 Cf6?? 4.Dxf7#, la dame soutenue par le fou mate sur f7, la case la plus faible des Noirs au début de la partie.',
          'Pour s’en défendre, il suffit de protéger f7 et de chasser la dame : 3...g6 ou 3...De7 tiennent sans problème, et la dame blanche sortie trop tôt devient une cible.',
        ],
      },
      {
        h2: 'Le mat du couloir',
        paragraphs: [
          'Le roi a roqué derrière ses pions, qui n’ont pas avancé. Une tour ou une dame arrive sur la dernière rangée et le roi, bloqué par ses propres pions, est mat. Pour l’éviter, on crée une case de fuite (« un trou ») en avançant un pion devant le roi au bon moment.',
        ],
      },
      {
        h2: 'Le mat de l’escalier',
        paragraphs: [
          'Deux tours (ou une tour et une dame) repoussent le roi rangée après rangée : l’une coupe le roi, l’autre donne échec, et ainsi de suite jusqu’au bord. C’est le premier mat à savoir faire quand on a beaucoup de matériel.',
        ],
      },
      {
        h2: 'Mater avec une dame ou une tour seule',
        paragraphs: [
          'Avec roi et dame contre roi, on réduit pas à pas l’espace du roi adverse jusqu’au bord, en faisant attention au pat. Avec une tour, la méthode est plus longue mais repose sur la même idée : couper le roi, puis rapprocher son propre roi.',
        ],
      },
    ],
    cta: { label: 'Apprendre les mats en jouant', path: '/apprendre/cours' },
  },
  {
    slug: 'analyser-ses-parties-d-echecs',
    title: 'Comment analyser ses parties d’échecs pour progresser',
    description:
      'Une méthode simple pour analyser ses parties d’échecs avec ou sans moteur, repérer ses erreurs récurrentes et en tirer des exercices.',
    h1: 'Comment analyser ses parties d’échecs ?',
    intro:
      'Analyser ses parties est le moyen le plus efficace de progresser, à condition de le faire avec méthode. L’objectif n’est pas de trouver tous les meilleurs coups, mais de comprendre ses propres erreurs.',
    sections: [
      {
        h2: 'D’abord sans moteur',
        paragraphs: [
          'Juste après la partie, rejouez-la de mémoire et notez les moments où vous avez hésité et ce que vous pensiez. C’est la partie la plus utile : elle montre vos raisonnements, pas seulement vos coups.',
        ],
      },
      {
        h2: 'Ensuite avec Stockfish',
        paragraphs: [
          'Le moteur indique les gaffes (pièces perdues, mats ratés) et les imprécisions. Ne vous arrêtez pas au meilleur coup proposé : demandez-vous ce qu’il menaçait et pourquoi vous ne l’avez pas vu.',
        ],
      },
      {
        h2: 'Repérer ce qui revient',
        paragraphs: ['Après une dizaine de parties analysées, des tendances apparaissent :'],
        list: [
          'Des pièces laissées sans défense.',
          'Des tactiques adverses non vues (souvent la fourchette de cavalier).',
          'Un roi resté trop longtemps au centre.',
          'Des finales gagnantes qui finissent nulles.',
        ],
      },
      {
        h2: 'Transformer ses erreurs en exercices',
        paragraphs: [
          'Reprenez les positions où vous vous êtes trompé et rejouez-les quelques jours plus tard, comme des problèmes. Revoir ses erreurs au bon moment ancre la bonne réaction pour la prochaine fois.',
        ],
      },
    ],
    cta: { label: 'Analyser mes parties', path: '/progresser/historique' },
  },
  {
    slug: 'classement-elo-echecs',
    title: 'Le classement Elo aux échecs expliqué simplement',
    description:
      'Comment fonctionne le classement Elo aux échecs, combien de points on gagne ou perd, et quel est le niveau d’un joueur selon son Elo.',
    h1: 'Le classement Elo aux échecs, comment ça marche ?',
    intro:
      'Le classement Elo, inventé par le physicien Arpad Elo, mesure la force d’un joueur par rapport aux autres. Il monte quand on gagne, baisse quand on perd, et l’écart avec l’adversaire décide du nombre de points en jeu.',
    sections: [
      {
        h2: 'Le principe',
        paragraphs: [
          'Avant chaque partie, la différence de classement donne une probabilité de victoire. Battre un joueur plus fort rapporte beaucoup de points ; perdre contre un joueur plus faible en coûte beaucoup. Gagner contre bien plus faible ne rapporte presque rien.',
        ],
      },
      {
        h2: 'Ordres de grandeur',
        paragraphs: ['Les chiffres varient selon les sites et les fédérations, mais on peut retenir :'],
        list: [
          'Moins de 1000 : débutant qui découvre le jeu.',
          'De 1000 à 1400 : joueur occasionnel qui connaît les bases.',
          'De 1400 à 1800 : bon joueur de club.',
          'De 1800 à 2200 : joueur fort, expérimenté en compétition.',
          'Au-delà de 2500 : niveau grand maître international.',
        ],
      },
      {
        h2: 'Pourquoi votre Elo varie d’un site à l’autre',
        paragraphs: [
          'Chaque site a sa propre population de joueurs et ses propres réglages. Un 1500 sur un site peut valoir 1300 ailleurs. Ce qui compte, c’est votre progression sur un même site, dans une même cadence.',
        ],
      },
      {
        h2: 'Faire monter son Elo',
        paragraphs: [
          'Les points viennent surtout en faisant moins d’erreurs : vérifier les menaces avant chaque coup, travailler la tactique et analyser ses défaites. Les progrès arrivent souvent par paliers, après une période de stagnation.',
        ],
      },
    ],
    cta: { label: 'Mesurer mon Elo contre les bots', path: '/jouer/bot' },
  },
];
