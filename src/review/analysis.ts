// Analyse d'une partie complete avec Stockfish : evaluation de chaque position,
// categorie de chaque coup (theorique, meilleur, imprecision, erreur, gaffe...), precision.
import { Chess, type Move } from 'chess.js';
import { engine, winChance } from '../engine/stockfish';
import { VAL, type P } from '../puzzles/explain';
import { loadBook, lookup } from './openings';
import { load, save } from '../lib/storage';

export type Category =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'forced';

export const CATEGORY: Record<Category, { label: string; symbol: string; color: string; good: boolean }> = {
  book: { label: 'Théorique', symbol: '📖', color: '#a88865', good: true },
  brilliant: { label: 'Brillant', symbol: '!!', color: '#1baca6', good: true },
  great: { label: 'Très bon coup', symbol: '!', color: '#5c8bb0', good: true },
  best: { label: 'Meilleur coup', symbol: '★', color: '#6ab04c', good: true },
  excellent: { label: 'Excellent', symbol: '👍', color: '#8bc34a', good: true },
  good: { label: 'Bon', symbol: '✓', color: '#96af8b', good: true },
  inaccuracy: { label: 'Imprécision', symbol: '?!', color: '#f0c419', good: false },
  mistake: { label: 'Erreur', symbol: '?', color: '#f39c12', good: false },
  miss: { label: 'Occasion manquée', symbol: '✕', color: '#e0703c', good: false },
  blunder: { label: 'Gaffe', symbol: '??', color: '#e5534b', good: false },
  forced: { label: 'Coup forcé', symbol: '→', color: '#9aa1b0', good: true },
};

/** Evaluation d'une position, toujours du point de vue des Blancs */
export interface PosEval {
  cp: number;
  mate?: number;
  /** Meilleur coup et ligne principale (UCI) */
  best?: string;
  pv: string[];
  /** Deuxieme meilleur coup (pour reperer les coups uniques) */
  secondCp?: number;
  depth: number;
}

export interface PlyInfo {
  /** 1 = premier coup des Blancs */
  index: number;
  san: string;
  uci: string;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  move: Move;
}

export interface MoveReview {
  category: Category;
  /** Perte de chances de gain (0 a 1) */
  loss: number;
  wpBefore: number;
  wpAfter: number;
  accuracy: number;
}

export interface GameData {
  headers: Record<string, string>;
  startFen: string;
  plies: PlyInfo[];
  /** fen de chaque position : positions[0] = depart */
  positions: string[];
}

export function parseGame(pgn: string): GameData {
  const c = new Chess();
  c.loadPgn(pgn.trim());
  const headers = c.getHeaders();
  const history = c.history({ verbose: true });
  const startFen = history[0]?.before ?? c.fen();
  const plies: PlyInfo[] = history.map((m, i) => ({
    index: i + 1,
    san: m.san,
    uci: m.lan,
    color: m.color,
    fenBefore: m.before,
    fenAfter: m.after,
    move: m,
  }));
  return { headers, startFen, plies, positions: [startFen, ...plies.map((p) => p.fenAfter)] };
}

/** Probabilite de gain des Blancs */
export function wpWhite(e: PosEval): number {
  // mate === 0 : position deja matee, le signe est porte par cp
  if (e.mate === 0) return e.cp > 0 ? 1 : 0;
  if (e.mate !== undefined) return e.mate > 0 ? 1 : 0;
  return winChance(e.cp);
}

function terminalEval(fen: string): PosEval | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { cp: c.turn() === 'w' ? -100_000 : 100_000, mate: 0, pv: [], depth: 99 };
  if (c.isDraw() || c.isStalemate()) return { cp: 0, pv: [], depth: 99 };
  return null;
}

const CACHE_KEY = 'bettermove.analysisCache.v1';
const DEPTH = 14;

function cacheKey(g: GameData) {
  return g.startFen + '|' + g.plies.map((p) => p.uci).join(' ');
}

/** Analyse toutes les positions ; onProgress recoit les evaluations au fur et a mesure */
export async function analyseGame(
  g: GameData,
  onProgress: (evals: (PosEval | undefined)[], done: number) => void,
  shouldStop: () => boolean,
): Promise<PosEval[] | null> {
  const key = cacheKey(g);
  const cache = load<{ key: string; evals: PosEval[] }[]>(CACHE_KEY, []);
  const hit = cache.find((c) => c.key === key);
  if (hit && hit.evals.length === g.positions.length) {
    onProgress(hit.evals, hit.evals.length);
    return hit.evals;
  }

  const evals: (PosEval | undefined)[] = Array(g.positions.length).fill(undefined);
  for (let i = 0; i < g.positions.length; i++) {
    if (shouldStop()) return null;
    const fen = g.positions[i];
    const term = terminalEval(fen);
    if (term) evals[i] = term;
    else {
      const lines = await engine.analyse(fen, { depth: DEPTH, movetime: 1500, multipv: 2 });
      const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
      const [l1, l2] = lines;
      evals[i] = {
        cp: sign * (l1?.cp ?? 0),
        mate: l1?.mate !== undefined ? sign * l1.mate : undefined,
        best: l1?.move,
        pv: (l1?.pv ?? []).slice(0, 10),
        secondCp: l2 ? sign * l2.cp : undefined,
        depth: l1?.depth ?? 0,
      };
    }
    onProgress([...evals], i + 1);
  }
  const final = evals as PosEval[];
  save(CACHE_KEY, [{ key, evals: final }, ...cache.filter((c) => c.key !== key)].slice(0, 12));
  return final;
}

/** Une piece de valeur est laissee sur une case attaquee, et l'adversaire a interet a la prendre */
function isSacrifice(ply: PlyInfo, replyUci?: string): boolean {
  const m = ply.move;
  const mover = (m.promotion ?? m.piece) as P;
  if (VAL[mover] < 3 || mover === 'k') return false;
  if (m.captured && VAL[m.captured as P] >= VAL[mover]) return false;
  const after = new Chess(ply.fenAfter);
  const them = ply.color === 'w' ? 'b' : 'w';
  if (!after.isAttacked(m.to, them)) return false;
  return !!replyUci && replyUci.slice(2, 4) === m.to;
}

export function accuracyOf(loss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

/** Classe un coup isole (utilise par la review et par le mode Professeur) */
export function classifyPly(ply: PlyInfo, before: PosEval, after: PosEval, inBook: boolean): MoveReview {
  const sideWp = (e: PosEval) => (ply.color === 'w' ? wpWhite(e) : 1 - wpWhite(e));
  const wpBefore = sideWp(before);
  const wpAfter = sideWp(after);
  const loss = Math.max(0, wpBefore - wpAfter);
  const legal = new Chess(ply.fenBefore).moves().length;

  let category: Category;
  const deliversMate = after.mate === 0;
  const isBest = deliversMate || ply.uci === before.best || loss <= 0.005;
  if (inBook) category = 'book';
  else if (legal === 1) category = 'forced';
  else if (isBest && !deliversMate && loss <= 0.02 && isSacrifice(ply, after.best) && wpBefore < 0.97 && wpAfter > 0.3) category = 'brilliant';
  else if (isBest) {
    // Coup unique : le deuxieme meilleur coup etait nettement moins bon
    const second = before.secondCp;
    const wpSecond = second === undefined ? null : ply.color === 'w' ? winChance(second) : 1 - winChance(second);
    category = wpSecond !== null && wpBefore - wpSecond > 0.15 && wpAfter > 0.4 ? 'great' : 'best';
  } else if (loss <= 0.02) category = 'excellent';
  else if (loss <= 0.05) category = 'good';
  else if (loss >= 0.1 && wpBefore >= 0.7 && wpAfter >= 0.3) category = 'miss';
  else if (loss <= 0.1) category = 'inaccuracy';
  else if (loss <= 0.2) category = 'mistake';
  else category = 'blunder';

  return { category, loss, wpBefore, wpAfter, accuracy: inBook ? 100 : accuracyOf(loss) };
}

/** Classe chaque coup a partir des evaluations */
export async function classify(g: GameData, evals: (PosEval | undefined)[]): Promise<(MoveReview | undefined)[]> {
  const book = await loadBook();
  let inBook = true;
  return g.plies.map((ply, k) => {
    const before = evals[k];
    const after = evals[k + 1];
    if (!before || !after) return undefined;
    inBook = inBook && k < 30 && lookup(book, ply.fenAfter) !== undefined;
    return classifyPly(ply, before, after, inBook);
  });
}

/** Evaluation d'une position (point de vue des Blancs), y compris mat et pat */
export async function evaluatePosition(fen: string, opts: { depth?: number; movetime?: number } = {}): Promise<PosEval> {
  const term = terminalEval(fen);
  if (term) return term;
  const lines = await engine.analyse(fen, { depth: opts.depth ?? 12, movetime: opts.movetime ?? 900, multipv: 2 });
  const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
  const [l1, l2] = lines;
  return {
    cp: sign * (l1?.cp ?? 0),
    mate: l1?.mate !== undefined ? sign * l1.mate : undefined,
    best: l1?.move,
    pv: (l1?.pv ?? []).slice(0, 10),
    secondCp: l2 ? sign * l2.cp : undefined,
    depth: l1?.depth ?? 0,
  };
}

/** Nom de l'ouverture : derniere position nommee du livre rencontree */
export async function openingName(g: GameData): Promise<string | null> {
  const book = await loadBook();
  let name: string | null = null;
  for (const fen of g.positions.slice(1, 40)) {
    const n = lookup(book, fen);
    if (n === undefined) break;
    if (n) name = n;
  }
  return name;
}

export function summary(g: GameData, reviews: (MoveReview | undefined)[]) {
  const out = { w: { accuracy: 0, counts: {} as Partial<Record<Category, number>> }, b: { accuracy: 0, counts: {} as Partial<Record<Category, number>> } };
  for (const color of ['w', 'b'] as const) {
    const mine = g.plies.map((p, i) => ({ p, r: reviews[i] })).filter((x) => x.p.color === color && x.r);
    out[color].accuracy = mine.length ? mine.reduce((s, x) => s + x.r!.accuracy, 0) / mine.length : 0;
    for (const x of mine) out[color].counts[x.r!.category] = (out[color].counts[x.r!.category] ?? 0) + 1;
  }
  return out;
}
