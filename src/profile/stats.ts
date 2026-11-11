// Donnees d'une page profil : depuis le serveur (/api/profile/:pseudo) ou construites localement (sans compte)
import { load } from '../lib/storage';
import { listGames, type SavedGame } from '../review/store';
import { loadRush } from '../rush/store';
import { loadRep } from '../repertoire/store';
import type { Profile } from '../rating/profile';
import { buildTimeline, type Timeline } from './timeline';

export type R = 'win' | 'draw' | 'loss';
export interface WDL {
  win: number;
  draw: number;
  loss: number;
}

export interface GamesSummary {
  total: number;
  bySource: Record<string, number>;
  results: WDL;
  asWhite: WDL;
  asBlack: WDL;
  openings: (WDL & { name: string; n: number })[];
  recent: R[];
}

export interface ProfileData {
  username: string;
  self: boolean;
  createdAt?: string;
  lastSeen?: string | null;
  online?: boolean;
  profile: {
    bots: { rating: number; rd: number };
    puzzles: { rating: number; rd: number };
    puzzleStats?: { solved: number; failed: number; streak: number; bestStreak: number };
    xp: number;
    lessons: Record<string, { stars: number }>;
    beaten: string[];
    botCurve: number[];
    puzzleCurve: number[];
  } | null;
  achievements: Record<string, string>;
  repertoire: string[];
  owned: number;
  /** Skins portes (absent sur un ancien serveur) */
  equipped?: { pieces: string; sounds: string; board: string; boardOwned: boolean };
  onlineElo: { rating: number; games: number } | null;
  onlineRecord: WDL;
  recentOnline: { opponent: string; result: R; delta: number | null; at: string }[];
  games: GamesSummary;
  daily: { attempts: number; solved: number; firstTry: number; bestStreak: number };
  rush: Record<string, { best: number; runs: number }>;
  ranks: { online: number | null; bots: number | null; puzzles: number | null };
  /** Historique date, pour le detail des stats (absent sur un ancien serveur) */
  timeline?: Timeline;
  /** Construit depuis ce navigateur (pas de serveur) */
  local?: boolean;
}

const empty = (): WDL => ({ win: 0, draw: 0, loss: 0 });

/** Meme calcul que server/src/profile.js */
export function summarizeGames(list: SavedGame[]): GamesSummary {
  const out: GamesSummary = { total: 0, bySource: {}, results: empty(), asWhite: empty(), asBlack: empty(), openings: [], recent: [] };
  const ops: Record<string, WDL & { n: number }> = {};
  const sorted = list
    .filter((g) => !g.observer && g.coachSide !== 'none')
    .sort((a, b) => (b.playedAt ?? b.date ?? '').localeCompare(a.playedAt ?? a.date ?? ''));
  for (const g of sorted) {
    const me = g.userColor === 'b' ? 'b' : 'w';
    const r: R | null =
      g.result === '1/2-1/2' ? 'draw' : g.result === (me === 'w' ? '1-0' : '0-1') ? 'win' : g.result === '*' || !g.result ? null : 'loss';
    out.total++;
    out.bySource[g.source ?? 'autre'] = (out.bySource[g.source ?? 'autre'] ?? 0) + 1;
    if (!r) continue;
    out.results[r]++;
    out[me === 'w' ? 'asWhite' : 'asBlack'][r]++;
    if (g.opening) {
      const o = (ops[g.opening] ??= { ...empty(), n: 0 });
      o[r]++;
      o.n++;
    }
    if (out.recent.length < 20) out.recent.push(r);
  }
  out.openings = Object.entries(ops)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6)
    .map(([name, o]) => ({ name, ...o }));
  return out;
}

function streakBest(days: string[]) {
  let best = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const d of [...days].sort()) {
    const t = Date.parse(`${d}T12:00:00Z`);
    cur = prev !== null && t - prev === 86400_000 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

/** Profil a partir des donnees de ce navigateur */
export function localProfile(username: string, p: Profile): ProfileData {
  const daily = load<{ days: Record<string, { solved: boolean; firstTry: boolean }> }>('bettermove.daily.v1', { days: {} }).days;
  const rush = loadRush();
  const shop = load<{ owned?: string[] }>('bettermove.shop.v1', {});
  const achievements = load<Record<string, string>>('bettermove.achievements.v1', {});
  const rushOut: ProfileData['rush'] = {};
  for (const [mode, best] of Object.entries(rush.best)) rushOut[mode] = { best: best ?? 0, runs: rush.runs.filter((r) => r.mode === mode).length };
  return {
    username,
    self: true,
    local: true,
    profile: {
      bots: p.bots,
      puzzles: p.puzzles,
      puzzleStats: p.puzzleStats,
      xp: p.xp,
      lessons: p.lessons,
      beaten: p.beaten,
      botCurve: p.history.slice(0, 60).reverse().map((g) => Math.round(g.after)),
      puzzleCurve: p.puzzleHistory.slice(0, 60).reverse().map((h) => h.rating),
    },
    achievements,
    repertoire: loadRep().chosen,
    owned: shop.owned?.length ?? 0,
    onlineElo: null,
    onlineRecord: empty(),
    recentOnline: [],
    games: summarizeGames(listGames()),
    daily: {
      attempts: Object.keys(daily).length,
      solved: Object.values(daily).filter((d) => d.solved).length,
      firstTry: Object.values(daily).filter((d) => d.firstTry).length,
      bestStreak: streakBest(Object.entries(daily).filter(([, d]) => d.solved).map(([k]) => k)),
    },
    rush: rushOut,
    ranks: { online: null, bots: null, puzzles: null },
    timeline: buildTimeline(p, listGames(), achievements, daily, rush.runs),
  };
}
