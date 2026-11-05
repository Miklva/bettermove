// Historique date des statistiques d'un profil : sert au detail d'une stat (periode, pourcentage, graphe).
// Meme format cote serveur (server/src/profile.js, fonction timeline).
import type { SavedGame } from '../review/store';
import type { Profile } from '../rating/profile';

export type Res = 'win' | 'draw' | 'loss';

export interface Timeline {
  /** Parties enregistrees : [date ms, resultat, source, couleur] */
  games: [number, Res, string, 'w' | 'b'][];
  /** Parties en ligne : [date ms, resultat, Elo apres la partie ou null si non classee] */
  online: [number, Res, number | null][];
  /** Parties contre les bots : [date ms, resultat, Elo apres] */
  bots: [number, Res, number][];
  /** Problemes : [date ms ou null (anciens), reussi, Elo apres] */
  puzzles: [number | null, boolean, number][];
  /** Probleme du jour : [jour ms, reussi, du premier coup] */
  daily: [number, boolean, boolean][];
  /** Puzzle Rush : [date ms, mode, score] */
  rush: [number, string, number][];
  /** Lecons terminees : [date ms, etoiles] */
  lessons: [number, number][];
  /** Succes debloques : [date ms, id du succes] */
  achievements: [number, string][];
}

export const emptyTimeline = (): Timeline => ({ games: [], online: [], bots: [], puzzles: [], daily: [], rush: [], lessons: [], achievements: [] });

const ms = (iso?: string | null) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

export function gameResult(g: SavedGame): Res | null {
  const me = g.userColor === 'b' ? 'b' : 'w';
  if (g.result === '1/2-1/2') return 'draw';
  if (g.result === (me === 'w' ? '1-0' : '0-1')) return 'win';
  if (!g.result || g.result === '*') return null;
  return 'loss';
}

/** Elo apres chaque probleme, en remontant depuis l'Elo actuel (l'historique va du plus recent au plus ancien) */
export function puzzleSeries(p: Pick<Profile, 'puzzles' | 'puzzleHistory'>): Timeline['puzzles'] {
  let r = Math.round(p.puzzles.rating);
  const out: Timeline['puzzles'] = [];
  for (const h of p.puzzleHistory ?? []) {
    out.push([ms(h.at), !!h.win && !h.assisted, r]);
    r -= h.delta ?? 0;
  }
  return out.reverse();
}

export function buildTimeline(
  p: Profile,
  games: SavedGame[],
  achievements: Record<string, string>,
  daily: Record<string, { solved: boolean; firstTry: boolean }>,
  rush: { mode: string; score: number; at: string }[],
): Timeline {
  const t = emptyTimeline();
  for (const g of games) {
    if (g.observer || g.coachSide === 'none') continue;
    const r = gameResult(g);
    const at = ms(g.playedAt ?? g.date);
    if (r && at) t.games.push([at, r, g.source ?? 'autre', g.userColor === 'b' ? 'b' : 'w']);
  }
  for (const h of p.history ?? []) {
    const at = ms(h.date);
    if (at) t.bots.push([at, h.score === 1 ? 'win' : h.score === 0.5 ? 'draw' : 'loss', Math.round(h.after)]);
  }
  t.puzzles = puzzleSeries(p);
  for (const [day, d] of Object.entries(daily)) {
    const at = ms(`${day}T12:00:00`);
    if (at) t.daily.push([at, !!d.solved, !!d.firstTry]);
  }
  for (const r of rush) {
    const at = ms(r.at);
    if (at) t.rush.push([at, r.mode, r.score]);
  }
  for (const l of Object.values(p.lessons ?? {})) {
    const at = ms(l.at);
    if (at) t.lessons.push([at, l.stars]);
  }
  for (const [id, iso] of Object.entries(achievements)) {
    const at = ms(iso);
    if (at) t.achievements.push([at, id]);
  }
  for (const k of Object.keys(t) as (keyof Timeline)[]) (t[k] as unknown as (number | null)[][]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
  return t;
}
