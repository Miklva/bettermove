// Mode Professeur : reperes visuels (pieces en prise, cibles) et reglages persistants.
import { Chess, type Square } from 'chess.js';
import { load, save } from '../lib/storage';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export interface TeacherOptions {
  evalBar: boolean;
  arrows: boolean;
  /** Commenter aussi les coups du professeur (menaces) */
  profComments: boolean;
}

const KEY = 'bettermove.teacher.v1';
export const loadTeacherOptions = () =>
  load<TeacherOptions>(KEY, { evalBar: true, arrows: true, profComments: true });
export const saveTeacherOptions = (o: TeacherOptions) => save(KEY, o);

/**
 * Pieces de `color` en danger : attaquees et non defendues, ou attaquees par une piece de moindre valeur.
 * Le roi est exclu (l'echec se voit deja).
 */
export function piecesInDanger(fen: string, color: 'w' | 'b'): Square[] {
  const c = new Chess(fen);
  const them = color === 'w' ? 'b' : 'w';
  const out: Square[] = [];
  for (const row of c.board())
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const attackers = c.attackers(p.square, them);
      if (!attackers.length) continue;
      const defenders = c.attackers(p.square, color);
      const cheapest = Math.min(...attackers.map((sq) => VALUE[c.get(sq)?.type ?? 'k']));
      if (!defenders.length || cheapest < VALUE[p.type]) out.push(p.square);
    }
  return out;
}

export const uciToShape = (uci: string, brush: string) => ({ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush });
export const circle = (sq: string, brush: string) => ({ orig: sq, brush });

export const PIECE_FR: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
