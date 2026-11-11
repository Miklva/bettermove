// Galerie des bots. Les Elo sont des estimations : a recalibrer avec des parties reelles.
export interface Bot {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  style: string;
  description: string;
  /** Phrases dites en debut et fin de partie */
  hello: string;
  onWin: string;
  onLose: string;
}

export const BOTS: Bot[] = [
  {
    id: 'pip',
    name: 'Pip',
    avatar: '🐣',
    rating: 400,
    style: 'Débutant',
    description: 'Vient d’apprendre les règles. Laisse souvent des pièces en prise.',
    hello: 'Coucou ! Le cavalier, il bouge en L, c’est ça ?',
    onWin: 'Oh ?! J’ai gagné ? Trop bien !',
    onLose: 'Bien joué ! Je vais réviser mes règles.',
  },
  {
    id: 'lea',
    name: 'Léa',
    avatar: '🌱',
    rating: 600,
    style: 'Débutante',
    description: 'Connaît les bases, rate encore pas mal de tactiques simples.',
    hello: 'Allez, on s’amuse !',
    onWin: 'Yes ! Celle-là je la garde.',
    onLose: 'GG, tu m’as eue.',
  },
  {
    id: 'hugo',
    name: 'Hugo',
    avatar: '🛹',
    rating: 800,
    style: 'Agressif',
    description: 'Attaque dès qu’il peut, même quand ce n’est pas une bonne idée.',
    hello: 'Ton roi n’a qu’à bien se tenir.',
    onWin: 'Trop rapide pour toi !',
    onLose: 'Ok ok, j’ai attaqué un peu trop tôt.',
  },
  {
    id: 'camille',
    name: 'Camille',
    avatar: '📚',
    rating: 1000,
    style: 'Solide',
    description: 'Joue proprement, sans prendre de risques.',
    hello: 'Bonne partie, que le meilleur gagne.',
    onWin: 'Patience et longueur de temps…',
    onLose: 'Très propre, félicitations.',
  },
  {
    id: 'malik',
    name: 'Malik',
    avatar: '⚡',
    rating: 1200,
    style: 'Tacticien',
    description: 'Adore les fourchettes et les clouages. Surveille tes pièces.',
    hello: 'J’espère que tu aimes les complications.',
    onWin: 'La tactique, c’est 99 % des échecs.',
    onLose: 'Bien vu, je n’avais pas vu venir ça.',
  },
  {
    id: 'sofia',
    name: 'Sofia',
    avatar: '🎯',
    rating: 1400,
    style: 'Équilibrée',
    description: 'Un vrai niveau de club. Punit les erreurs franches.',
    hello: 'Montre-moi ce que tu sais faire.',
    onWin: 'Chaque erreur se paie à ce niveau.',
    onLose: 'Belle partie, tu progresses.',
  },
  {
    id: 'theo',
    name: 'Théo',
    avatar: '🧊',
    rating: 1600,
    style: 'Positionnel',
    description: 'Étouffe lentement ses adversaires. Très bon en finale.',
    hello: 'On a tout le temps.',
    onWin: 'Petit avantage après petit avantage.',
    onLose: 'Respect. Tu as bien tenu la position.',
  },
  {
    id: 'ines',
    name: 'Inès',
    avatar: '🔥',
    rating: 1800,
    style: 'Attaquante',
    description: 'Sacrifie volontiers pour attaquer le roi.',
    hello: 'J’espère que ton roi est bien abrité.',
    onWin: 'Le sacrifice était correct, promis.',
    onLose: 'Impressionnant, tu as bien défendu.',
  },
  {
    id: 'prof',
    name: 'Le Prof',
    avatar: '🎓',
    rating: 2000,
    style: 'Expert',
    description: 'Niveau expert. Connaît ses ouvertures et ses finales.',
    hello: 'Ouvrez vos cahiers, la leçon commence.',
    onWin: 'Nous reverrons ça à la review.',
    onLose: 'Excellent travail, rien à redire.',
  },
  {
    id: 'reine',
    name: 'La Reine Rouge',
    avatar: '👑',
    rating: 2300,
    style: 'Maître',
    description: 'Niveau maître. Très peu d’erreurs.',
    hello: 'Ici, il faut courir pour rester sur place.',
    onWin: 'Qu’on lui coupe la tête !',
    onLose: 'Inattendu… et mérité.',
  },
  {
    id: 'titan',
    name: 'Titan',
    avatar: '🤖',
    rating: 2700,
    style: 'Machine',
    description: 'Presque Stockfish à pleine puissance. Bonne chance.',
    hello: 'Calcul en cours.',
    onWin: 'Résultat conforme aux prévisions.',
    onLose: 'Erreur… inattendue. Bravo, humain.',
  },
];

export const getBot = (id: string) => BOTS.find((b) => b.id === id) ?? BOTS[0];

/** Un bot est debloque si ton Elo s'en approche, ou si tu as battu le bot precedent */
export function isUnlocked(bot: Bot, rating: number, beaten: string[]): boolean {
  const i = BOTS.indexOf(bot);
  if (i <= 1) return true;
  if (bot.rating <= rating + 250) return true;
  return beaten.includes(BOTS[i - 1].id);
}
