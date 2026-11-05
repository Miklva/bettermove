// Catalogue des succes. Chaque succes calcule une progression a partir du journal des parties,
// des reviews et du profil (problemes, cours, XP).
import type { Profile } from '../rating/profile';
import { levelFromXp } from '../rating/xp';
import { advancedUnlocked, CHAPTERS } from '../lessons/courses';
import { BOTS } from '../bots/roster';
import type { GameFact, ReviewFact } from './facts';
import type { Events } from './events';
import type { ShopState } from '../shop/store';
import { ITEMS, itemById, type ItemType } from '../shop/items';
import type { loadRush } from '../rush/store';
import type { loadRep } from '../repertoire/store';
import type { TipsData } from '../tips/store';

export type Category =
  | 'wins'
  | 'mates'
  | 'style'
  | 'losses'
  | 'draws'
  | 'openings'
  | 'puzzles'
  | 'lessons'
  | 'review'
  | 'progress'
  | 'bots'
  | 'online'
  | 'social'
  | 'shop'
  | 'fun';

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'wins', label: 'Victoires', icon: '🏆' },
  { id: 'mates', label: 'Façons de mater', icon: '♚' },
  { id: 'style', label: 'Façons de gagner', icon: '🎭' },
  { id: 'losses', label: 'Défaites mémorables', icon: '💀' },
  { id: 'draws', label: 'Nulles', icon: '🤝' },
  { id: 'openings', label: 'Ouvertures', icon: '📖' },
  { id: 'puzzles', label: 'Problèmes', icon: '🧩' },
  { id: 'lessons', label: 'Cours', icon: '🎓' },
  { id: 'review', label: 'Review', icon: '🔬' },
  { id: 'progress', label: 'Progression', icon: '📈' },
  { id: 'bots', label: 'Les bots', icon: '🤖' },
  { id: 'online', label: 'En ligne', icon: '🌍' },
  { id: 'social', label: 'Social', icon: '💬' },
  { id: 'shop', label: 'Boutique & style', icon: '🛍️' },
  { id: 'fun', label: 'Insolite', icon: '🎪' },
];

export interface Ctx {
  /** Parties contre les bots, de la plus ancienne a la plus recente */
  games: GameFact[];
  local: GameFact[];
  /** Parties en ligne */
  online: GameFact[];
  reviews: ReviewFact[];
  profile: Profile;
  /** Compteurs d'actions (messages, achats, plein ecran...) */
  ev: Events;
  shop: ShopState;
  rush: ReturnType<typeof loadRush>;
  rep: ReturnType<typeof loadRep>;
  tips: TipsData;
}

export interface Achievement {
  id: string;
  cat: Category;
  icon: string;
  title: string;
  desc: string;
  /** 1 bronze, 2 argent, 3 or */
  tier: 1 | 2 | 3;
  target?: number;
  /** Cache tant qu'il n'est pas debloque */
  secret?: boolean;
  value: (c: Ctx) => number;
}

export const TIER_XP = { 1: 20, 2: 50, 3: 120 } as const;

/* ---------------- Aides ---------------- */

const wins = (c: Ctx) => c.games.filter((g) => g.result === 'win');
const losses = (c: Ctx) => c.games.filter((g) => g.result === 'loss');
const count = (list: GameFact[], f: (g: GameFact) => boolean) => list.filter(f).length;
const winsBy = (c: Ctx, f: (g: GameFact) => boolean) => count(wins(c), f);
const mateWins = (c: Ctx, f: (g: GameFact) => boolean) => winsBy(c, (g) => g.reason === 'mate' && !!g.mate && f(g));

function bestStreak(c: Ctx) {
  let best = 0;
  let cur = 0;
  for (const g of c.games) {
    cur = g.result === 'win' ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

/** Nom d'ouverture sans le code ECO */
const bare = (name?: string) => (name ?? '').replace(/^[A-E]\d\d /, '');
const family = (prefix: string) => (g: GameFact) => bare(g.opening).startsWith(prefix);
const contains = (part: string) => (g: GameFact) => bare(g.opening).includes(part);
const allGames = (c: Ctx) => [...c.games, ...c.local];
/** Ouverture choisie par le joueur avec la bonne couleur */
const played = (c: Ctx, side: 'w' | 'b', test: (g: GameFact) => boolean) =>
  count(allGames(c), (g) => g.userColor === side && test(g));
const wonWith = (c: Ctx, side: 'w' | 'b', test: (g: GameFact) => boolean) =>
  count(allGames(c), (g) => g.userColor === side && g.result === 'win' && test(g));

const solvedClean = (p: Profile) => p.puzzleHistory.filter((h) => h.win && !h.assisted);

const allLessons = () => CHAPTERS.flatMap((c) => [...c.lessons, ...(c.advanced ?? [])]);

/* ---------------- Aides (nouveaux succes) ---------------- */

const ev = (c: Ctx, name: string) => c.ev?.[name] ?? 0;
/** Elo bots le plus haut atteint apres une vraie partie (le niveau choisi au depart ne compte pas) */
const botPeak = (c: Ctx) => Math.max(0, ...c.profile.history.map((h) => h.after));
/** Elo problemes : compte seulement une fois le classement provisoire termine (5 problemes) */
const puzzlePeak = (c: Ctx) => (c.profile.puzzleStats.solved + c.profile.puzzleStats.failed >= 5 ? c.profile.puzzles.rating : 0);
const evPrefix = (c: Ctx, prefix: string) => Object.keys(c.ev ?? {}).filter((k) => k.startsWith(prefix) && c.ev[k] > 0).length;
/** Objets possedes d'un type (hors objets gratuits de depart) */
const ownedOf = (c: Ctx, type: ItemType) =>
  (c.shop?.owned ?? []).filter((id) => {
    const it = itemById(id);
    return it && it.type === type && (it.price > 0 || it.exclusive);
  }).length;
const exclusives = (c: Ctx) => (c.shop?.owned ?? []).filter((id) => itemById(id)?.exclusive).length;
const ALL_SKINS = ITEMS.filter((i) => (i.type === 'pieces' || i.type === 'board') && (i.price > 0 || i.exclusive)).length;
const lesson = (id: string) => (c: Ctx) => (c.profile.lessons[id] ? 1 : 0);
const chapterDone = (id: string) => (c: Ctx) => {
  const ch = CHAPTERS.find((x) => x.id === id);
  return ch ? ch.lessons.filter((l) => c.profile.lessons[l.id]).length : 0;
};
const chapterSize = (id: string) => CHAPTERS.find((x) => x.id === id)?.lessons.length ?? 1;
const onWins = (c: Ctx) => c.online.filter((g) => g.result === 'win');
const onCount = (c: Ctx, f: (g: GameFact) => boolean) => c.online.filter(f).length;
const everyGame = (c: Ctx) => [...c.games, ...c.local, ...c.online];
const at = (g: GameFact) => new Date(g.date);
const onDay = (c: Ctx, month: number, day: number) => count(everyGame(c), (g) => at(g).getMonth() === month && at(g).getDate() === day);
const busiestDay = (c: Ctx) => {
  const per: Record<string, number> = {};
  for (const g of everyGame(c)) {
    const d = at(g).toDateString();
    per[d] = (per[d] ?? 0) + 1;
  }
  return Math.max(0, ...Object.values(per));
};
const beat = (id: string) => (c: Ctx) => winsBy(c, (g) => g.botId === id);
const rushBest = (c: Ctx, mode: '3' | '5' | 'survival') => c.rush?.best?.[mode] ?? 0;
const repSeen = (c: Ctx) => Object.values(c.rep?.stats ?? {}).reduce((s, x) => s + (x.seen ?? 0), 0);
const lessonCount = (c: Ctx) => Object.keys(c.profile.lessons).length;
const stars3 = (c: Ctx) => Object.values(c.profile.lessons).filter((l) => l.stars >= 3).length;
const reviewSum = (c: Ctx, k: 'brilliant' | 'great') => c.reviews.reduce((s, r) => s + r[k], 0);
const modesTried = (c: Ctx) =>
  [c.games.length, c.local.length, c.online.length, c.profile.puzzleStats.solved, lessonCount(c), c.reviews.length, c.rush?.runs?.length ?? 0].filter((n) => n > 0).length;

/* ---------------- Catalogue ---------------- */

export const ACHIEVEMENTS: Achievement[] = [
  /* ----- Victoires ----- */
  { id: 'first-win', cat: 'wins', icon: '🩸', title: 'Premier sang', desc: 'Gagner ta première partie contre un bot.', tier: 1, value: (c) => wins(c).length },
  { id: 'wins-10', cat: 'wins', icon: '⚔️', title: 'Gladiateur', desc: 'Gagner 10 parties contre les bots.', tier: 1, target: 10, value: (c) => wins(c).length },
  { id: 'wins-50', cat: 'wins', icon: '🛡️', title: 'Conquérant', desc: 'Gagner 50 parties contre les bots.', tier: 2, target: 50, value: (c) => wins(c).length },
  { id: 'wins-100', cat: 'wins', icon: '🏛️', title: 'Centurion', desc: 'Gagner 100 parties contre les bots.', tier: 3, target: 100, value: (c) => wins(c).length },
  { id: 'streak-3', cat: 'wins', icon: '🔥', title: 'Ça chauffe', desc: 'Gagner 3 parties d’affilée.', tier: 1, target: 3, value: bestStreak },
  { id: 'streak-7', cat: 'wins', icon: '☄️', title: 'Inarrêtable', desc: 'Gagner 7 parties d’affilée.', tier: 3, target: 7, value: bestStreak },
  { id: 'bots-5', cat: 'wins', icon: '🎯', title: 'Tableau de chasse', desc: 'Battre 5 bots différents.', tier: 2, target: 5, value: (c) => new Set(wins(c).map((g) => g.botId)).size },
  { id: 'bots-all', cat: 'wins', icon: '👑', title: 'Grand Chelem', desc: `Battre les ${BOTS.length} bots.`, tier: 3, target: BOTS.length, value: (c) => new Set(wins(c).map((g) => g.botId)).size },
  { id: 'david', cat: 'wins', icon: '🪨', title: 'David contre Goliath', desc: 'Battre un bot classé 200 points au-dessus de toi.', tier: 2, value: (c) => winsBy(c, (g) => (g.botRating ?? 0) - (g.userRating ?? 9999) >= 200) },
  { id: 'titan', cat: 'wins', icon: '🗿', title: 'Tueur de Titan', desc: 'Battre Titan, le plus fort des bots.', tier: 3, value: (c) => winsBy(c, (g) => g.botId === 'titan') },
  { id: 'black-wins', cat: 'wins', icon: '🌑', title: 'Côté obscur', desc: 'Gagner 10 parties avec les Noirs.', tier: 1, target: 10, value: (c) => winsBy(c, (g) => g.userColor === 'b') },

  /* ----- Facons de mater ----- */
  { id: 'mate-first', cat: 'mates', icon: '♚', title: 'Échec et mat !', desc: 'Gagner ta première partie par mat.', tier: 1, value: (c) => mateWins(c, () => true) },
  { id: 'mate-pawn', cat: 'mates', icon: '♟️', title: 'Petit mais costaud', desc: 'Mater avec un pion.', tier: 2, value: (c) => mateWins(c, (g) => g.mate!.piece === 'p') },
  { id: 'mate-knight', cat: 'mates', icon: '🐴', title: 'Cavalier de l’Apocalypse', desc: 'Mater avec un cavalier.', tier: 1, value: (c) => mateWins(c, (g) => g.mate!.piece === 'n') },
  { id: 'mate-bishop', cat: 'mates', icon: '⛪', title: 'Bénédiction finale', desc: 'Mater avec un fou.', tier: 1, value: (c) => mateWins(c, (g) => g.mate!.piece === 'b') },
  { id: 'mate-rook', cat: 'mates', icon: '🏰', title: 'Tour de contrôle', desc: 'Mater avec une tour.', tier: 1, value: (c) => mateWins(c, (g) => g.mate!.piece === 'r') },
  { id: 'mate-queen', cat: 'mates', icon: '👸', title: 'Sa Majesté a parlé', desc: 'Mater avec la dame.', tier: 1, value: (c) => mateWins(c, (g) => g.mate!.piece === 'q') },
  { id: 'mate-collection', cat: 'mates', icon: '🗃️', title: 'Collectionneur de mats', desc: 'Mater avec les 5 types de pièces (pion, cavalier, fou, tour, dame).', tier: 3, target: 5, value: (c) => new Set(wins(c).filter((g) => g.mate).map((g) => g.mate!.piece).filter((p) => 'pnbrq'.includes(p))).size },
  { id: 'mate-kiss', cat: 'mates', icon: '💋', title: 'Le baiser de la mort', desc: 'Mater avec la dame collée au roi adverse.', tier: 1, value: (c) => mateWins(c, (g) => g.mate!.kiss) },
  { id: 'mate-smothered', cat: 'mates', icon: '🫁', title: 'Étouffé dans l’œuf', desc: 'Réussir un mat à l’étouffée : un cavalier mate un roi coincé par ses propres pièces.', tier: 3, value: (c) => mateWins(c, (g) => g.mate!.smothered) },
  { id: 'mate-backrank', cat: 'mates', icon: '🚪', title: 'Couloir de la mort', desc: 'Mater sur la dernière rangée, le roi bloqué par ses pions.', tier: 2, value: (c) => mateWins(c, (g) => g.mate!.backRank) },
  { id: 'mate-double', cat: 'mates', icon: '✌️', title: 'Double peine', desc: 'Mater avec un échec double.', tier: 3, value: (c) => mateWins(c, (g) => g.mate!.double) },
  { id: 'mate-promo', cat: 'mates', icon: '🎓', title: 'Diplômé avec mention', desc: 'Mater en faisant une promotion.', tier: 2, value: (c) => mateWins(c, (g) => g.mate!.promotion) },
  { id: 'mate-scholar', cat: 'mates', icon: '🐑', title: 'Le berger', desc: 'Réussir le mat du berger (dame en f7 en 4 coups).', tier: 1, value: (c) => mateWins(c, (g) => g.mate!.scholar) },
  { id: 'mate-ep', cat: 'mates', icon: '🥷', title: 'En passant par là', desc: 'Mater en prenant en passant.', tier: 3, secret: true, value: (c) => mateWins(c, (g) => g.mate!.enPassant) },
  { id: 'mate-castle', cat: 'mates', icon: '🏯', title: 'Roque and roll', desc: 'Mater en roquant.', tier: 3, secret: true, value: (c) => mateWins(c, (g) => g.mate!.piece === 'castle') },
  { id: 'mate-king', cat: 'mates', icon: '🤴', title: 'Le roi s’en charge', desc: 'Donner mat avec un coup de roi (mat à la découverte).', tier: 3, secret: true, value: (c) => mateWins(c, (g) => g.mate!.piece === 'k') },
  { id: 'mate-25', cat: 'mates', icon: '⚰️', title: 'Croque-mort', desc: 'Gagner 25 parties par mat.', tier: 2, target: 25, value: (c) => mateWins(c, () => true) },

  /* ----- Facons de gagner ----- */
  { id: 'win-time', cat: 'style', icon: '⏰', title: 'Le temps, c’est de l’argent', desc: 'Gagner au temps.', tier: 1, value: (c) => winsBy(c, (g) => g.reason === 'time') },
  { id: 'win-resign', cat: 'style', icon: '🏳️', title: 'Il a jeté l’éponge', desc: 'Pousser un bot à l’abandon.', tier: 1, value: (c) => winsBy(c, (g) => g.reason === 'resign') },
  { id: 'win-resign-10', cat: 'style', icon: '🧻', title: 'Fournisseur officiel de drapeaux blancs', desc: 'Faire abandonner les bots 10 fois.', tier: 2, target: 10, value: (c) => winsBy(c, (g) => g.reason === 'resign') },
  { id: 'win-clutch', cat: 'style', icon: '😰', title: 'Sueurs froides', desc: 'Gagner avec moins de 3 secondes à ta pendule.', tier: 2, value: (c) => winsBy(c, (g) => g.userClock !== undefined && g.userClock < 3000) },
  { id: 'win-comeback', cat: 'style', icon: '🧟', title: 'Remontada', desc: 'Gagner après avoir eu 5 points de matériel de retard.', tier: 2, value: (c) => winsBy(c, (g) => g.minDiff <= -5) },
  { id: 'win-comeback-9', cat: 'style', icon: '🦅', title: 'Phénix', desc: 'Gagner après avoir eu 9 points de retard (une dame de moins).', tier: 3, value: (c) => winsBy(c, (g) => g.minDiff <= -9) },
  { id: 'win-noqueen', cat: 'style', icon: '💔', title: 'Veuf mais vainqueur', desc: 'Gagner après avoir perdu ta dame.', tier: 2, value: (c) => winsBy(c, (g) => g.queenLostAt !== undefined) },
  { id: 'win-flawless', cat: 'style', icon: '💎', title: 'Intouchable', desc: 'Gagner sans perdre une seule pièce (hors pions).', tier: 2, value: (c) => winsBy(c, (g) => g.piecesLost === 0 && g.userMoves >= 15) },
  { id: 'win-fast', cat: 'style', icon: '⚡', title: 'Éclair', desc: 'Gagner en 15 coups ou moins.', tier: 1, value: (c) => winsBy(c, (g) => g.userMoves <= 15) },
  { id: 'win-long', cat: 'style', icon: '🏃', title: 'Marathonien', desc: 'Gagner une partie de 80 coups ou plus.', tier: 2, value: (c) => winsBy(c, (g) => g.userMoves >= 80) },
  { id: 'win-crush', cat: 'style', icon: '🚜', title: 'Bulldozer', desc: 'Finir une partie gagnée avec 15 points de matériel d’avance.', tier: 1, value: (c) => winsBy(c, (g) => g.finalDiff >= 15) },
  { id: 'win-underpromo', cat: 'style', icon: '🦄', title: 'Pourquoi pas une dame ?', desc: 'Gagner une partie où tu as fait une sous-promotion.', tier: 3, secret: true, value: (c) => winsBy(c, (g) => g.underpromotion) },
  { id: 'win-nocastle', cat: 'style', icon: '🏕️', title: 'Roi nomade', desc: 'Gagner une partie de 30 coups ou plus sans roquer.', tier: 1, value: (c) => winsBy(c, (g) => !g.castled && g.userMoves >= 30) },

  /* ----- Defaites memorables ----- */
  { id: 'loss-first', cat: 'losses', icon: '🤕', title: 'Ça forge le caractère', desc: 'Perdre ta première partie. Tout le monde y passe.', tier: 1, value: (c) => losses(c).length },
  { id: 'resign-1', cat: 'losses', icon: '🏳️', title: 'Drapeau blanc', desc: 'Abandonner une partie.', tier: 1, value: (c) => count(losses(c), (g) => g.reason === 'resign') },
  { id: 'resign-10', cat: 'losses', icon: '🎌', title: 'Collection de drapeaux blancs', desc: 'Abandonner 10 parties.', tier: 2, target: 10, value: (c) => count(losses(c), (g) => g.reason === 'resign') },
  { id: 'resign-early', cat: 'losses', icon: '🚪', title: 'Rage quit', desc: 'Abandonner avant ton 10e coup.', tier: 1, secret: true, value: (c) => count(losses(c), (g) => g.reason === 'resign' && g.userMoves < 10) },
  { id: 'flag-1', cat: 'losses', icon: '⌛', title: 'Panique à bord', desc: 'Perdre au temps.', tier: 1, value: (c) => count(losses(c), (g) => g.reason === 'time') },
  { id: 'flag-ahead', cat: 'losses', icon: '🕰️', title: 'Le temps est un voleur', desc: 'Perdre au temps alors que tu avais 3 points de matériel d’avance.', tier: 2, value: (c) => count(losses(c), (g) => g.reason === 'time' && g.finalDiff >= 3) },
  { id: 'flag-10', cat: 'losses', icon: '🐌', title: 'Escargot', desc: 'Perdre 10 parties au temps.', tier: 2, target: 10, value: (c) => count(losses(c), (g) => g.reason === 'time') },
  { id: 'mated-ahead', cat: 'losses', icon: '🤡', title: 'L’arroseur arrosé', desc: 'Te faire mater avec 3 points de matériel d’avance.', tier: 2, value: (c) => count(losses(c), (g) => g.reason === 'mate' && g.finalDiff >= 3) },
  { id: 'mated-fast', cat: 'losses', icon: '🐑', title: 'Victime du berger', desc: 'Te faire mater en 6 coups ou moins.', tier: 1, secret: true, value: (c) => count(losses(c), (g) => g.reason === 'mate' && g.userMoves <= 6) },
  { id: 'queen-early', cat: 'losses', icon: '🪦', title: 'Kamikaze', desc: 'Perdre ta dame avant ton 10e coup.', tier: 1, value: (c) => count(c.games, (g) => g.queenLostAt !== undefined && g.queenLostAt < 10) },
  { id: 'smothered-victim', cat: 'losses', icon: '😵', title: 'Étouffé', desc: 'Te faire mater à l’étouffée.', tier: 2, secret: true, value: (c) => count(losses(c), (g) => g.reason === 'mate' && !!g.mate?.smothered) },
  { id: 'stalemate-ahead', cat: 'losses', icon: '🫠', title: 'Pat-hétique', desc: 'Faire pat alors que tu avais 5 points d’avance.', tier: 2, secret: true, value: (c) => count(c.games, (g) => g.reason === 'stalemate' && g.finalDiff >= 5) },

  /* ----- Nulles ----- */
  { id: 'draw-1', cat: 'draws', icon: '🤝', title: 'Pacifiste', desc: 'Faire ta première nulle.', tier: 1, value: (c) => count(c.games, (g) => g.result === 'draw') },
  { id: 'draw-rep', cat: 'draws', icon: '💿', title: 'Disque rayé', desc: 'Faire nulle par triple répétition.', tier: 1, value: (c) => count(c.games, (g) => g.reason === 'repetition') },
  { id: 'draw-50', cat: 'draws', icon: '🧮', title: 'Comptable', desc: 'Faire nulle par la règle des 50 coups.', tier: 2, value: (c) => count(c.games, (g) => g.reason === 'fifty') },
  { id: 'draw-save', cat: 'draws', icon: '🛟', title: 'Sauvé par le gong', desc: 'Arracher la nulle avec 5 points de matériel de retard.', tier: 2, value: (c) => count(c.games, (g) => g.result === 'draw' && g.finalDiff <= -5) },

  /* ----- Ouvertures ----- */
  { id: 'op-scandi', cat: 'openings', icon: '🛶', title: 'Viking', desc: 'Jouer la Scandinave 10 fois avec les Noirs.', tier: 1, target: 10, value: (c) => played(c, 'b', family('Scandinavian Defense')) },
  { id: 'op-scandi-win', cat: 'openings', icon: '⚡', title: 'Ragnarök', desc: 'Gagner 10 parties avec la Scandinave.', tier: 2, target: 10, value: (c) => wonWith(c, 'b', family('Scandinavian Defense')) },
  { id: 'op-italian', cat: 'openings', icon: '🍝', title: 'Dolce vita', desc: 'Jouer l’Italienne 5 fois avec les Blancs.', tier: 1, target: 5, value: (c) => played(c, 'w', family('Italian Game')) },
  { id: 'op-ruy', cat: 'openings', icon: '🐂', title: 'Torero', desc: 'Jouer l’Espagnole 5 fois avec les Blancs.', tier: 1, target: 5, value: (c) => played(c, 'w', family('Ruy Lopez')) },
  { id: 'op-london', cat: 'openings', icon: '☕', title: 'Tea time', desc: 'Jouer le Système de Londres 5 fois.', tier: 1, target: 5, value: (c) => played(c, 'w', contains('London System')) },
  { id: 'op-qg', cat: 'openings', icon: '♛', title: 'Le Jeu de la dame', desc: 'Jouer le Gambit dame 5 fois avec les Blancs.', tier: 1, target: 5, value: (c) => played(c, 'w', family('Queen\'s Gambit')) },
  { id: 'op-sicilian', cat: 'openings', icon: '🍋', title: 'Sicilien dans l’âme', desc: 'Jouer la Sicilienne 5 fois avec les Noirs.', tier: 1, target: 5, value: (c) => played(c, 'b', family('Sicilian Defense')) },
  { id: 'op-french', cat: 'openings', icon: '🥐', title: 'Croissant au beurre', desc: 'Jouer la Défense française 5 fois.', tier: 1, target: 5, value: (c) => played(c, 'b', family('French Defense')) },
  { id: 'op-caro', cat: 'openings', icon: '🧱', title: 'Le mur Caro-Kann', desc: 'Jouer la Caro-Kann 5 fois.', tier: 1, target: 5, value: (c) => played(c, 'b', family('Caro-Kann Defense')) },
  { id: 'op-kg', cat: 'openings', icon: '🗡️', title: 'Romantique du XIXe', desc: 'Jouer le Gambit du roi.', tier: 1, value: (c) => played(c, 'w', family('King\'s Gambit')) },
  { id: 'op-fried', cat: 'openings', icon: '🍳', title: 'Foie frit', desc: 'Jouer l’attaque Fried Liver.', tier: 2, value: (c) => played(c, 'w', contains('Fried Liver Attack')) },
  { id: 'op-evans', cat: 'openings', icon: '🎩', title: 'Capitaine Evans', desc: 'Gagner avec le Gambit Evans.', tier: 2, value: (c) => wonWith(c, 'w', contains('Evans Gambit')) },
  { id: 'op-bongcloud', cat: 'openings', icon: '☁️', title: 'Bongcloud', desc: 'Jouer 1.e4 e5 2.Re2 et assumer.', tier: 3, secret: true, value: (c) => played(c, 'w', contains('Bongcloud')) },
  { id: 'op-10', cat: 'openings', icon: '📚', title: 'Encyclopédiste', desc: 'Jouer 10 ouvertures différentes.', tier: 2, target: 10, value: (c) => new Set(allGames(c).map((g) => bare(g.opening).split(':')[0]).filter(Boolean)).size },
  { id: 'op-25', cat: 'openings', icon: '🧙', title: 'Théoricien fou', desc: 'Jouer 25 ouvertures différentes.', tier: 3, target: 25, value: (c) => new Set(allGames(c).map((g) => bare(g.opening).split(':')[0]).filter(Boolean)).size },

  /* ----- Problemes ----- */
  { id: 'pz-1', cat: 'puzzles', icon: '💡', title: 'Premier déclic', desc: 'Réussir ton premier problème.', tier: 1, value: (c) => c.profile.puzzleStats.solved },
  { id: 'pz-100', cat: 'puzzles', icon: '🧠', title: 'Tacticien', desc: 'Réussir 100 problèmes.', tier: 2, target: 100, value: (c) => c.profile.puzzleStats.solved },
  { id: 'pz-1000', cat: 'puzzles', icon: '🤖', title: 'Machine à tactiques', desc: 'Réussir 1000 problèmes.', tier: 3, target: 1000, value: (c) => c.profile.puzzleStats.solved },
  { id: 'pz-streak-10', cat: 'puzzles', icon: '🔥', title: 'En feu', desc: 'Réussir 10 problèmes d’affilée.', tier: 2, target: 10, value: (c) => c.profile.puzzleStats.bestStreak },
  { id: 'pz-streak-25', cat: 'puzzles', icon: '🌋', title: 'Volcan', desc: 'Réussir 25 problèmes d’affilée.', tier: 3, target: 25, value: (c) => c.profile.puzzleStats.bestStreak },
  { id: 'pz-fast', cat: 'puzzles', icon: '🏎️', title: 'Flash', desc: 'Réussir un problème en moins de 5 secondes, sans aide.', tier: 1, value: (c) => solvedClean(c.profile).filter((h) => h.seconds < 5).length },
  { id: 'pz-hard', cat: 'puzzles', icon: '🧗', title: 'Cerveau en feu', desc: 'Réussir sans aide un problème classé 2000 ou plus.', tier: 3, value: (c) => solvedClean(c.profile).filter((h) => h.rating >= 2000).length },
  { id: 'pz-1500', cat: 'puzzles', icon: '📈', title: 'Œil de lynx', desc: 'Atteindre 1500 Elo en problèmes.', tier: 2, value: (c) => (puzzlePeak(c) >= 1500 ? 1 : 0) },

  /* ----- Cours ----- */
  { id: 'ls-1', cat: 'lessons', icon: '✏️', title: 'Bon élève', desc: 'Terminer ta première leçon.', tier: 1, value: (c) => Object.keys(c.profile.lessons).length },
  { id: 'ls-perfect', cat: 'lessons', icon: '⭐', title: 'Sans faute', desc: 'Obtenir 3 étoiles sur une leçon.', tier: 1, value: (c) => Object.values(c.profile.lessons).filter((l) => l.stars >= 3).length },
  { id: 'ls-adv', cat: 'lessons', icon: '🗝️', title: 'Passe-muraille', desc: 'Débloquer un approfondissement.', tier: 2, value: (c) => CHAPTERS.filter((ch) => ch.advanced && advancedUnlocked(ch, c.profile.lessons)).length },
  { id: 'ls-openings', cat: 'lessons', icon: '📜', title: 'Répertoire en poche', desc: 'Terminer toutes les leçons d’ouvertures (Blancs et Noirs).', tier: 2, target: 20, value: (c) => CHAPTERS.filter((ch) => ch.id.endsWith('-openings')).flatMap((ch) => [...ch.lessons, ...(ch.advanced ?? [])]).filter((l) => c.profile.lessons[l.id]).length },
  { id: 'ls-all', cat: 'lessons', icon: '🎓', title: 'Docteur ès échecs', desc: 'Obtenir 3 étoiles sur toutes les leçons.', tier: 3, target: allLessons().length, value: (c) => allLessons().filter((l) => (c.profile.lessons[l.id]?.stars ?? 0) >= 3).length },

  /* ----- Review ----- */
  { id: 'rv-1', cat: 'review', icon: '🔬', title: 'Introspection', desc: 'Analyser une partie en review.', tier: 1, value: (c) => c.reviews.length },
  { id: 'rv-20', cat: 'review', icon: '🕵️', title: 'Détective', desc: 'Analyser 20 parties.', tier: 2, target: 20, value: (c) => c.reviews.length },
  { id: 'rv-brilliant', cat: 'review', icon: '‼️', title: 'Brillant !', desc: 'Jouer un coup brillant (vu en review).', tier: 2, value: (c) => c.reviews.reduce((s, r) => s + r.brilliant, 0) },
  { id: 'rv-clean', cat: 'review', icon: '🧽', title: 'Zéro gaffe', desc: 'Une partie de 20 coups ou plus sans gaffe ni erreur.', tier: 2, value: (c) => c.reviews.filter((r) => r.moves >= 20 && r.blunders === 0 && r.mistakes === 0).length },
  { id: 'rv-90', cat: 'review', icon: '🎯', title: 'Chirurgien', desc: 'Atteindre 90 % de précision sur une partie de 20 coups ou plus.', tier: 3, value: (c) => c.reviews.filter((r) => r.moves >= 20 && r.accuracy >= 90).length },

  /* ----- Progression ----- */
  { id: 'games-10', cat: 'progress', icon: '🎲', title: 'Habitué', desc: 'Jouer 10 parties contre les bots.', tier: 1, target: 10, value: (c) => c.games.length },
  { id: 'games-100', cat: 'progress', icon: '🪑', title: 'Pilier de club', desc: 'Jouer 100 parties contre les bots.', tier: 2, target: 100, value: (c) => c.games.length },
  { id: 'local-10', cat: 'progress', icon: '👥', title: 'Entre potes', desc: 'Jouer 10 parties en 1v1.', tier: 1, target: 10, value: (c) => c.local.length },
  { id: 'elo-1200', cat: 'progress', icon: '🥉', title: 'Joueur de club', desc: 'Atteindre 1200 Elo contre les bots.', tier: 1, value: (c) => (botPeak(c) >= 1200 ? 1 : 0) },
  { id: 'elo-1500', cat: 'progress', icon: '🥈', title: 'Redoutable', desc: 'Atteindre 1500 Elo contre les bots.', tier: 2, value: (c) => (botPeak(c) >= 1500 ? 1 : 0) },
  { id: 'elo-1800', cat: 'progress', icon: '🥇', title: 'Expert', desc: 'Atteindre 1800 Elo contre les bots.', tier: 3, value: (c) => (botPeak(c) >= 1800 ? 1 : 0) },
  { id: 'lvl-5', cat: 'progress', icon: '🌱', title: 'Pousse', desc: 'Atteindre le niveau 5.', tier: 1, target: 5, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-15', cat: 'progress', icon: '🌳', title: 'Grand chêne', desc: 'Atteindre le niveau 15.', tier: 2, target: 15, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-10', cat: 'progress', icon: '🌿', title: 'Jeune pousse', desc: 'Atteindre le niveau 10.', tier: 1, target: 10, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-20', cat: 'progress', icon: '🌲', title: 'Forêt dense', desc: 'Atteindre le niveau 20.', tier: 2, target: 20, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-30', cat: 'progress', icon: '🏔️', title: 'Sommet', desc: 'Atteindre le niveau 30.', tier: 3, target: 30, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-40', cat: 'progress', icon: '🗻', title: 'Haute montagne', desc: 'Atteindre le niveau 40.', tier: 3, target: 40, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-50', cat: 'progress', icon: '🌠', title: 'Étoile filante', desc: 'Atteindre le niveau 50.', tier: 3, target: 50, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-100', cat: 'progress', icon: '👑', title: 'Légende vivante', desc: 'Atteindre le niveau 100.', tier: 3, target: 100, value: (c) => levelFromXp(c.profile.xp).level },

  /* ===================== Nouveaux succes ===================== */

  /* ----- Victoires (suite) ----- */
  { id: 'wins-250', cat: 'wins', icon: '🌾', title: 'Moisson de mats', desc: 'Gagner 250 parties contre les bots.', tier: 3, target: 250, value: (c) => wins(c).length },
  { id: 'wins-500', cat: 'wins', icon: '🏯', title: 'Empereur des 64 cases', desc: 'Gagner 500 parties contre les bots.', tier: 3, target: 500, value: (c) => wins(c).length },
  { id: 'streak-12', cat: 'wins', icon: '🎰', title: 'Douze coups de maître', desc: 'Gagner 12 parties d’affilée.', tier: 3, target: 12, value: bestStreak },
  { id: 'white-wins-25', cat: 'wins', icon: '🕊️', title: 'Blanc comme neige', desc: 'Gagner 25 parties avec les Blancs.', tier: 2, target: 25, value: (c) => winsBy(c, (g) => g.userColor === 'w') },
  { id: 'black-wins-25', cat: 'wins', icon: '🖤', title: 'Noir c’est noir', desc: 'Gagner 25 parties avec les Noirs.', tier: 2, target: 25, value: (c) => winsBy(c, (g) => g.userColor === 'b') },
  { id: 'david-400', cat: 'wins', icon: '🎯', title: 'Fronde de compétition', desc: 'Battre un bot classé 400 points au-dessus de toi.', tier: 3, secret: true, value: (c) => winsBy(c, (g) => (g.botRating ?? 0) - (g.userRating ?? 9999) >= 400) },

  /* ----- Facons de mater (suite) ----- */
  { id: 'mate-50', cat: 'mates', icon: '🔢', title: 'Mat-ricule 50', desc: 'Gagner 50 parties par mat.', tier: 2, target: 50, value: (c) => mateWins(c, () => true) },
  { id: 'mate-100', cat: 'mates', icon: '🐂', title: 'Mat-ador', desc: 'Gagner 100 parties par mat.', tier: 3, target: 100, value: (c) => mateWins(c, () => true) },
  { id: 'mate-knight-10', cat: 'mates', icon: '🐎', title: 'Cavalerie lourde', desc: 'Mater 10 fois avec un cavalier.', tier: 2, target: 10, value: (c) => mateWins(c, (g) => g.mate!.piece === 'n') },
  { id: 'mate-rook-10', cat: 'mates', icon: '🗼', title: 'Tour de force', desc: 'Mater 10 fois avec une tour.', tier: 2, target: 10, value: (c) => mateWins(c, (g) => g.mate!.piece === 'r') },
  { id: 'mate-bishop-10', cat: 'mates', icon: '🙏', title: 'Fou à lier', desc: 'Mater 10 fois avec un fou.', tier: 2, target: 10, value: (c) => mateWins(c, (g) => g.mate!.piece === 'b') },
  { id: 'mate-backrank-5', cat: 'mates', icon: '🧱', title: 'Dos au mur', desc: 'Réussir 5 mats du couloir.', tier: 2, target: 5, value: (c) => mateWins(c, (g) => g.mate!.backRank) },
  { id: 'mate-online', cat: 'mates', icon: '🌐', title: 'Mat-chmaking', desc: 'Mater un vrai joueur en ligne.', tier: 1, value: (c) => onCount(c, (g) => g.result === 'win' && g.reason === 'mate') },

  /* ----- Defaites et nulles (suite) ----- */
  { id: 'loss-25', cat: 'losses', icon: '🎢', title: 'Qui perd gagne… un jour', desc: 'Perdre 25 parties. L’expérience, ça se paie.', tier: 1, target: 25, value: (c) => losses(c).length },
  { id: 'queen-early-5', cat: 'losses', icon: '🎁', title: 'Dame offerte', desc: 'Perdre ta dame avant ton 10e coup dans 5 parties.', tier: 2, target: 5, secret: true, value: (c) => count(c.games, (g) => g.queenLostAt !== undefined && g.queenLostAt < 10) },
  { id: 'draw-10', cat: 'draws', icon: '⚖️', title: 'Nul n’est parfait', desc: 'Faire 10 nulles.', tier: 2, target: 10, value: (c) => count(everyGame(c), (g) => g.result === 'draw') },
  { id: 'draw-insuf', cat: 'draws', icon: '🍽️', title: 'Rien à se mettre sous la dent', desc: 'Faire nulle par matériel insuffisant.', tier: 1, value: (c) => count(everyGame(c), (g) => g.reason === 'insufficient') },
  { id: 'draw-stalemate', cat: 'draws', icon: '🧊', title: 'Pat de deux', desc: 'Obtenir un pat en étant en retard de matériel.', tier: 2, value: (c) => count(everyGame(c), (g) => g.reason === 'stalemate' && g.finalDiff < 0) },

  /* ----- Les bots ----- */
  { id: 'beat-pip', cat: 'bots', icon: '🐣', title: 'Pip, pip, hourra !', desc: 'Battre Pip.', tier: 1, value: beat('pip') },
  { id: 'beat-lea', cat: 'bots', icon: '🌸', title: 'Léa battue, Léa vu', desc: 'Battre Léa.', tier: 1, value: beat('lea') },
  { id: 'beat-hugo', cat: 'bots', icon: '📖', title: 'Victor sur Hugo', desc: 'Battre Hugo.', tier: 1, value: beat('hugo') },
  { id: 'beat-camille', cat: 'bots', icon: '🌼', title: 'Mille mercis, Camille', desc: 'Battre Camille.', tier: 1, value: beat('camille') },
  { id: 'beat-malik', cat: 'bots', icon: '💧', title: 'Malik-idé', desc: 'Battre Malik.', tier: 1, value: beat('malik') },
  { id: 'beat-sofia', cat: 'bots', icon: '🎻', title: 'Sofia-sco', desc: 'Battre Sofia.', tier: 2, value: beat('sofia') },
  { id: 'beat-theo', cat: 'bots', icon: '📐', title: 'Théo-rème démontré', desc: 'Battre Théo.', tier: 2, value: beat('theo') },
  { id: 'beat-ines', cat: 'bots', icon: '🦊', title: 'Inès-pérée', desc: 'Battre Inès.', tier: 2, value: beat('ines') },
  { id: 'beat-prof', cat: 'bots', icon: '🎓', title: 'Le Prof-ondément battu', desc: 'Battre le bot Le Prof : l’élève dépasse le maître.', tier: 2, value: beat('prof') },
  { id: 'beat-prof-5', cat: 'bots', icon: '📝', title: 'Prof-essionnel', desc: 'Battre le bot Le Prof 5 fois.', tier: 3, target: 5, value: beat('prof') },
  { id: 'beat-reine', cat: 'bots', icon: '👑', title: 'Reine-versée', desc: 'Battre La Reine Rouge.', tier: 3, value: beat('reine') },
  { id: 'beat-titan-5', cat: 'bots', icon: '⛰️', title: 'Titan-ic', desc: 'Battre Titan 5 fois. Lui aussi finit par couler.', tier: 3, target: 5, value: beat('titan') },
  { id: 'teacher-1', cat: 'bots', icon: '👨‍🏫', title: 'Élève assidu', desc: 'Jouer une partie entière contre le professeur.', tier: 1, value: (c) => ev(c, 'teacher-game') },
  { id: 'teacher-win', cat: 'bots', icon: '🍎', title: 'Une pomme pour le prof', desc: 'Battre le professeur (mode Contre le professeur).', tier: 2, value: (c) => ev(c, 'teacher-win') },
  { id: 'teacher-win-5', cat: 'bots', icon: '📜', title: 'Prof-ité de la leçon', desc: 'Battre le professeur 5 fois.', tier: 3, target: 5, value: (c) => ev(c, 'teacher-win') },
  { id: 'teacher-10', cat: 'bots', icon: '🏫', title: 'Abonné aux heures de colle', desc: 'Jouer 10 parties contre le professeur.', tier: 2, target: 10, value: (c) => ev(c, 'teacher-game') },
  { id: 'teacher-undo', cat: 'bots', icon: '⏪', title: 'Gomme magique', desc: 'Reprendre 20 coups contre le professeur.', tier: 1, target: 20, value: (c) => ev(c, 'teacher-takeback') },
  { id: 'lost-pip', cat: 'bots', icon: '🐥', title: 'Battu par un poussin', desc: 'Perdre contre Pip.', tier: 1, secret: true, value: (c) => count(losses(c), (g) => g.botId === 'pip') },
  { id: 'bot-chat-1', cat: 'bots', icon: '🧊', title: 'Brise-glace', desc: 'Écrire un message à un bot pendant une partie.', tier: 1, value: (c) => ev(c, 'bot-chat') },
  { id: 'bot-chat-50', cat: 'bots', icon: '🗣️', title: 'Tchatche-mat', desc: 'Écrire 50 messages aux bots.', tier: 2, target: 50, value: (c) => ev(c, 'bot-chat') },
  { id: 'bot-chat-300', cat: 'bots', icon: '👅', title: 'Langue bien pendue', desc: 'Écrire 300 messages aux bots.', tier: 3, target: 300, value: (c) => ev(c, 'bot-chat') },
  { id: 'bot-chat-all', cat: 'bots', icon: '📇', title: 'Carnet de bots-ins', desc: `Discuter avec les ${BOTS.length} bots.`, tier: 3, target: BOTS.length, value: (c) => evPrefix(c, 'bot-chat-') - (ev(c, 'bot-chat-1') ? 1 : 0) },
  { id: 'bot-polite', cat: 'bots', icon: '🎩', title: 'Gentleman des cases', desc: 'Dire « gg », « merci » ou « bien joué » 10 fois à un bot.', tier: 1, target: 10, value: (c) => ev(c, 'bot-polite') },

  /* ----- En ligne ----- */
  { id: 'on-first', cat: 'online', icon: '🔌', title: 'En ligne de mire', desc: 'Jouer ta première partie en ligne.', tier: 1, value: (c) => c.online.length },
  { id: 'on-win-1', cat: 'online', icon: '🥇', title: 'Première ligne', desc: 'Gagner une partie en ligne.', tier: 1, value: (c) => onWins(c).length },
  { id: 'on-win-10', cat: 'online', icon: '📶', title: 'Wi-Fight', desc: 'Gagner 10 parties en ligne.', tier: 2, target: 10, value: (c) => onWins(c).length },
  { id: 'on-win-50', cat: 'online', icon: '⛓️', title: 'Gagner à la chaîne', desc: 'Gagner 50 parties en ligne.', tier: 3, target: 50, value: (c) => onWins(c).length },
  { id: 'on-win-100', cat: 'online', icon: '🛰️', title: 'Câblé pour gagner', desc: 'Gagner 100 parties en ligne.', tier: 3, target: 100, value: (c) => onWins(c).length },
  { id: 'on-rated', cat: 'online', icon: '💺', title: 'Classe affaires', desc: 'Gagner une partie classée.', tier: 1, value: (c) => onCount(c, (g) => g.result === 'win' && !!g.rated) },
  { id: 'on-games-25', cat: 'online', icon: '📡', title: 'Abonné premium', desc: 'Jouer 25 parties en ligne.', tier: 2, target: 25, value: (c) => c.online.length },
  { id: 'on-games-100', cat: 'online', icon: '🔋', title: 'Toujours connecté', desc: 'Jouer 100 parties en ligne.', tier: 3, target: 100, value: (c) => c.online.length },
  { id: 'on-loss', cat: 'online', icon: '🚫', title: 'Erreur 404 : victoire introuvable', desc: 'Perdre une partie en ligne.', tier: 1, value: (c) => onCount(c, (g) => g.result === 'loss') },
  { id: 'on-draw', cat: 'online', icon: '🏓', title: 'Ping-pong', desc: 'Faire nulle en ligne.', tier: 1, value: (c) => onCount(c, (g) => g.result === 'draw') },
  { id: 'on-time', cat: 'online', icon: '⏳', title: 'Time-out pour toi', desc: 'Gagner au temps en ligne.', tier: 1, value: (c) => onCount(c, (g) => g.result === 'win' && g.reason === 'time') },
  { id: 'on-resigned', cat: 'online', icon: '🏳️', title: 'Déconnexion émotionnelle', desc: 'Pousser un vrai joueur à l’abandon.', tier: 1, value: (c) => onCount(c, (g) => g.result === 'win' && g.reason === 'resign') },
  { id: 'on-fast', cat: 'online', icon: '☕', title: 'Victoire express-o', desc: 'Gagner en ligne en 20 coups ou moins.', tier: 2, value: (c) => onCount(c, (g) => g.result === 'win' && g.userMoves <= 20) },
  { id: 'on-black-10', cat: 'online', icon: '🛒', title: 'Black Friday', desc: 'Gagner 10 parties en ligne avec les Noirs.', tier: 2, target: 10, value: (c) => onCount(c, (g) => g.result === 'win' && g.userColor === 'b') },
  { id: 'on-comeback', cat: 'online', icon: '🔄', title: 'Reconnexion réussie', desc: 'Gagner en ligne après avoir eu 5 points de retard.', tier: 3, value: (c) => onCount(c, (g) => g.result === 'win' && g.minDiff <= -5) },
  { id: 'on-1200', cat: 'online', icon: '⬆️', title: 'Débit montant', desc: 'Atteindre 1200 Elo en ligne.', tier: 2, value: (c) => (Math.max(0, ...c.online.map((g) => g.userRating ?? 0)) >= 1200 ? 1 : 0) },
  { id: 'on-1500', cat: 'online', icon: '🚀', title: 'Très haut débit', desc: 'Atteindre 1500 Elo en ligne.', tier: 3, value: (c) => (Math.max(0, ...c.online.map((g) => g.userRating ?? 0)) >= 1500 ? 1 : 0) },
  { id: 'rematch-1', cat: 'online', icon: '🔁', title: 'Et re-belote', desc: 'Proposer une revanche.', tier: 1, value: (c) => ev(c, 'rematch') },
  { id: 'rematch-10', cat: 'online', icon: '🥊', title: 'Revanchard de service', desc: 'Proposer ou accepter 10 revanches.', tier: 2, target: 10, value: (c) => ev(c, 'rematch') },
  { id: 'rematch-no', cat: 'online', icon: '🙅', title: 'Revanche ? J’ai déjà donné', desc: 'Refuser une revanche.', tier: 1, secret: true, value: (c) => ev(c, 'rematch-decline') },
  { id: 'draw-offer', cat: 'online', icon: '🕊️', title: 'Proposition indécente', desc: 'Proposer la nulle en ligne.', tier: 1, value: (c) => ev(c, 'draw-offer') },
  { id: 'on-resign', cat: 'online', icon: '📴', title: 'Déconnecté du game', desc: 'Abandonner une partie en ligne.', tier: 1, secret: true, value: (c) => ev(c, 'online-resign') },
  { id: 'challenge-1', cat: 'online', icon: '🎺', title: 'Défi-lé', desc: 'Défier un ami.', tier: 1, value: (c) => ev(c, 'challenge') },
  { id: 'challenge-ok', cat: 'online', icon: '🤜', title: 'Chiche !', desc: 'Accepter un défi.', tier: 1, value: (c) => ev(c, 'challenge-accept') },
  { id: 'challenge-20', cat: 'online', icon: '📣', title: 'Provocateur en chef', desc: 'Lancer 20 défis.', tier: 2, target: 20, value: (c) => ev(c, 'challenge') },

  /* ----- Social ----- */
  { id: 'friend-1', cat: 'social', icon: '🤗', title: 'Ami-cale', desc: 'Demander quelqu’un en ami.', tier: 1, value: (c) => ev(c, 'friend-add') },
  { id: 'friend-ok', cat: 'social', icon: '🤝', title: 'Main tendue', desc: 'Accepter une demande d’ami.', tier: 1, value: (c) => ev(c, 'friend-accept') },
  { id: 'friend-5', cat: 'social', icon: '👯', title: 'Amical-ement vôtre', desc: 'Envoyer 5 demandes d’ami.', tier: 2, target: 5, value: (c) => ev(c, 'friend-add') },
  { id: 'dm-1', cat: 'social', icon: '💌', title: 'Petit mot doux', desc: 'Envoyer un message privé.', tier: 1, value: (c) => ev(c, 'dm') },
  { id: 'dm-50', cat: 'social', icon: '🐦', title: 'Pigeon voyageur', desc: 'Envoyer 50 messages privés.', tier: 2, target: 50, value: (c) => ev(c, 'dm') },
  { id: 'dm-500', cat: 'social', icon: '📮', title: 'Facteur échecs', desc: 'Envoyer 500 messages privés.', tier: 3, target: 500, value: (c) => ev(c, 'dm') },
  { id: 'chat-1', cat: 'social', icon: '🐈', title: 'Tchat perché', desc: 'Écrire dans le chat d’une partie.', tier: 1, value: (c) => ev(c, 'chat-msg') },
  { id: 'chat-100', cat: 'social', icon: '📢', title: 'Moulin à paroles', desc: 'Écrire 100 messages dans les chats de partie.', tier: 2, target: 100, value: (c) => ev(c, 'chat-msg') },
  { id: 'chat-1000', cat: 'social', icon: '📚', title: 'Tchat-teau de cartes', desc: 'Écrire 1000 messages dans les chats de partie.', tier: 3, target: 1000, value: (c) => ev(c, 'chat-msg') },
  { id: 'chat-long', cat: 'social', icon: '🧱', title: 'Pavé numérique', desc: 'Envoyer un message de 150 caractères ou plus.', tier: 1, target: 150, value: (c) => ev(c, 'chat-long') },
  { id: 'emote-1', cat: 'social', icon: '😄', title: 'Émoji-nation', desc: 'Envoyer un émoji personnalisé.', tier: 1, value: (c) => ev(c, 'emote') },
  { id: 'emote-50', cat: 'social', icon: '🤟', title: 'Langage des signes', desc: 'Envoyer 50 émojis personnalisés.', tier: 2, target: 50, value: (c) => ev(c, 'emote') },
  { id: 'emote-300', cat: 'social', icon: '🔣', title: 'Hiéroglyphes modernes', desc: 'Envoyer 300 émojis personnalisés.', tier: 3, target: 300, value: (c) => ev(c, 'emote') },
  { id: 'mute-1', cat: 'social', icon: '🤫', title: 'Silence, on joue', desc: 'Rendre muet un joueur.', tier: 1, secret: true, value: (c) => ev(c, 'mute') },
  { id: 'support-1', cat: 'social', icon: '🛟', title: 'Support-able', desc: 'Envoyer un message au support.', tier: 1, value: (c) => ev(c, 'support') },
  { id: 'support-3', cat: 'social', icon: '🎫', title: 'Habitué du guichet', desc: 'Écrire 3 fois au support. Merci pour les retours !', tier: 2, target: 3, value: (c) => ev(c, 'support') },

  /* ----- Boutique et style ----- */
  { id: 'buy-1', cat: 'shop', icon: '💸', title: 'Ça vaut le coût', desc: 'Acheter ton premier objet.', tier: 1, value: (c) => ev(c, 'buy') },
  { id: 'buy-10', cat: 'shop', icon: '🛍️', title: 'Fièvre acheteuse', desc: 'Acheter 10 objets.', tier: 2, target: 10, value: (c) => ev(c, 'buy') },
  { id: 'buy-30', cat: 'shop', icon: '🧺', title: 'Panier garni', desc: 'Acheter 30 objets.', tier: 3, target: 30, value: (c) => ev(c, 'buy') },
  { id: 'own-pieces-5', cat: 'shop', icon: '👔', title: 'Garde-robe de pièces', desc: 'Posséder 5 skins de pièces.', tier: 1, target: 5, value: (c) => ownedOf(c, 'pieces') },
  { id: 'own-pieces-15', cat: 'shop', icon: '👗', title: 'Défilé de mode', desc: 'Posséder 15 skins de pièces.', tier: 2, target: 15, value: (c) => ownedOf(c, 'pieces') },
  { id: 'own-pieces-30', cat: 'shop', icon: '💎', title: 'Pièces de collection', desc: 'Posséder 30 skins de pièces.', tier: 3, target: 30, value: (c) => ownedOf(c, 'pieces') },
  { id: 'own-boards-5', cat: 'shop', icon: '🍱', title: 'Plateau-repas', desc: 'Posséder 5 plateaux.', tier: 1, target: 5, value: (c) => ownedOf(c, 'board') },
  { id: 'own-boards-15', cat: 'shop', icon: '🎭', title: 'Changement de décor', desc: 'Posséder 15 plateaux.', tier: 2, target: 15, value: (c) => ownedOf(c, 'board') },
  { id: 'own-boards-30', cat: 'shop', icon: '🛋️', title: 'Architecte d’intérieur', desc: 'Posséder 30 plateaux.', tier: 3, target: 30, value: (c) => ownedOf(c, 'board') },
  { id: 'own-all-skins', cat: 'shop', icon: '🏛️', title: 'Inventaire à la Prévert', desc: 'Posséder tous les skins de pièces et de plateaux.', tier: 3, target: ALL_SKINS, value: (c) => ownedOf(c, 'pieces') + ownedOf(c, 'board') },
  { id: 'own-sounds-1', cat: 'shop', icon: '🔔', title: 'Ça sonne bien', desc: 'Acheter un pack de sons.', tier: 1, value: (c) => ownedOf(c, 'sounds') },
  { id: 'own-sounds-5', cat: 'shop', icon: '🎼', title: 'Mélomane', desc: 'Posséder 5 packs de sons.', tier: 2, target: 5, value: (c) => ownedOf(c, 'sounds') },
  { id: 'own-emotes-1', cat: 'shop', icon: '🎨', title: 'Visage à la carte', desc: 'Obtenir un pack d’émojis.', tier: 1, value: (c) => ownedOf(c, 'emotes') },
  { id: 'own-emotes-5', cat: 'shop', icon: '🎪', title: 'Émoti-cirque', desc: 'Posséder 5 packs d’émojis.', tier: 2, target: 5, value: (c) => ownedOf(c, 'emotes') },
  { id: 'exclu-1', cat: 'shop', icon: '🏷️', title: 'Édition limitée', desc: 'Obtenir un objet exclusif de la route des niveaux.', tier: 2, value: exclusives },
  { id: 'exclu-10', cat: 'shop', icon: '🔐', title: 'Pièce unique', desc: 'Obtenir 10 objets exclusifs.', tier: 3, target: 10, value: exclusives },
  { id: 'coins-1k', cat: 'shop', icon: '🪙', title: 'Petit pécule', desc: 'Avoir 1 000 pièces en poche.', tier: 1, target: 1000, value: (c) => ev(c, 'coins-max') },
  { id: 'coins-10k', cat: 'shop', icon: '💰', title: 'Sonnantes et trébuchantes', desc: 'Avoir 10 000 pièces en poche.', tier: 2, target: 10000, value: (c) => ev(c, 'coins-max') },
  { id: 'coins-100k', cat: 'shop', icon: '🏦', title: 'Coffre-fort ambulant', desc: 'Avoir 100 000 pièces en poche.', tier: 3, target: 100000, value: (c) => ev(c, 'coins-max') },
  { id: 'coins-1m', cat: 'shop', icon: '🤑', title: 'Million-naire', desc: 'Avoir 1 000 000 de pièces en poche.', tier: 3, target: 1000000, secret: true, value: (c) => ev(c, 'coins-max') },
  { id: 'coins-1b', cat: 'shop', icon: '🃏', title: 'Plein aux as', desc: 'Avoir 1 milliard de pièces. Tu as triché, avoue.', tier: 3, target: 1000000000, secret: true, value: (c) => ev(c, 'coins-max') },
  { id: 'spent-2k', cat: 'shop', icon: '🕳️', title: 'Panier percé', desc: 'Dépenser 2 000 pièces au total.', tier: 1, target: 2000, value: (c) => ev(c, 'spent') },
  { id: 'spent-20k', cat: 'shop', icon: '🔥', title: 'Flambeur', desc: 'Dépenser 20 000 pièces au total.', tier: 3, target: 20000, value: (c) => ev(c, 'spent') },
  { id: 'price-1k', cat: 'shop', icon: '👑', title: 'Folie des grandeurs', desc: 'Acheter un objet à 1 000 pièces ou plus.', tier: 2, target: 1000, value: (c) => ev(c, 'price-max') },
  { id: 'refund-1', cat: 'shop', icon: '↩️', title: 'Satisfait ou remboursé', desc: 'Te faire rembourser un achat.', tier: 1, value: (c) => ev(c, 'refund') },
  { id: 'refund-3', cat: 'shop', icon: '📦', title: 'Retour à l’envoyeur', desc: 'Te faire rembourser 3 achats.', tier: 2, target: 3, secret: true, value: (c) => ev(c, 'refund') },
  { id: 'equip-10', cat: 'shop', icon: '💇', title: 'Relooking extrême', desc: 'Changer d’équipement 10 fois.', tier: 1, target: 10, value: (c) => ev(c, 'equip') },
  { id: 'equip-50', cat: 'shop', icon: '🦎', title: 'Caméléon', desc: 'Changer d’équipement 50 fois.', tier: 2, target: 50, value: (c) => ev(c, 'equip') },
  { id: 'board-zap', cat: 'shop', icon: '📺', title: 'Zapping', desc: 'Changer de plateau 10 fois.', tier: 1, target: 10, value: (c) => ev(c, 'board-change') },
  { id: 'theme-light', cat: 'shop', icon: '☀️', title: 'Côté clair de la force', desc: 'Passer l’app en thème clair.', tier: 1, secret: true, value: (c) => ev(c, 'theme-light') },
  { id: 'level-claim-1', cat: 'shop', icon: '🎁', title: 'Cadeau mérité', desc: 'Récupérer une récompense de niveau.', tier: 1, value: (c) => ev(c, 'level-claim') },
  { id: 'level-claim-15', cat: 'shop', icon: '🧺', title: 'Moisson de cadeaux', desc: 'Récupérer 15 récompenses de niveau.', tier: 2, target: 15, value: (c) => ev(c, 'level-claim') },

  /* ----- Problemes et Rush (suite) ----- */
  { id: 'pz-500', cat: 'puzzles', icon: '🧩', title: 'Casse-tête de compétition', desc: 'Réussir 500 problèmes.', tier: 3, target: 500, value: (c) => c.profile.puzzleStats.solved },
  { id: 'pz-2500', cat: 'puzzles', icon: '🦉', title: 'Énigmologue', desc: 'Réussir 2 500 problèmes.', tier: 3, target: 2500, value: (c) => c.profile.puzzleStats.solved },
  { id: 'pz-streak-50', cat: 'puzzles', icon: '🕶️', title: 'Série noire', desc: 'Réussir 50 problèmes d’affilée.', tier: 3, target: 50, value: (c) => c.profile.puzzleStats.bestStreak },
  { id: 'pz-1800', cat: 'puzzles', icon: '🦅', title: 'Vue d’aigle', desc: 'Atteindre 1800 Elo en problèmes.', tier: 3, value: (c) => (puzzlePeak(c) >= 1800 ? 1 : 0) },
  { id: 'rush-10', cat: 'puzzles', icon: '🚦', title: 'Rush hour', desc: 'Faire 10 points en Rush 3 minutes.', tier: 1, target: 10, value: (c) => rushBest(c, '3') },
  { id: 'rush-25', cat: 'puzzles', icon: '⛏️', title: 'Ruée vers l’or', desc: 'Faire 25 points en Rush 3 minutes.', tier: 3, target: 25, value: (c) => rushBest(c, '3') },
  { id: 'rush-surv-20', cat: 'puzzles', icon: '🛡️', title: 'Instinct de survie', desc: 'Faire 20 points en Rush Survie.', tier: 2, target: 20, value: (c) => rushBest(c, 'survival') },
  { id: 'rush-runs-20', cat: 'puzzles', icon: '💉', title: 'Accro à l’adrénaline', desc: 'Jouer 20 Rush.', tier: 2, target: 20, value: (c) => c.rush?.runs?.length ?? 0 },

  /* ----- Cours : apprendre une ouverture ----- */
  { id: 'lo-italian', cat: 'lessons', icon: '🍕', title: 'Giuoco piano piano', desc: 'Apprendre l’Italienne (cours d’ouvertures des Blancs).', tier: 1, value: lesson('w-italian') },
  { id: 'lo-ruy', cat: 'lessons', icon: '💃', title: 'Olé l’Espagnole', desc: 'Apprendre l’Espagnole.', tier: 1, value: lesson('w-ruy') },
  { id: 'lo-london', cat: 'lessons', icon: '🫖', title: 'Thé à la London', desc: 'Apprendre le Système de Londres.', tier: 1, value: lesson('w-london') },
  { id: 'lo-evans', cat: 'lessons', icon: '🎩', title: 'Gambit Evans-tuel', desc: 'Apprendre le Gambit Evans.', tier: 1, value: lesson('w-evans') },
  { id: 'lo-scandi', cat: 'lessons', icon: '🛶', title: 'Fjord en défense', desc: 'Apprendre la Scandinave.', tier: 1, value: lesson('b-scandi') },
  { id: 'lo-caro', cat: 'lessons', icon: '🥕', title: 'Caro-tte et bâton', desc: 'Apprendre la Caro-Kann.', tier: 1, value: lesson('b-caro') },
  { id: 'lo-sicilian', cat: 'lessons', icon: '🍋', title: 'Si-si-lienne', desc: 'Apprendre la Sicilienne.', tier: 1, value: lesson('b-sicilian') },
  { id: 'lo-qgd', cat: 'lessons', icon: '🙇', title: 'Dame déclinée, poliment', desc: 'Apprendre le Gambit dame refusé.', tier: 1, value: lesson('b-qgd') },
  { id: 'lo-fried', cat: 'lessons', icon: '🦆', title: 'Pas de foie gras pour toi', desc: 'Apprendre à contrer l’attaque Fried Liver.', tier: 2, value: lesson('b-fried-liver') },
  { id: 'lo-white-all', cat: 'lessons', icon: '⬜', title: 'Blanc-seing', desc: 'Terminer toutes les leçons d’ouvertures des Blancs.', tier: 2, target: chapterSize('white-openings'), value: chapterDone('white-openings') },
  { id: 'lo-black-all', cat: 'lessons', icon: '⬛', title: 'Nuit noire, idées claires', desc: 'Terminer toutes les leçons d’ouvertures des Noirs.', tier: 2, target: chapterSize('black-openings'), value: chapterDone('black-openings') },
  { id: 'ls-tactics', cat: 'lessons', icon: '🔱', title: 'Tactique-toc', desc: 'Terminer le chapitre Tactique.', tier: 2, target: chapterSize('tactics'), value: chapterDone('tactics') },
  { id: 'ls-mates', cat: 'lessons', icon: '🧠', title: 'Mat-ière grise', desc: 'Terminer le chapitre sur les mats.', tier: 2, target: chapterSize('king'), value: chapterDone('king') },
  { id: 'ls-endgames', cat: 'lessons', icon: '🏁', title: 'Fin de partie, début de génie', desc: 'Terminer le chapitre Finales.', tier: 2, target: chapterSize('endgames'), value: chapterDone('endgames') },
  { id: 'ls-10', cat: 'lessons', icon: '🏅', title: 'Premier de la classe', desc: 'Terminer 10 leçons.', tier: 1, target: 10, value: lessonCount },
  { id: 'ls-stars-10', cat: 'lessons', icon: '🌟', title: 'Étoile montante', desc: 'Obtenir 3 étoiles sur 10 leçons.', tier: 2, target: 10, value: stars3 },
  { id: 'rep-1', cat: 'lessons', icon: '📒', title: 'Carnet d’adresses', desc: 'Ajouter une ouverture à ton répertoire.', tier: 1, value: (c) => c.rep?.chosen?.length ?? 0 },
  { id: 'rep-5', cat: 'lessons', icon: '🗄️', title: 'Bibliothécaire', desc: 'Avoir 5 ouvertures dans ton répertoire.', tier: 2, target: 5, value: (c) => c.rep?.chosen?.length ?? 0 },
  { id: 'rep-custom', cat: 'lessons', icon: '✍️', title: 'Auteur-compositeur', desc: 'Écrire ta propre ligne de répertoire.', tier: 1, value: (c) => c.rep?.custom?.length ?? 0 },
  { id: 'rep-drill', cat: 'lessons', icon: '📖', title: 'Bachotage', desc: 'Réviser 100 lignes de répertoire.', tier: 2, target: 100, value: repSeen },
  { id: 'tips-10', cat: 'lessons', icon: '👵', title: 'Astuce de grand-mère', desc: 'Marquer 10 astuces comme acquises.', tier: 1, target: 10, value: (c) => Object.keys(c.tips?.learned ?? {}).length },
  { id: 'tips-own', cat: 'lessons', icon: '🪶', title: 'Plume d’or', desc: 'Écrire ta propre astuce.', tier: 1, value: (c) => c.tips?.custom?.length ?? 0 },

  /* ----- Review (suite) ----- */
  { id: 'rv-50', cat: 'review', icon: '🔎', title: 'Inspecteur des travaux finis', desc: 'Analyser 50 parties.', tier: 3, target: 50, value: (c) => c.reviews.length },
  { id: 'rv-brilliant-10', cat: 'review', icon: '💠', title: 'Brillantissime', desc: 'Jouer 10 coups brillants.', tier: 3, target: 10, value: (c) => reviewSum(c, 'brilliant') },
  { id: 'rv-great-10', cat: 'review', icon: '❗', title: 'Coup de génie', desc: 'Jouer 10 excellents coups.', tier: 2, target: 10, value: (c) => reviewSum(c, 'great') },
  { id: 'rv-95', cat: 'review', icon: '⌚', title: 'Précision suisse', desc: 'Atteindre 95 % de précision sur une partie de 20 coups ou plus.', tier: 3, value: (c) => c.reviews.filter((r) => r.moves >= 20 && r.accuracy >= 95).length },
  { id: 'rv-blunders', cat: 'review', icon: '🎆', title: 'Festival de gaffes', desc: 'Faire 5 gaffes dans une même partie (vu en review).', tier: 1, secret: true, value: (c) => c.reviews.filter((r) => r.blunders >= 5).length },

  /* ----- Progression (suite) ----- */
  { id: 'lvl-2', cat: 'progress', icon: '👣', title: 'Un pas de plus', desc: 'Atteindre le niveau 2.', tier: 1, target: 2, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-25', cat: 'progress', icon: '🧭', title: 'Quart de route', desc: 'Atteindre le niveau 25.', tier: 2, target: 25, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-64', cat: 'progress', icon: '♟️', title: '64 cases au compteur', desc: 'Atteindre le niveau 64, un par case.', tier: 3, target: 64, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-75', cat: 'progress', icon: '🌗', title: 'Trois-quarts de légende', desc: 'Atteindre le niveau 75.', tier: 3, target: 75, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'lvl-90', cat: 'progress', icon: '🌕', title: 'Presque légende', desc: 'Atteindre le niveau 90.', tier: 3, target: 90, value: (c) => levelFromXp(c.profile.xp).level },
  { id: 'games-500', cat: 'progress', icon: '🪵', title: 'Meuble du club', desc: 'Jouer 500 parties contre les bots.', tier: 3, target: 500, value: (c) => c.games.length },
  { id: 'local-50', cat: 'progress', icon: '🪞', title: 'Seul contre moi-même', desc: 'Jouer 50 parties en 1v1 local.', tier: 2, target: 50, value: (c) => c.local.length },
  { id: 'elo-2000', cat: 'progress', icon: '🎖️', title: 'Maître de cérémonie', desc: 'Atteindre 2000 Elo contre les bots.', tier: 3, value: (c) => (botPeak(c) >= 2000 ? 1 : 0) },
  { id: 'all-modes', cat: 'progress', icon: '🔪', title: 'Couteau suisse', desc: 'Essayer tous les modes : bots, 1v1, en ligne, problèmes, cours, review et Rush.', tier: 2, target: 7, value: modesTried },

  /* ----- Quetes et assiduite ----- */
  { id: 'quest-1', cat: 'progress', icon: '🎯', title: 'En quête de gloire', desc: 'Terminer ta première quête du jour.', tier: 1, value: (c) => ev(c, 'quest-done') },
  { id: 'quest-50', cat: 'progress', icon: '🗺️', title: 'Quêteur de fortune', desc: 'Terminer 50 quêtes du jour.', tier: 2, target: 50, value: (c) => ev(c, 'quest-done') },
  { id: 'quest-200', cat: 'progress', icon: '🧭', title: 'Chevalier de la Table ronde… carrée', desc: 'Terminer 200 quêtes du jour.', tier: 3, target: 200, value: (c) => ev(c, 'quest-done') },
  { id: 'chest-7', cat: 'progress', icon: '🎁', title: 'Coffre-fort de caractère', desc: 'Ouvrir le coffre du jour 7 jours d’affilée.', tier: 2, target: 7, value: (c) => ev(c, 'chest-streak') },
  { id: 'chest-30', cat: 'progress', icon: '💎', title: 'Fidèle au poste', desc: 'Ouvrir le coffre du jour 30 jours d’affilée.', tier: 3, target: 30, value: (c) => ev(c, 'chest-streak') },

  /* ----- Insolite ----- */
  { id: 'focus-1', cat: 'fun', icon: '🖥️', title: 'Plein écran, plein élan', desc: 'Jouer en plein écran.', tier: 1, value: (c) => ev(c, 'focus') },
  { id: 'focus-20', cat: 'fun', icon: '🫧', title: 'Bulle d’échecs', desc: 'Passer 20 fois en plein écran.', tier: 2, target: 20, value: (c) => ev(c, 'focus') },
  { id: 'premove-3', cat: 'fun', icon: '🔮', title: 'Trois coups d’avance', desc: 'Préparer 3 premoves à la suite.', tier: 1, target: 3, value: (c) => ev(c, 'premove-max') },
  { id: 'premove-6', cat: 'fun', icon: '🪄', title: 'Boule de cristal', desc: 'Préparer 6 premoves à la suite.', tier: 2, target: 6, value: (c) => ev(c, 'premove-max') },
  { id: 'premove-10', cat: 'fun', icon: '👁️', title: 'Voyant extralucide', desc: 'Préparer 10 premoves à la suite.', tier: 3, target: 10, secret: true, value: (c) => ev(c, 'premove-max') },
  { id: 'flip-10', cat: 'fun', icon: '🙃', title: 'Le monde à l’envers', desc: 'Retourner le plateau 10 fois.', tier: 1, target: 10, value: (c) => ev(c, 'flip') },
  { id: 'pgn-1', cat: 'fun', icon: '📋', title: 'Copie conforme', desc: 'Copier le PGN d’une partie.', tier: 1, value: (c) => ev(c, 'pgn') },
  { id: 'pause-10', cat: 'fun', icon: '☕', title: 'Pause-café', desc: 'Mettre une partie en pause 10 fois.', tier: 1, target: 10, value: (c) => ev(c, 'pause') },
  { id: 'anim-off', cat: 'fun', icon: '🎞️', title: 'Arrêt sur image', desc: 'Couper les skins animés.', tier: 1, secret: true, value: (c) => ev(c, 'anim-off') },
  { id: 'night', cat: 'fun', icon: '🦉', title: 'Insomni-échecs', desc: 'Jouer une partie entre minuit et 5 h du matin.', tier: 1, value: (c) => count(everyGame(c), (g) => at(g).getHours() < 5) },
  { id: 'morning', cat: 'fun', icon: '🌅', title: 'Mat-inal', desc: 'Gagner une partie avant 7 h du matin.', tier: 1, value: (c) => count(everyGame(c), (g) => g.result === 'win' && at(g).getHours() >= 5 && at(g).getHours() < 7) },
  { id: 'weekend-20', cat: 'fun', icon: '🛋️', title: 'Samedi soir sur l’échiquier', desc: 'Jouer 20 parties le week-end.', tier: 1, target: 20, value: (c) => count(everyGame(c), (g) => [0, 6].includes(at(g).getDay())) },
  { id: 'xmas', cat: 'fun', icon: '🎄', title: 'Mat de Noël', desc: 'Jouer une partie le 25 décembre.', tier: 2, secret: true, value: (c) => onDay(c, 11, 25) },
  { id: 'newyear', cat: 'fun', icon: '🥂', title: 'Bonne année, bon mat', desc: 'Jouer une partie le 1er janvier.', tier: 2, secret: true, value: (c) => onDay(c, 0, 1) },
  { id: 'april', cat: 'fun', icon: '🐟', title: 'Poisson d’échecs', desc: 'Jouer une partie le 1er avril.', tier: 2, secret: true, value: (c) => onDay(c, 3, 1) },
  { id: 'friday13', cat: 'fun', icon: '🐈‍⬛', title: 'Vendredi 13, mat 1', desc: 'Gagner une partie un vendredi 13.', tier: 2, secret: true, value: (c) => count(everyGame(c), (g) => g.result === 'win' && at(g).getDay() === 5 && at(g).getDate() === 13) },
  { id: 'day-15', cat: 'fun', icon: '🔁', title: 'Un jour sans fin', desc: 'Jouer 15 parties dans la même journée.', tier: 2, target: 15, value: busiestDay },
];
