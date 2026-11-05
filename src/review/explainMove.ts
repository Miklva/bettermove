// Explications pedagogiques d'un coup de la partie (review) et detection des menaces.
import { Chess } from 'chess.js';
import { engine } from '../engine/stockfish';
import { detectMotifs, fmtEval, material, play, the, type P } from '../puzzles/explain';
import { formatLine, formatSan, type Notation } from '../lib/notation';
import { CATEGORY, wpWhite, type MoveReview, type PlyInfo, type PosEval } from './analysis';

export interface MoveExplanation {
  title: string;
  points: string[];
  /** Meilleur coup qu'il fallait jouer (si different du coup joue) */
  better?: { uci: string; san: string; line: string };
}

const COLOR_NAME = { w: 'Blancs', b: 'Noirs' };

function evalFor(e: PosEval, color: 'w' | 'b'): string {
  const sign = color === 'w' ? 1 : -1;
  if (e.mate === undefined && Math.abs(e.cp) >= 1500) return sign * e.cp > 0 ? 'gagnant' : 'perdant';
  return fmtEval(sign * e.cp, e.mate !== undefined ? sign * e.mate : undefined);
}

/** Ce que gagne une ligne (materiel ou mat) pour le camp `color`, en 4 demi-coups */
function lineGain(fen: string, pv: string[], color: 'w' | 'b'): { gain: number; mate: boolean; captures: P[] } {
  const c = new Chess(fen);
  const before = material(c, color);
  const captures: P[] = [];
  for (const u of pv.slice(0, 4)) {
    try {
      const m = play(c, u);
      if (m.captured && m.color === color) captures.push(m.captured as P);
    } catch {
      break;
    }
    if (c.isCheckmate()) return { gain: 100, mate: true, captures };
  }
  return { gain: material(c, color) - before, mate: false, captures };
}

export function explainMove(
  ply: PlyInfo,
  review: MoveReview,
  before: PosEval,
  after: PosEval,
  notation: Notation,
  opening: string | null,
): MoveExplanation {
  const cat = CATEGORY[review.category];
  const san = formatSan(ply.san, notation);
  const them = ply.color === 'w' ? 'b' : 'w';
  const points: string[] = [];
  const title = `${san} : ${cat.label}`;

  if (review.category === 'book') {
    points.push(`Coup théorique${opening ? ` : ${opening.replace(/^[A-E]\d\d /, '')}` : ''}. Ce coup fait partie des ouvertures connues.`);
    return { title, points };
  }
  if (review.category === 'forced') {
    points.push('C’était le seul coup légal.');
    return { title, points };
  }

  // Motif du coup joue
  const b = new Chess(ply.fenBefore);
  const a = new Chess(ply.fenAfter);
  const motifs = detectMotifs(b, ply.move, a, after.best);
  const bestSan = (() => {
    if (!before.best) return '';
    try {
      return formatSan(new Chess(ply.fenBefore).move({ from: before.best.slice(0, 2), to: before.best.slice(2, 4), promotion: before.best[4] }).san, notation);
    } catch {
      return '';
    }
  })();

  if (cat.good) {
    if (review.category === 'brilliant') points.push('Sacrifice brillant : tu donnes du matériel, mais c’est le meilleur coup de la position.');
    if (review.category === 'great') points.push('Le seul bon coup de la position : les autres coups perdaient l’avantage.');
    if (motifs[0] && motifs[0].key !== 'check') points.push(motifs[0].text);
    if (review.category === 'best') points.push('C’est le coup que joue Stockfish.');
    else if (review.category === 'excellent' || review.category === 'good')
      points.push(`Très proche du meilleur coup${bestSan && bestSan !== san ? ` (${bestSan})` : ''}.`);
    points.push(`Évaluation : ${evalFor(after, ply.color)}.`);
    return { title, points };
  }

  // Mauvais coup : pourquoi, puis ce qu'il fallait faire
  const reply = after.pv;
  const replyGain = lineGain(ply.fenAfter, reply, them);
  const replySan = (() => {
    if (!reply[0]) return '';
    try {
      return formatSan(new Chess(ply.fenAfter).move({ from: reply[0].slice(0, 2), to: reply[0].slice(2, 4), promotion: reply[0][4] }).san, notation);
    } catch {
      return '';
    }
  })();

  // Ce que le meilleur coup apportait (motif tactique, materiel, mat)
  const STRONG = new Set(['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'promotion']);
  let bestIdea = '';
  let bestMotifText = '';
  if (before.best && bestSan && before.best !== ply.uci) {
    const c = new Chess(ply.fenBefore);
    const bm = play(c, before.best);
    const strong = detectMotifs(new Chess(ply.fenBefore), bm, c, before.pv[1]).find((m) => STRONG.has(m.key));
    const bestGain = lineGain(ply.fenBefore, before.pv, ply.color);
    const playedGain = lineGain(ply.fenBefore, [ply.uci, ...after.pv], ply.color);
    if (before.mate !== undefined && (ply.color === 'w' ? before.mate > 0 : before.mate < 0))
      bestIdea = `${bestSan} matait en ${Math.abs(before.mate)}`;
    else if (strong) {
      bestIdea = `${bestSan} (${strong.text.split(' : ')[0].toLowerCase()})`;
      bestMotifText = strong.text;
    } else if (bestGain.gain - playedGain.gain >= 2)
      bestIdea = `${bestSan}, qui gagnait ${bestGain.gain - playedGain.gain} points de matériel`;
  }

  if (after.mate !== undefined && (ply.color === 'w' ? after.mate < 0 : after.mate > 0)) {
    points.push(`Ce coup permet un mat en ${Math.abs(after.mate)} : ${formatLine(ply.fenAfter, reply, notation, 6)}.`);
  } else if (replyGain.gain >= 2) {
    const piece = replyGain.captures[0];
    points.push(
      `L’adversaire répond ${replySan} et gagne ${replyGain.gain} point${replyGain.gain > 1 ? 's' : ''} de matériel${piece ? ` (il prend ${the(piece)})` : ''}.`,
    );
    points.push(`Suite probable : ${formatLine(ply.fenAfter, reply, notation, 5)}`);
  } else if (bestIdea) {
    points.push(`Tu laisses passer ${bestIdea}.`);
  } else if (review.category === 'miss') {
    points.push('Tu avais une position gagnante et ce coup laisse filer une grosse partie de l’avantage.');
  } else if (review.category === 'inaccuracy') {
    points.push(`Pas une grosse faute, mais ${bestSan || 'un autre coup'} était plus précis.`);
  } else if (replySan) {
    points.push(`L’adversaire prend l’avantage avec ${replySan}.`);
  }

  if (bestSan && before.best !== ply.uci) {
    if (bestMotifText) points.push(bestMotifText);
    if (!bestIdea || replyGain.gain >= 2) points.push(`Le meilleur coup était ${bestSan} : ${formatLine(ply.fenBefore, before.pv, notation, 5)}`);
  }
  points.push(`Évaluation : ${evalFor(before, ply.color)} avant, ${evalFor(after, ply.color)} après ton coup.`);

  return {
    title,
    points,
    better:
      before.best && before.best !== ply.uci
        ? { uci: before.best, san: bestSan, line: formatLine(ply.fenBefore, before.pv, notation, 6) }
        : undefined,
  };
}

export interface Threat {
  uci: string;
  text: string;
}

/**
 * Menace : ce que jouerait le camp qui n'a pas le trait s'il pouvait rejouer tout de suite.
 * On analyse la position en passant le trait (coup nul) et on garde la menace si elle gagne nettement.
 */
export async function findThreat(fen: string, current: PosEval | undefined, notation: Notation): Promise<Threat | null> {
  const c = new Chess(fen);
  if (c.inCheck() || c.isGameOver()) return null;
  const parts = fen.split(' ');
  const mover = parts[1] === 'w' ? 'b' : 'w';
  parts[1] = mover;
  parts[3] = '-';
  const nullFen = parts.join(' ');
  let test: Chess;
  try {
    test = new Chess(nullFen);
  } catch {
    return null;
  }
  if (test.inCheck()) {
    // Le camp qui passe son tour serait deja en echec : position impossible, pas de menace a montrer
    return null;
  }
  const [line] = await engine.analyse(nullFen, { depth: 10 });
  if (!line) return null;
  const gain = lineGain(nullFen, line.pv, mover);
  const isMate = line.mate !== undefined && line.mate > 0;
  // Comparaison avec l'evaluation actuelle (du point de vue du camp qui menace)
  const nowWp = current ? (mover === 'w' ? wpWhite(current) : 1 - wpWhite(current)) : 0.5;
  const threatWp = isMate ? 1 : 1 / (1 + Math.exp(-0.00368208 * line.cp));
  if (!isMate && gain.gain < 2 && threatWp - nowWp < 0.15) return null;
  let san = '';
  try {
    san = formatSan(new Chess(nullFen).move({ from: line.move.slice(0, 2), to: line.move.slice(2, 4), promotion: line.move[4] }).san, notation);
  } catch {
    return null;
  }
  const who = COLOR_NAME[mover];
  const text = isMate
    ? `Menace des ${who} : ${san} avec un mat en ${line.mate}.`
    : gain.captures[0]
      ? `Menace des ${who} : ${san}, qui gagne ${the(gain.captures[0])}${gain.gain >= 2 ? ` (${gain.gain} points)` : ''}.`
      : `Menace des ${who} : ${san}.`;
  return { uci: line.move, text };
}
