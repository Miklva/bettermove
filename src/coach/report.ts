// Points faibles : catalogue, conseils, et calcul de l'evolution d'une periode a l'autre.
import { load, save } from '../lib/storage';
import type { SavedGame } from '../review/store';
import type { ErrorRec, GameAnalysis, WeakId } from './analyze';
import { openingFr } from '../history/names';
import { t as tr } from '../i18n';

export interface WeakDef {
  id: WeakId;
  icon: string;
  title: string;
  /** Explication courte de la famille d'erreurs */
  what: string;
  tips: string[];
  /** Themes de problemes (base Lichess) */
  themes: string[];
  /** Lecons BetterMove conseillees */
  lessons: string[];
  /** Poids dans le classement (gravite) */
  weight: number;
}

export const WEAKNESSES: Record<WeakId, WeakDef> = {
  hanging: {
    id: 'hanging',
    icon: '🎁',
    title: 'Pièces laissées en prise',
    what: 'Tu joues un coup qui laisse une pièce se faire prendre gratuitement.',
    tips: [
      'Avant de lâcher la pièce, fais la vérification anti-gaffe : la case d’arrivée est-elle attaquée ? Est-elle défendue ?',
      'Compte attaquants et défenseurs : si l’adversaire attaque plus que tu ne défends, la pièce tombe.',
      'Attention aux pièces que ton coup ne défend plus (le cavalier qui part laisse souvent un pion ou une pièce seule).',
    ],
    themes: ['hangingPiece'],
    lessons: ['hanging'],
    weight: 1.3,
  },
  ignoredThreat: {
    id: 'ignoredThreat',
    icon: '🙈',
    title: 'Menaces adverses ignorées',
    what: 'L’adversaire attaquait déjà quelque chose et ton coup n’a rien réglé.',
    tips: [
      'Après chaque coup adverse, pose-toi une seule question avant tout le reste : « que menace-t-il ? »',
      'Liste ce qu’attaque la pièce qui vient de bouger, et ce qu’elle a démasqué derrière elle.',
      'Face à une menace : déplacer, défendre, bloquer ou contre-attaquer plus fort. Choisis consciemment.',
    ],
    themes: ['defensiveMove'],
    lessons: ['hanging', 'discovered'],
    weight: 1.25,
  },
  missedTactic: {
    id: 'missedTactic',
    icon: '🎯',
    title: 'Tactiques manquées',
    what: 'Une fourchette, un clouage ou une enfilade gagnait du matériel et tu ne l’as pas vue.',
    tips: [
      'Cherche d’abord les coups forcés : échecs, prises, menaces. Dans cet ordre.',
      'Repère les pièces adverses non défendues et le roi mal placé : ce sont les cibles des tactiques.',
      'Deux pièces adverses sur une même ligne ou à un saut de cavalier ? Il y a peut-être un clouage ou une fourchette.',
    ],
    themes: ['fork', 'pin', 'skewer', 'discoveredAttack'],
    lessons: ['fork', 'pin', 'skewer', 'discovered'],
    weight: 1.1,
  },
  missedMate: {
    id: 'missedMate',
    icon: '♚',
    title: 'Mats manqués',
    what: 'Tu avais un mat forcé sur l’échiquier et tu as joué autre chose.',
    tips: [
      'Quand le roi adverse a peu de cases, regarde tous les échecs possibles, même ceux qui sacrifient une pièce.',
      'Mémorise les schémas : mat du couloir, mat à l’étouffée, dame + fou sur h7.',
      'Un mat rapporte plus que n’importe quel gain de matériel : vérifie-le avant de prendre.',
    ],
    themes: ['mateIn1', 'mateIn2'],
    lessons: ['mate1', 'mate2', 'backrank'],
    weight: 1.2,
  },
  allowedMate: {
    id: 'allowedMate',
    icon: '🛡️',
    title: 'Roi en danger',
    what: 'Ton coup permet à l’adversaire de forcer le mat.',
    tips: [
      'Roque tôt et ne pousse pas les pions devant ton roi sans raison.',
      'Garde une case de fuite à ton roi (h3 ou g3 par exemple) pour éviter le mat du couloir.',
      'Quand l’adversaire amène plusieurs pièces vers ton roi, défends avant de poursuivre ton plan.',
    ],
    themes: ['defensiveMove', 'backRankMate'],
    lessons: ['backrank', 'castling-tricks'],
    weight: 1.3,
  },
  positional: {
    id: 'positional',
    icon: '🧭',
    title: 'Mauvais plans',
    what: 'Pas de gaffe directe, mais un coup qui abîme la position (pièce mal placée, faiblesse, temps perdu).',
    tips: [
      'Trouve ta pièce la moins active et améliore-la.',
      'Ne crée pas de faiblesses sans raison : chaque coup de pion est définitif.',
      'Demande-toi quel est le plan adverse et gêne-le.',
    ],
    themes: ['quietMove'],
    lessons: ['center', 'develop'],
    weight: 0.7,
  },
  opening: {
    id: 'opening',
    icon: '📖',
    title: 'Erreurs dans l’ouverture',
    what: 'Des erreurs dans les 10 premiers coups.',
    tips: [
      'Applique les principes : centre, développement des pièces mineures, roque, puis tours connectées.',
      'Ne sors pas la dame trop tôt et ne joue pas deux fois la même pièce sans raison.',
      'Apprends les premiers coups de tes ouvertures et surtout leurs idées (et les pièges classiques).',
    ],
    themes: ['opening'],
    lessons: ['develop', 'traps', 'early-queen'],
    weight: 1,
  },
  endgame: {
    id: 'endgame',
    icon: '🏁',
    title: 'Erreurs en finale',
    what: 'Des erreurs quand il reste peu de pièces.',
    tips: [
      'En finale, le roi est une pièce d’attaque : centralise-le.',
      'Connais l’opposition et la règle du carré pour les finales de pions.',
      'Un pion passé doit avancer : soutiens-le avec le roi ou une tour derrière lui.',
    ],
    themes: ['endgame', 'pawnEndgame'],
    lessons: ['square', 'opposition', 'key-squares'],
    weight: 1,
  },
  conversion: {
    id: 'conversion',
    icon: '💸',
    title: 'Avantage gâché',
    what: 'Tu étais clairement gagnant et un coup a laissé filer l’avantage.',
    tips: [
      'Quand tu as du matériel en plus, échange les pièces (pas les pions) pour simplifier.',
      'Ne relâche pas l’attention : vérifie les menaces adverses encore plus quand tu gagnes.',
      'Cherche le coup le plus sûr plutôt que le plus spectaculaire.',
    ],
    themes: ['advantage'],
    lessons: ['kq', 'kr'],
    weight: 1.15,
  },
  time: {
    id: 'time',
    icon: '⏱️',
    title: 'Gestion du temps',
    what: 'Des parties perdues au temps.',
    tips: [
      'Joue plus vite les coups simples (reprises évidentes, coups d’ouverture connus).',
      'Garde une réserve : à 10 % de ton temps, passe en mode coups sûrs.',
      'Préfère des cadences avec incrément (10 | 5) le temps de prendre le rythme.',
    ],
    themes: [],
    lessons: [],
    weight: 0.9,
  },
};

export type Trend = 'new' | 'worse' | 'stable' | 'better' | 'resolved';

export interface WeakStat {
  def: WeakDef;
  count: number;
  /** Erreurs par partie, periode recente et periode precedente */
  recentRate: number;
  olderRate: number;
  trend: Trend;
  avgLoss: number;
  score: number;
  /** Detail le plus frequent (piece perdue, motif rate...) */
  topDetail?: { key: string; n: number };
  /** Ouverture ou se concentrent les erreurs (pour 'opening') */
  topOpening?: { name: string; n: number };
  errors: ErrorRec[];
  lastSeen?: string;
}

export interface Report {
  games: number;
  recentGames: number;
  olderGames: number;
  errorsPerGame: number;
  stats: WeakStat[];
}

const byDate = (a: { playedAt?: string }, b: { playedAt?: string }) => (a.playedAt ?? '').localeCompare(b.playedAt ?? '');

export function buildReport(analyses: GameAnalysis[], games: SavedGame[]): Report {
  const list = analyses.slice().sort(byDate);
  const n = list.length;
  // Periode recente : le dernier tiers (au moins 3 parties, au plus 10)
  const recentN = n < 6 ? n : Math.max(3, Math.min(10, Math.round(n / 3)));
  const recent = list.slice(n - recentN);
  const older = list.slice(0, n - recentN);
  const ids = (l: GameAnalysis[]) => new Set(l.map((a) => a.id));
  const recentIds = ids(recent);

  const all = list.flatMap((a) => a.errors.map((e) => ({ e, a })));
  const stats: WeakStat[] = [];
  for (const def of Object.values(WEAKNESSES)) {
    let errs: ErrorRec[];
    let recentCount: number;
    let olderCount: number;
    if (def.id === 'time') {
      // Defaites au temps (sur les parties analysees)
      const lost = (l: GameAnalysis[]) => l.filter((a) => a.result === 'loss' && a.end === 'time').length;
      recentCount = lost(recent);
      olderCount = lost(older);
      errs = [];
      if (!recentCount && !olderCount) continue;
    } else {
      const mine = all.filter((x) => x.e.types.includes(def.id));
      if (!mine.length) continue;
      errs = mine.map((x) => x.e);
      recentCount = mine.filter((x) => recentIds.has(x.a.id)).length;
      olderCount = mine.length - recentCount;
    }
    const recentRate = recent.length ? recentCount / recent.length : 0;
    const olderRate = older.length ? olderCount / older.length : recentRate;
    let trend: Trend = 'stable';
    if (older.length >= 3) {
      if (olderRate === 0 && recentRate > 0) trend = 'new';
      else if (recentRate === 0 && olderRate >= 0.2) trend = 'resolved';
      else if (recentRate <= olderRate * 0.6) trend = 'better';
      else if (recentRate >= olderRate * 1.4 && recentRate - olderRate >= 0.15) trend = 'worse';
    }
    const avgLoss = errs.length ? errs.reduce((s, e) => s + e.loss, 0) / errs.length : 0.3;
    const details = new Map<string, number>();
    for (const e of errs) if (e.detail) details.set(e.detail, (details.get(e.detail) ?? 0) + 1);
    const top = [...details.entries()].sort((a, b) => b[1] - a[1])[0];
    let topOpening: WeakStat['topOpening'];
    if (def.id === 'opening') {
      const byOp = new Map<string, number>();
      for (const x of all.filter((y) => y.e.types.includes('opening'))) {
        const name = openingFr(x.a.opening) ?? tr('Hors théorie');
        byOp.set(name, (byOp.get(name) ?? 0) + 1);
      }
      const t = [...byOp.entries()].sort((a, b) => b[1] - a[1])[0];
      if (t) topOpening = { name: t[0], n: t[1] };
    }
    const lastSeen = all.filter((x) => x.e.types.includes(def.id)).map((x) => x.a.playedAt ?? '').sort().pop();
    stats.push({
      def,
      count: def.id === 'time' ? recentCount + olderCount : errs.length,
      recentRate,
      olderRate,
      trend,
      avgLoss,
      score: recentRate * def.weight * (0.5 + avgLoss),
      topDetail: top ? { key: top[0], n: top[1] } : undefined,
      topOpening,
      errors: errs.slice().reverse(),
      lastSeen,
    });
  }
  stats.sort((a, b) => b.score - a.score);
  void games;
  return {
    games: n,
    recentGames: recent.length,
    olderGames: older.length,
    errorsPerGame: n ? all.length / n : 0,
    stats,
  };
}

/* ---------------- Stockage ---------------- */

const ANALYSES_KEY = 'bettermove.coach.analyses.v1';
const SNAP_KEY = 'bettermove.coach.snapshots.v1';
const NOTES_KEY = 'bettermove.coach.notes.v1';
const MASTERED_KEY = 'bettermove.coach.mastered.v1';

export const listAnalyses = () => load<Record<string, GameAnalysis>>(ANALYSES_KEY, {});
export function saveAnalysis(a: GameAnalysis) {
  const all = listAnalyses();
  all[a.id] = a;
  // On garde les 150 parties les plus recentes
  const keep = Object.values(all).sort(byDate).slice(-150);
  save(ANALYSES_KEY, Object.fromEntries(keep.map((x) => [x.id, x])));
}
export const clearAnalyses = () => save(ANALYSES_KEY, {});

export interface Snapshot {
  at: string;
  top: { id: WeakId; rate: number }[];
}
export const listSnapshots = () => load<Snapshot[]>(SNAP_KEY, []);
/** Memorise le classement quand le trio de tete change (historique de l'evolution) */
export function recordSnapshot(r: Report) {
  const top = r.stats
    .filter((s) => s.def.id !== 'positional' && s.trend !== 'resolved')
    .slice(0, 3)
    .map((s) => ({ id: s.def.id, rate: Math.round(s.recentRate * 100) / 100 }));
  if (!top.length) return;
  const snaps = listSnapshots();
  const last = snaps[snaps.length - 1];
  if (last && last.top.map((t) => t.id).join() === top.map((t) => t.id).join()) return;
  save(SNAP_KEY, [...snaps, { at: new Date().toISOString(), top }].slice(-30));
}

export interface Notes {
  text: string;
  updatedAt?: string;
}
export const loadNotes = () => load<Notes>(NOTES_KEY, { text: '' });
export const saveNotes = (n: Notes) => save(NOTES_KEY, n);

export const listMastered = () => new Set(load<string[]>(MASTERED_KEY, []));
export function markMastered(id: string) {
  const s = listMastered();
  s.add(id);
  save(MASTERED_KEY, [...s].slice(-2000));
}
