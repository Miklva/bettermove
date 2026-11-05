// Bibliotheque d'astuces : rappels courts, classes par theme et relies aux familles d'erreurs du Suivi.
import type { WeakId } from '../coach/analyze';

export type TipCat = 'reflexes' | 'ouverture' | 'tactique' | 'milieu' | 'finale' | 'temps' | 'mental';

export const TIP_CATS: { id: TipCat; label: string; icon: string }[] = [
  { id: 'reflexes', label: 'Réflexes', icon: '🛡️' },
  { id: 'ouverture', label: 'Ouverture', icon: '🚀' },
  { id: 'tactique', label: 'Tactique', icon: '⚔️' },
  { id: 'milieu', label: 'Milieu de partie', icon: '🧠' },
  { id: 'finale', label: 'Finale', icon: '🏁' },
  { id: 'temps', label: 'Gestion du temps', icon: '⏱️' },
  { id: 'mental', label: 'Mental', icon: '🧘' },
];

export interface Tip {
  id: string;
  cat: TipCat;
  title: string;
  text: string;
  /** Familles d'erreurs du Suivi que ce rappel aide a corriger */
  weak?: WeakId[];
}

export const TIPS_LIBRARY: Tip[] = [
  // Reflexes
  {
    id: 'blunder-check',
    cat: 'reflexes',
    title: 'La vérification anti-gaffe',
    text: 'Avant de lâcher ta pièce : la case d’arrivée est-elle attaquée ? Est-elle défendue ? Qu’est-ce que je laisse sans protection en partant ?',
    weak: ['hanging'],
  },
  {
    id: 'opp-threat',
    cat: 'reflexes',
    title: 'Que veut mon adversaire ?',
    text: 'Après chaque coup adverse, demande-toi ce qu’il menace : une prise, un échec, une fourchette ? Réponds à la menace avant de suivre ton plan.',
    weak: ['ignoredThreat', 'allowedMate'],
  },
  {
    id: 'cct',
    cat: 'reflexes',
    title: 'Échecs, prises, menaces',
    text: 'Pour chercher un coup fort, regarde d’abord tous les échecs, puis toutes les prises, puis toutes les menaces. Pour toi, et pour ton adversaire.',
    weak: ['missedTactic', 'missedMate', 'ignoredThreat'],
  },
  {
    id: 'count',
    cat: 'reflexes',
    title: 'Compter attaquants et défenseurs',
    text: 'Une pièce attaquée deux fois et défendue une seule fois tombe. Compte avant d’échanger ou de laisser une pièce sur une case disputée.',
    weak: ['hanging'],
  },
  {
    id: 'loose-pieces',
    cat: 'reflexes',
    title: 'Les pièces non défendues tombent',
    text: 'Une pièce sans défenseur est une cible idéale pour une fourchette ou une attaque double. Garde tes pièces reliées entre elles.',
    weak: ['hanging', 'ignoredThreat'],
  },
  {
    id: 'back-rank',
    cat: 'reflexes',
    title: 'Le mat du couloir',
    text: 'Roi roqué derrière trois pions intacts = danger sur la dernière rangée. Une « luft » (h3 ou h6) au bon moment évite bien des mats.',
    weak: ['allowedMate'],
  },
  // Ouverture
  {
    id: 'three-rules',
    cat: 'ouverture',
    title: 'Les trois règles d’ouverture',
    text: 'Occupe le centre avec tes pions, sors tes cavaliers et tes fous, roque tôt. Le reste vient après.',
    weak: ['opening'],
  },
  {
    id: 'queen-early',
    cat: 'ouverture',
    title: 'Pas de dame trop tôt',
    text: 'Sortir la dame tôt la fait chasser par les pièces adverses, qui se développent en gagnant du temps.',
    weak: ['opening'],
  },
  {
    id: 'same-piece',
    cat: 'ouverture',
    title: 'Une pièce, un coup',
    text: 'En ouverture, évite de jouer deux fois la même pièce sans raison : chaque coup doit développer une nouvelle pièce.',
    weak: ['opening'],
  },
  {
    id: 'f7',
    cat: 'ouverture',
    title: 'Le point faible f7 / f2',
    text: 'Au début, f7 (ou f2) n’est défendu que par le roi. Surveille-le, surtout contre un fou en c4 et une dame qui sort.',
    weak: ['opening', 'allowedMate'],
  },
  // Tactique
  {
    id: 'fork',
    cat: 'tactique',
    title: 'Chercher la fourchette',
    text: 'Deux pièces adverses non défendues, ou roi et dame sur des cases à distance de cavalier ? Il y a peut-être une fourchette.',
    weak: ['missedTactic'],
  },
  {
    id: 'pin',
    cat: 'tactique',
    title: 'Exploiter le clouage',
    text: 'Une pièce clouée devant le roi ne peut pas bouger : attaque-la encore une fois, ou profite qu’elle ne défende plus rien.',
    weak: ['missedTactic'],
  },
  {
    id: 'forcing',
    cat: 'tactique',
    title: 'Les coups forcés d’abord',
    text: 'Quand le roi adverse est exposé, calcule chaque échec jusqu’au bout. Un sacrifice qui force le mat n’est pas un risque.',
    weak: ['missedMate', 'missedTactic'],
  },
  {
    id: 'remove-defender',
    cat: 'tactique',
    title: 'Éliminer le défenseur',
    text: 'Si une pièce adverse n’est défendue qu’une fois, prends ou chasse ce défenseur : la pièce tombe ensuite.',
    weak: ['missedTactic'],
  },
  // Milieu
  {
    id: 'worst-piece',
    cat: 'milieu',
    title: 'Améliore ta plus mauvaise pièce',
    text: 'Sans plan clair, trouve ta pièce la moins active et donne-lui une meilleure case. C’est rarement un mauvais coup.',
    weak: ['positional'],
  },
  {
    id: 'pawn-moves',
    cat: 'milieu',
    title: 'Les pions ne reculent pas',
    text: 'Chaque coup de pion crée des cases faibles définitives. Avance-les avec un but, surtout devant ton roi.',
    weak: ['positional', 'allowedMate'],
  },
  {
    id: 'trade-ahead',
    cat: 'milieu',
    title: 'En avance : échange les pièces',
    text: 'Avec du matériel en plus, échange les pièces (pas les pions) : la finale devient plus simple à gagner.',
    weak: ['conversion'],
  },
  {
    id: 'stay-calm-ahead',
    cat: 'milieu',
    title: 'Gagnant ? Reste prudent',
    text: 'Une fois en avance, la priorité est de ne plus rien donner : vérifie les contre-attaques avant de foncer.',
    weak: ['conversion', 'hanging'],
  },
  {
    id: 'open-files',
    cat: 'milieu',
    title: 'Les tours aiment les colonnes ouvertes',
    text: 'Place tes tours sur les colonnes ouvertes ou semi-ouvertes. Une tour en septième rangée est souvent décisive.',
    weak: ['positional'],
  },
  // Finale
  {
    id: 'king-active',
    cat: 'finale',
    title: 'Le roi devient une pièce',
    text: 'En finale, centralise ton roi : il défend tes pions, attaque ceux de l’adversaire et escorte la promotion.',
    weak: ['endgame', 'conversion'],
  },
  {
    id: 'rook-behind',
    cat: 'finale',
    title: 'La tour derrière le pion passé',
    text: 'Que le pion passé soit à toi ou à l’adversaire, la tour se place derrière lui.',
    weak: ['endgame'],
  },
  {
    id: 'opposition',
    cat: 'finale',
    title: 'L’opposition',
    text: 'Roi contre roi avec une case entre eux : celui qui n’a pas le trait « a l’opposition ». C’est souvent la clé des finales de pions.',
    weak: ['endgame'],
  },
  {
    id: 'stalemate',
    cat: 'finale',
    title: 'Attention au pat',
    text: 'Avec beaucoup d’avance, vérifie toujours que le roi adverse a encore un coup légal. Un pat transforme une victoire en nulle.',
    weak: ['conversion', 'endgame'],
  },
  // Temps
  {
    id: 'time-budget',
    cat: 'temps',
    title: 'Le budget temps',
    text: 'Divise ton temps : coups d’ouverture connus rapidement, réflexion longue seulement aux moments critiques (prises, attaques, plans).',
    weak: ['time'],
  },
  {
    id: 'low-clock',
    cat: 'temps',
    title: 'Sous les 30 secondes',
    text: 'Joue simple et sûr : des coups qui ne perdent rien valent mieux qu’une combinaison géniale que tu n’as pas le temps de vérifier.',
    weak: ['time', 'hanging'],
  },
  // Mental
  {
    id: 'after-blunder',
    cat: 'mental',
    title: 'Après une gaffe',
    text: 'Respire, puis cherche la meilleure résistance. Beaucoup de parties se retournent quand l’adversaire se relâche.',
  },
  {
    id: 'sit-on-hands',
    cat: 'mental',
    title: 'Le coup trouvé ? Cherches-en un meilleur',
    text: 'Quand tu as trouvé un bon coup, prends dix secondes pour en chercher un meilleur. C’est là que se cachent les tactiques.',
    weak: ['missedTactic', 'missedMate'],
  },
  {
    id: 'review-games',
    cat: 'mental',
    title: 'Analyse tes défaites',
    text: 'Chaque partie perdue contient une leçon. Une analyse rapide dans l’Historique vaut plus que trois parties de plus.',
  },
];
