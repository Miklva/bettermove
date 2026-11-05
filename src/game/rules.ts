import type { Chess } from 'chess.js';
import type { Color, GameResult } from './types';

export const COLOR_NAME: Record<Color, string> = { w: 'Blancs', b: 'Noirs' };
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** Detection de fin de partie apres un coup */
export function detectResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) {
    const winner = other(chess.turn());
    return { winner, reason: 'Échec et mat' };
  }
  if (chess.isStalemate()) return { winner: null, reason: 'Pat' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'Matériel insuffisant' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'Triple répétition' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'Règle des 50 coups' };
  return null;
}

/** Une couleur peut-elle encore mater ? (utile quand l'adversaire tombe au temps) */
export function hasMatingMaterial(fen: string, color: Color): boolean {
  const board = fen.split(' ')[0];
  const pieces = [...board].filter((ch) => (color === 'w' ? /[PNBRQ]/.test(ch) : /[pnbrq]/.test(ch)));
  const lower = pieces.map((p) => p.toLowerCase());
  if (lower.some((p) => p === 'p' || p === 'r' || p === 'q')) return true;
  return lower.length >= 2;
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

export interface MaterialInfo {
  /** Pieces adverses capturees par chaque camp (lettres minuscules, triees) */
  captured: Record<Color, string[]>;
  /** Avantage materiel (positif = avantage) */
  diff: Record<Color, number>;
}

export function materialFromFen(fen: string): MaterialInfo {
  const board = fen.split(' ')[0];
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } } as Record<
    Color,
    Record<string, number>
  >;
  let score = { w: 0, b: 0 };
  for (const ch of board) {
    const low = ch.toLowerCase();
    if (!(low in VALUES)) continue;
    const c: Color = ch === low ? 'b' : 'w';
    count[c][low]++;
    score = { ...score, [c]: score[c] + VALUES[low] };
  }
  const order = ['q', 'r', 'b', 'n', 'p'];
  const capturedBy = (c: Color) => {
    const opp = other(c);
    const out: string[] = [];
    for (const p of order) {
      const missing = Math.max(0, START[p] - count[opp][p]);
      for (let i = 0; i < missing; i++) out.push(p);
    }
    return out;
  };
  return {
    captured: { w: capturedBy('w'), b: capturedBy('b') },
    diff: { w: score.w - score.b, b: score.b - score.w },
  };
}
