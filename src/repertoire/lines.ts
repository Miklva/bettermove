// Ouvertures proposees pour le repertoire. Chaque ligne part de la position initiale (notation SAN anglaise).
// Toutes les lignes sont verifiees par scripts/check-repertoire (coups legaux).
export interface RepOpening {
  id: string;
  name: string;
  color: 'w' | 'b';
  /** Contre quoi (pour classer) */
  against: string;
  level: 'débutant' | 'intermédiaire' | 'avancé';
  ideas: string;
  lines: string[];
}

export const REP_OPENINGS: RepOpening[] = [
  // ------------------------------------------------------------------ Blancs
  {
    id: 'w-italian',
    name: 'Partie italienne',
    color: 'w',
    against: '1…e5',
    level: 'débutant',
    ideas:
      'Le fou en c4 vise f7. Prépare d4 avec c3, roque vite, et ne te précipite pas : la pression monte toute seule.',
    lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1',
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 a6 O-O d6 a4',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O',
      'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Bf4',
      'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3',
    ],
  },
  {
    id: 'w-ruy',
    name: 'Partie espagnole',
    color: 'w',
    against: '1…e5',
    level: 'intermédiaire',
    ideas:
      'Le fou b5 attaque le défenseur de e5. Plan classique : roque, Te1, c3 puis d4 pour gagner le centre. Le fou recule en b3 si on le chasse.',
    lines: [
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5',
      'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 Re1 Nd6 Nxe5 Be7 Bf1',
      'e4 e5 Nf3 Nc6 Bb5 Bc5 c3 Nf6 O-O O-O d4 Bb6',
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 c3 Bd7 d4',
    ],
  },
  {
    id: 'w-scotch',
    name: 'Partie écossaise',
    color: 'w',
    against: '1…e5',
    level: 'intermédiaire',
    ideas: 'On ouvre le centre tout de suite avec d4. Jeu actif et clair : développe vite et vise les cases faibles noires.',
    lines: [
      'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4',
      'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4',
      'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4 Nc3 Bb4 Be2',
    ],
  },
  {
    id: 'w-alapin',
    name: 'Sicilienne Alapin (2.c3)',
    color: 'w',
    against: '1…c5',
    level: 'intermédiaire',
    ideas: 'c3 prépare d4 pour garder un pion au centre. Évite la théorie lourde de la Sicilienne ouverte.',
    lines: [
      'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4',
      'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 Bg4 Be2 e6 O-O Nc6',
      'e4 c5 c3 Nc6 d4 cxd4 cxd4 d5 exd5 Qxd5 Nf3',
      'e4 c5 c3 e6 d4 d5 e5 Nc6 Nf3',
    ],
  },
  {
    id: 'w-french-adv',
    name: 'Française, variante d’avance',
    color: 'w',
    against: '1…e6',
    level: 'intermédiaire',
    ideas: 'e5 gagne de l’espace et gêne le cavalier g8. Défends la chaîne de pions d4-e5 avec c3 et Cf3.',
    lines: [
      'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3',
      'e4 e6 d4 d5 e5 c5 c3 Qb6 Nf3 Bd7 a3',
      'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2',
    ],
  },
  {
    id: 'w-caro-adv',
    name: 'Caro-Kann, variante d’avance',
    color: 'w',
    against: '1…c6',
    level: 'intermédiaire',
    ideas: 'Comme contre la Française : espace avec e5, développement simple, et attaque possible à l’aile roi.',
    lines: [
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3',
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 Nd7 O-O',
      'e4 c6 d4 d5 e5 c5 dxc5 e6 Nf3 Bxc5 Bd3',
    ],
  },
  {
    id: 'w-scandi',
    name: 'Contre la Scandinave',
    color: 'w',
    against: '1…d5',
    level: 'débutant',
    ideas: 'Prends en d5 et gagne du temps en attaquant la dame avec Cc3. Développe tes pièces pendant qu’elle se promène.',
    lines: [
      'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2',
      'e4 d5 exd5 Qxd5 Nc3 Qd8 d4 Nf6 Nf3',
      'e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6 Be2',
      'e4 d5 exd5 Nf6 d4 Nxd5 Nf3 Bg4 Be2 e6 O-O',
    ],
  },
  {
    id: 'w-london',
    name: 'Système de Londres',
    color: 'w',
    against: '1…d5 / 1…Cf6',
    level: 'débutant',
    ideas:
      'Toujours le même schéma : d4, Ff4, e3, Cf3, c3, Cbd2, Fd3. Facile à retenir, solide, avec des plans d’attaque sur le roque.',
    lines: [
      'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
      'd4 d5 Bf4 c5 e3 Nc6 c3 Nf6 Nd2 e6 Ngf3',
      'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3',
      'd4 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nd2',
      'd4 Nf6 Bf4 d5 e3 e6 Nf3 Bd6 Bg3',
    ],
  },
  {
    id: 'w-qgd',
    name: 'Gambit dame',
    color: 'w',
    against: '1…d5',
    level: 'intermédiaire',
    ideas:
      'c4 attaque d5 pour obtenir le centre. Ce n’est pas un vrai gambit : si les Noirs prennent, le pion se récupère facilement.',
    lines: [
      'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4',
      'd4 d5 c4 dxc4 e3 Nf6 Bxc4 e6 Nf3 c5 O-O',
      'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4',
      'd4 d5 c4 e5 dxe5 d4 Nf3 Nc6 g3',
    ],
  },

  // ------------------------------------------------------------------ Noirs
  {
    id: 'b-e5',
    name: '1…e5 classique',
    color: 'b',
    against: '1.e4',
    level: 'débutant',
    ideas:
      'Réponds au centre par le centre. Développe Cc6, Fc5 ou Cf6, roque vite. Contre l’italienne, c’est le Giuoco Piano tranquille.',
    lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
      'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6 c3 O-O',
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6',
      'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6',
      'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7',
      'e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4 Bb4',
      'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5',
      'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4',
    ],
  },
  {
    id: 'b-caro',
    name: 'Défense Caro-Kann',
    color: 'b',
    against: '1.e4',
    level: 'intermédiaire',
    ideas: 'c6 prépare d5 sans enfermer le fou c8, qui sort en f5 ou g4. Solide, peu de pièges, finales agréables.',
    lines: [
      'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5',
      'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4',
      'e4 c6 d4 d5 Nd2 dxe4 Nxe4 Bf5 Ng3 Bg6',
      'e4 c6 Nc3 d5 Nf3 Bg4 h3 Bxf3 Qxf3 e6',
      'e4 c6 d3 d5 Nd2 e5 Ngf3 Bd6',
    ],
  },
  {
    id: 'b-scandi',
    name: 'Défense scandinave',
    color: 'b',
    against: '1.e4',
    level: 'débutant',
    ideas: 'On attaque e4 tout de suite. Après la prise, la dame se replie en a5 et le fou c8 sort en f5. Simple et direct.',
    lines: [
      'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
      'e4 d5 exd5 Qxd5 Nf3 Bg4 Be2 Nc6',
      'e4 d5 exd5 Qxd5 d4 Nf6 Nf3 Bf5',
      'e4 d5 e5 Bf5 d4 e6 Nf3 c5',
      'e4 d5 Nc3 d4 Nce2 e5',
    ],
  },
  {
    id: 'b-french',
    name: 'Défense française',
    color: 'b',
    against: '1.e4',
    level: 'intermédiaire',
    ideas: 'e6 puis d5 : une chaîne de pions solide. On attaque la base adverse avec c5. Le fou c8 est le point faible à surveiller.',
    lines: [
      'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6',
      'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7',
      'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6',
      'e4 e6 d4 d5 Nd2 c5 exd5 Qxd5 Ngf3 cxd4',
      'e4 e6 d3 d5 Nd2 Nf6 Ngf3 c5',
    ],
  },
  {
    id: 'b-qgd',
    name: 'Gambit dame refusé',
    color: 'b',
    against: '1.d4',
    level: 'intermédiaire',
    ideas: 'On garde le pion d5 avec e6. Développement classique Cf6, Fe7, 0-0, puis libération avec c5 ou e5.',
    lines: [
      'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6',
      'd4 d5 c4 e6 Nf3 Nf6 g3 Be7 Bg2 O-O',
      'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7',
      'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5',
      'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5',
    ],
  },
  {
    id: 'b-slav',
    name: 'Défense slave',
    color: 'b',
    against: '1.d4',
    level: 'intermédiaire',
    ideas: 'c6 protège d5 tout en gardant la diagonale du fou c8 ouverte. Très solide contre le Gambit dame.',
    lines: [
      'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4',
      'd4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Bf4 Nc6',
      'd4 d5 c4 c6 Nc3 Nf6 e3 Bf5',
      'd4 d5 Nf3 Nf6 c4 c6',
      'd4 d5 Bf4 Nf6 e3 c5',
    ],
  },
  {
    id: 'b-kid',
    name: 'Défense est-indienne',
    color: 'b',
    against: '1.d4',
    level: 'avancé',
    ideas: 'On laisse les Blancs construire le centre, puis on le frappe avec e5. Fou g7 très puissant, attaque à l’aile roi.',
    lines: [
      'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6',
      'd4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O',
      'd4 Nf6 Nf3 g6 Bf4 Bg7 e3 O-O',
      'd4 Nf6 Bf4 g6 e3 Bg7',
      'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O',
    ],
  },
  // ------------------------------------------------------------------ Ajouts (lignes verifiees avec Stockfish)
  {
    id: 'w-vienna',
    name: 'Partie viennoise',
    color: 'w',
    against: '1…e5',
    level: 'intermédiaire',
    ideas: 'Le cavalier sort en c3 avant de jouer f4 : on attaque e5 et on ouvre la colonne f pour une attaque sur l’aile roi.',
    lines: [
      'e4 e5 Nc3 Nf6 Bc4 Nc6 d3 Bc5 f4 d6 Nf3 O-O',
      'e4 e5 Nc3 Nc6 Bc4 Bc5 Qg4 Qf6 Nd5',
      'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Qxe5+ Qe7 Qxe7+ Bxe7 Bb3',
    ],
  },
  {
    id: 'w-english',
    name: 'Partie anglaise',
    color: 'w',
    against: '1…e5 / 1…c5 / 1…Cf6',
    level: 'avancé',
    ideas: '1.c4 contrôle d5 depuis le côté. Fou en g2, cavalier en c3, roque : un jeu de position souple où l’on choisit plus tard où frapper.',
    lines: [
      'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7',
      'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 e6 O-O Nge7',
      'c4 Nf6 Nc3 e6 e4 d5 e5 d4 exf6 dxc3 bxc3 Qxf6 d4',
      'c4 e6 Nc3 d5 d4 Nf6 Nf3',
    ],
  },
  {
    id: 'b-nimzo',
    name: 'Défense nimzo-indienne',
    color: 'b',
    against: '1.d4',
    level: 'avancé',
    ideas: 'Fb4 cloue le cavalier c3 et empêche e4. Les Noirs sont prêts à donner la paire de fous pour abîmer les pions blancs.',
    lines: [
      'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6',
      'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7',
      'd4 Nf6 c4 e6 Nc3 Bb4 Bg5 h6 Bh4 c5 d5 d6',
      'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O',
    ],
  },
  {
    id: 'b-vs-english',
    name: 'Contre l’Anglaise : 1…e5',
    color: 'b',
    against: '1.c4',
    level: 'intermédiaire',
    ideas: 'Une Sicilienne inversée : les Noirs prennent le centre avec e5 et d5, se développent vite et reculent le cavalier en b6 si on le chasse.',
    lines: [
      'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7 d3 O-O',
      'c4 e5 g3 Nf6 Bg2 c6 Nf3 e4 Nd4 d5 cxd5 Qb6',
      'c4 e5 Nf3 e4 Nd4 Nc6 Nc2 Nf6 Nc3 d5',
    ],
  },
  {
    id: 'b-dragon',
    name: 'Sicilienne Dragon',
    color: 'b',
    against: '1.e4',
    level: 'avancé',
    ideas: 'Le fou g7 « crache du feu » sur la grande diagonale. Contre le roque opposé des Blancs, contre-attaque rapide sur l’aile dame (colonne c, ...b5).',
    lines: [
      'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be2 Bg7 O-O O-O Be3 Nc6 Nb3 Be6',
      'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 O-O-O d5',
      'e4 c5 Nf3 d6 d4 cxd4 Qxd4 Nc6 Bb5 Bd7 Bxc6 Bxc6 Nc3 Nf6',
      'e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nc6 c3 Nf6',
    ],
  },
];

export const repOpening = (id: string) => REP_OPENINGS.find((o) => o.id === id);
