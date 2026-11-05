// Explications automatiques des problemes : pourquoi le bon coup marche, pourquoi un coup est faux.
// Combine des detecteurs de motifs tactiques (chess.js) et l'analyse de Stockfish.
import { Chess, type Move, type Square } from 'chess.js';
import { engine, winChance } from '../engine/stockfish';
import { formatLine, formatSan, type Notation } from '../lib/notation';
import { THEMES, visibleThemes } from './themes';
import type { Puzzle } from './db';

type C = 'w' | 'b';
export type P = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Shape {
  orig: string;
  dest?: string;
  brush: 'green' | 'red' | 'blue' | 'yellow' | 'paleGreen' | 'paleRed';
}

export interface Explanation {
  verdict: 'success' | 'fail' | 'soft' | 'solution';
  title: string;
  points: string[];
  /** Indice sur l'idee du bon coup (sans le donner) */
  hint?: string;
  /** Themes du probleme avec leur explication */
  themes: { label: string; tip?: string }[];
  shapes: Shape[];
}

export const VAL: Record<P, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<P, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const fem = (t: P) => t === 'r' || t === 'q';
export const the = (t: P) => (fem(t) ? 'la ' : 'le ') + NAME[t];
export const your = (t: P) => (fem(t) ? 'ta ' : 'ton ') + NAME[t];
export const a = (t: P) => (fem(t) ? 'une ' : 'un ') + NAME[t];
const e = (t: P) => (fem(t) ? 'e' : '');
const other = (c: C): C => (c === 'w' ? 'b' : 'w');
const SQUARES = 'abcdefgh'.split('').flatMap((f) => '12345678'.split('').map((r) => `${f}${r}` as Square));

/** Ajoute un point final sauf si la phrase finit deja par des points de suspension */
const dot = (t: string) => (t.endsWith('…') ? t : `${t}.`);

export function listFr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

export function play(c: Chess, uci: string): Move {
  return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

export function material(c: Chess, color: C): number {
  let s = 0;
  for (const row of c.board())
    for (const p of row) if (p && p.type !== 'k') s += (p.color === color ? 1 : -1) * VAL[p.type as P];
  return s;
}

/** Pieces adverses attaquees par la piece situee sur `from` */
function targets(c: Chess, from: Square, us: C): { sq: Square; type: P }[] {
  const out: { sq: Square; type: P }[] = [];
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (p && p.color !== us && c.attackers(sq, us).includes(from)) out.push({ sq, type: p.type as P });
  }
  return out;
}

const isDefended = (c: Chess, sq: Square, owner: C) => c.attackers(sq, owner).length > 0;

const DIRS: Record<'b' | 'r', [number, number][]> = {
  b: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  r: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
};

interface Motif {
  key: string;
  /** Motif de mat precis (theme Lichess), si reconnu */
  pattern?: 'smotheredMate' | 'backRankMate';
  text: string;
  hint: string;
  shapes: Shape[];
}

/** Detecte les motifs tactiques crees par un coup */
export function detectMotifs(before: Chess, mv: Move, after: Chess, nextUci?: string): Motif[] {
  const us = mv.color as C;
  const them = other(us);
  const mover = (mv.promotion ?? mv.piece) as P;
  const to = mv.to as Square;
  const found: Motif[] = [];

  // Mat
  if (after.isCheckmate()) {
    const kingSq = after.findPiece({ type: 'k', color: them })[0];
    const kr = Number(kingSq[1]);
    const neighbours = SQUARES.filter(
      (s) =>
        s !== kingSq && Math.abs(s.charCodeAt(0) - kingSq.charCodeAt(0)) <= 1 && Math.abs(Number(s[1]) - kr) <= 1,
    );
    const ownBlocked = neighbours.every((s) => after.get(s)?.color === them);
    let text = `Échec et mat : ${your(mover)} en ${to} donne échec et le roi n’a plus aucune case.`;
    let pattern: Motif['pattern'];
    // Cases devant le roi (vers le centre) occupees par ses propres pions
    const front = neighbours.filter((s) => Number(s[1]) === (kr === 8 ? 7 : 2));
    if (mover === 'n' && ownBlocked) {
      text = 'Mat à l’étouffée : le roi est enfermé par ses propres pièces et le cavalier le mate.';
      pattern = 'smotheredMate';
    } else if (
      (mover === 'r' || mover === 'q') &&
      (kr === 1 || kr === 8) &&
      Number(to[1]) === kr &&
      front.some((s) => after.get(s)?.color === them && after.get(s)?.type === 'p')
    ) {
      text = `Mat du couloir : le roi est bloqué sur sa dernière rangée par ses propres pions, ${your(mover)} le mate en ${to}.`;
      pattern = 'backRankMate';
    }
    found.push({ key: 'mate', pattern, text, hint: 'Il y a un mat : cherche les échecs.', shapes: [] });
    return found;
  }

  const kingSq = after.findPiece({ type: 'k', color: them })[0];
  const checkers = kingSq ? after.attackers(kingSq, us) : [];

  // Echec double
  if (checkers.length >= 2) {
    found.push({
      key: 'doubleCheck',
      text: 'Échec double : deux pièces font échec en même temps, le roi est obligé de bouger.',
      hint: 'Cherche un échec double.',
      shapes: checkers.map((s) => ({ orig: s, dest: kingSq, brush: 'red' as const })),
    });
  }

  // Fourchette : la piece jouee attaque au moins deux cibles interessantes
  const tg = targets(after, to, us).filter(
    (t) => t.type === 'k' || VAL[t.type] > VAL[mover] || (!isDefended(after, t.sq, them) && VAL[t.type] >= 3),
  );
  const attacksKing = targets(after, to, us).some((t) => t.type === 'k');
  const kingFork = attacksKing && targets(after, to, us).some((t) => t.type !== 'k' && VAL[t.type] >= 3);
  if (kingFork && tg.length < 2) {
    for (const t of targets(after, to, us)) if (t.type !== 'k' && VAL[t.type] >= 3 && !tg.includes(t)) tg.push(t);
  }
  if (tg.length >= 2) {
    const sorted = tg.sort((x, y) => VAL[y.type] - VAL[x.type]);
    found.push({
      key: 'fork',
      text: `Fourchette : ${your(mover)} en ${to} attaque ${listFr(sorted.map((t) => the(t.type)))} en même temps. L’adversaire ne peut pas tout sauver.`,
      hint: 'Cherche une fourchette : une pièce qui attaque deux cibles à la fois.',
      shapes: sorted.map((t) => ({ orig: to, dest: t.sq, brush: 'red' as const })),
    });
  }

  // Attaque ou echec a la decouverte
  for (const sq of SQUARES) {
    const p = after.get(sq);
    if (!p || p.color !== us || sq === to || !['b', 'r', 'q'].includes(p.type)) continue;
    const beforeT = new Set(before.get(sq)?.color === us ? targets(before, sq, us).map((t) => t.sq) : []);
    const fresh = targets(after, sq, us).filter((t) => !beforeT.has(t.sq) && (t.type === 'k' || VAL[t.type] >= 3));
    if (fresh.length) {
      const t = fresh.sort((x, y) => VAL[y.type] - VAL[x.type])[0];
      const isCheck = t.type === 'k';
      found.push({
        key: 'discoveredAttack',
        text: isCheck
          ? `Échec à la découverte : en bougeant, ${your(mover)} libère la ligne de ${your(p.type as P)} qui donne échec.`
          : `Attaque à la découverte : en bougeant, ${your(mover)} libère ${your(p.type as P)} qui attaque ${the(t.type)}.`,
        hint: 'Cherche une attaque à la découverte : une pièce qui bouge pour en démasquer une autre.',
        shapes: [{ orig: sq, dest: t.sq, brush: 'red' }],
      });
      break;
    }
  }

  // Clouage et enfilade crees par une piece a longue portee
  const lineDirs = mover === 'q' ? [...DIRS.b, ...DIRS.r] : mover === 'b' || mover === 'r' ? DIRS[mover] : [];
  for (const [df, dr] of lineDirs) {
    let f = to.charCodeAt(0) - 97 + df;
    let r = Number(to[1]) + dr;
    const hits: { sq: Square; type: P; color: C }[] = [];
    while (f >= 0 && f < 8 && r >= 1 && r <= 8 && hits.length < 2) {
      const sq = `${String.fromCharCode(97 + f)}${r}` as Square;
      const p = after.get(sq);
      if (p) hits.push({ sq, type: p.type as P, color: p.color as C });
      f += df;
      r += dr;
    }
    if (hits.length < 2 || hits[0].color !== them || hits[1].color !== them) continue;
    const [front, back] = hits;
    if (front.type !== 'k' && VAL[front.type] >= 3 && (back.type === 'k' || VAL[back.type] > VAL[front.type])) {
      found.push({
        key: 'pin',
        text: `Clouage : ${your(mover)} cloue ${the(front.type)} en ${front.sq} sur ${the(back.type)}. ${fem(front.type) ? 'Elle' : 'Il'} ne peut plus bouger sans exposer ${the(back.type)}.`,
        hint: 'Cherche un clouage.',
        shapes: [{ orig: to, dest: back.sq, brush: 'red' }],
      });
      break;
    }
    if ((front.type === 'k' || VAL[front.type] > VAL[back.type]) && VAL[back.type] >= 3) {
      found.push({
        key: 'skewer',
        text: `Enfilade : ${your(mover)} attaque ${the(front.type)}, qui doit s’écarter, et ${the(back.type)} derrière tombe.`,
        hint: 'Cherche une enfilade : attaquer une pièce précieuse qui en cache une autre.',
        shapes: [{ orig: to, dest: back.sq, brush: 'red' }],
      });
      break;
    }
  }

  // Prise d'une piece non defendue ou echange gagnant
  if (mv.captured) {
    const cap = mv.captured as P;
    const defended = before.attackers(to, them).length > 0;
    if (!defended)
      found.push({
        key: 'hangingPiece',
        text: `Tu prends ${the(cap)} en ${to}, qui n’était pas défendu${e(cap)}.`,
        hint: 'Une pièce adverse est mal protégée.',
        shapes: [],
      });
    else if (VAL[cap] > VAL[mover])
      found.push({
        key: 'trade',
        text: `Tu prends ${the(cap)} avec ${your(mover)} : même si l’adversaire reprend, l’échange est gagnant.`,
        hint: 'Un échange te fait gagner du matériel.',
        shapes: [],
      });
  }

  // Sacrifice : la piece jouee peut etre prise et l'adversaire la prend effectivement
  if (
    nextUci &&
    nextUci.slice(2, 4) === to &&
    VAL[mover] >= 3 &&
    VAL[mover] < 100 &&
    (!mv.captured || VAL[mv.captured as P] < VAL[mover])
  ) {
    found.push({
      key: 'sacrifice',
      text: `Sacrifice : tu donnes ${your(mover)} en ${to} pour obtenir plus fort ensuite.`,
      hint: 'N’aie pas peur de sacrifier du matériel.',
      shapes: [],
    });
  }

  if (mv.promotion)
    found.push({
      key: 'promotion',
      text: `Promotion : le pion devient ${a(mv.promotion as P)}.`,
      hint: 'Un pion peut aller à promotion.',
      shapes: [],
    });

  if (checkers.length === 1 && !found.some((m) => m.key === 'fork' || m.key === 'discoveredAttack'))
    found.push({
      key: 'check',
      text: `Échec avec ${your(mover)} : l’adversaire est obligé de répondre, tu gardes l’initiative.`,
      hint: 'Commence par un coup forcing (échec, prise, menace).',
      shapes: [],
    });

  return found;
}

function themeList(p: Puzzle) {
  return visibleThemes(p.themes).map((k) => THEMES[k]);
}

export function fmtEval(cpUs: number, mateUs?: number): string {
  if (mateUs === 0) return 'mat';
  if (mateUs !== undefined) return mateUs > 0 ? `mat en ${mateUs}` : `mat contre toi en ${-mateUs}`;
  const v = cpUs / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

/** Position de depart du probleme (apres le coup adverse) */
export function startPosition(p: Puzzle) {
  const c = new Chess(p.fen);
  play(c, p.moves[0]);
  return c;
}

function mateLength(p: Puzzle): number | null {
  const c = startPosition(p);
  for (const u of p.moves.slice(1)) play(c, u);
  return c.isCheckmate() ? Math.ceil((p.moves.length - 1) / 2) : null;
}

/** Explication de la solution (reussite ou solution affichee) */
export async function explainSolution(p: Puzzle, notation: Notation, revealed: boolean): Promise<Explanation> {
  const c = startPosition(p);
  const startFen = c.fen();
  const us = c.turn() as C;
  const matStart = material(c, us);
  const motifs = new Map<string, Motif>();
  const won: P[] = [];
  const lost: P[] = [];
  const shapes: Shape[] = [];
  const sol = p.moves.slice(1);
  for (let i = 0; i < sol.length; i++) {
    const before = new Chess(c.fen());
    const mv = play(c, sol[i]);
    if (mv.captured) (mv.color === us ? won : lost).push(mv.captured as P);
    if (mv.color === us) {
      shapes.push({ orig: mv.from, dest: mv.to, brush: 'green' });
      for (const m of detectMotifs(before, mv, c, sol[i + 1])) if (!motifs.has(m.key)) motifs.set(m.key, m);
    }
  }

  const points: string[] = [];
  // Motif principal en premier, puis les autres (max 3)
  const order = ['mate', 'fork', 'doubleCheck', 'discoveredAttack', 'pin', 'skewer', 'sacrifice', 'hangingPiece', 'trade', 'promotion', 'check'];
  const sorted = [...motifs.values()].sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key));
  for (const m of sorted.filter((m) => m.key !== 'mate').slice(0, 3)) points.push(m.text);

  points.push(`Solution : ${formatLine(startFen, sol, notation, 12)}`);

  if (c.isCheckmate()) {
    points.push(motifs.get('mate')?.text ?? 'Le dernier coup est échec et mat.');
  } else {
    const gain = material(c, us) - matStart;
    if (gain >= 1) {
      // Bilan net par type de piece (on ignore ce qui s'echange)
      const net = new Map<P, number>();
      for (const t of won) net.set(t, (net.get(t) ?? 0) + 1);
      for (const t of lost) net.set(t, (net.get(t) ?? 0) - 1);
      const plus = [...net].filter(([, n]) => n > 0).flatMap(([t, n]) => Array(n).fill(a(t)));
      const minus = [...net].filter(([, n]) => n < 0).flatMap(([t, n]) => Array(-n).fill(a(t)));
      const detail = plus.length ? ` : ${listFr(plus)}${minus.length ? ` contre ${listFr(minus)}` : ''}` : '';
      points.push(`Bilan : tu gagnes ${gain} point${gain > 1 ? 's' : ''} de matériel${detail}.`);
    } else {
      const [line] = await engine.analyse(c.fen(), { depth: 12 });
      const sign = c.turn() === us ? 1 : -1;
      if (line) {
        const ev = fmtEval(sign * line.cp, line.mate !== undefined ? sign * line.mate : undefined);
        points.push(`Bilan : pas de matériel gagné tout de suite, mais la position devient bien meilleure (évaluation ${ev}).`);
      }
    }
  }

  const themes = themeList(p);
  return {
    verdict: revealed ? 'solution' : 'success',
    title: revealed ? 'La solution' : 'Bien joué !',
    points,
    themes,
    shapes,
  };
}

/** Indice sur l'idee du prochain bon coup (sans le reveler) */
export function hintFor(p: Puzzle, fenBefore: string, expectedUci: string): string {
  const mate = mateLength(p);
  if (mate) return `Il y a un mat en ${mate}. Commence par regarder tous les échecs.`;
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  const mv = play(after, expectedUci);
  const motifs = detectMotifs(before, mv, after);
  if (motifs.length) return motifs[0].hint;
  const th = visibleThemes(p.themes)[0];
  if (th && THEMES[th]?.tip) return `Thème : ${THEMES[th].label}. ${THEMES[th].tip}`;
  return 'Cherche d’abord les coups forcing : échecs, prises, menaces.';
}

/** Explication d'un coup faux */
export async function explainMistake(
  p: Puzzle,
  fenBefore: string,
  wrongUci: string,
  expectedUci: string,
  notation: Notation,
): Promise<Explanation> {
  const c = new Chess(fenBefore);
  const us = c.turn() as C;
  const them = other(us);
  const matBefore = material(c, us);
  const wrong = play(c, wrongUci);
  const wrongSan = formatSan(wrong.san, notation);
  const afterFen = c.fen();

  const [ref] = await engine.analyse(afterFen, { depth: 14 });
  const ce = new Chess(fenBefore);
  play(ce, expectedUci);
  const bestIsMate = ce.isCheckmate();
  const [best] = bestIsMate ? [undefined] : await engine.analyse(ce.fen(), { depth: 12 });

  // Evaluations du point de vue du joueur (l'adversaire est au trait dans les deux cas)
  const evWrong = ref ? -ref.cp : 0;
  const evBest = bestIsMate ? 100_000 : best ? -best.cp : 0;
  const mateWrong = ref?.mate !== undefined ? -ref.mate : undefined;
  const mateBest = bestIsMate ? 0 : best?.mate !== undefined ? -best.mate : undefined;
  const missedMate = bestIsMate || (mateBest !== undefined && mateBest > 0);

  const points: string[] = [];
  const shapes: Shape[] = [{ orig: wrong.from, dest: wrong.to, brush: 'red' }];
  const reply = ref?.pv[0];
  let replySan = '';
  if (reply) {
    const t = new Chess(afterFen);
    try {
      const r = play(t, reply);
      replySan = formatSan(r.san, notation);
      shapes.push({ orig: r.from, dest: r.to, brush: 'yellow' });
    } catch {
      /* ligne invalide */
    }
  }

  let verdict: Explanation['verdict'] = 'fail';
  let title = 'Pas ça…';

  // Le coup reste tres bon : on ne le compte pas comme une erreur grave
  const stillWinning =
    mateWrong !== undefined ? mateWrong > 0 : winChance(evWrong) >= 0.8 && winChance(evBest) - winChance(evWrong) < 0.08;

  if (stillWinning) {
    verdict = 'soft';
    title = 'Bon coup, mais pas le meilleur';
    points.push(
      `${wrongSan} est un bon coup (évaluation ${fmtEval(evWrong, mateWrong)}), mais il existe plus fort ou plus direct. Le problème attend le coup le plus précis.`,
    );
  } else if (mateWrong !== undefined && mateWrong < 0) {
    points.push(dot(`Après ${wrongSan}, l’adversaire a un mat en ${-mateWrong} : ${formatLine(afterFen, ref!.pv, notation, 6)}`));
  } else {
    // Bilan materiel le long de la refutation (4 demi-coups)
    const t = new Chess(afterFen);
    const firstCapture: { san: string; piece: P; sq: string } | null = (() => {
      let res: { san: string; piece: P; sq: string } | null = null;
      for (const u of (ref?.pv ?? []).slice(0, 4)) {
        try {
          const m = play(t, u);
          if (!res && m.color === them && m.captured)
            res = { san: formatSan(m.san, notation), piece: m.captured as P, sq: m.to };
        } catch {
          break;
        }
      }
      return res;
    })();
    const loss = matBefore - material(t, us);

    if (wrong.captured && firstCapture && firstCapture.sq === wrong.to && loss >= 1) {
      points.push(
        `Tu prends ${the(wrong.captured as P)}, mais ${firstCapture.san} reprend : ${your((wrong.promotion ?? wrong.piece) as P)} était trop précieu${fem((wrong.promotion ?? wrong.piece) as P) ? 'se' : 'x'} pour cet échange.`,
      );
    } else if (firstCapture && firstCapture.sq === wrong.to && loss >= 1) {
      points.push(
        `${wrongSan} place ${your(firstCapture.piece)} sur une case attaquée : l’adversaire répond ${firstCapture.san} et ${fem(firstCapture.piece) ? 'la' : 'le'} prend.`,
      );
    } else if (firstCapture && loss >= 1) {
      points.push(`Après ${wrongSan}, ${your(firstCapture.piece)} en ${firstCapture.sq} reste en prise : l’adversaire joue ${firstCapture.san}.`);
    } else if (missedMate) {
      points.push(
        `Il y avait un mat${bestIsMate ? ' immédiat' : ''} ! ${wrongSan} le laisse passer${replySan ? ` et l’adversaire respire avec ${replySan}` : ''}.`,
      );
    } else if (winChance(evBest) - winChance(evWrong) > 0.3) {
      points.push(
        evBest >= 200
          ? `${wrongSan} laisse passer l’occasion : avec le bon coup tu prenais un gros avantage, ici l’adversaire a le temps de jouer ${replySan || 'un coup de défense'}.`
          : `${wrongSan} est une erreur : le bon coup tenait la position, ici l’adversaire prend le dessus avec ${replySan || 'sa réponse'}.`,
      );
    } else if (replySan) {
      points.push(`${wrongSan} ne met pas assez de pression : l’adversaire a le temps de jouer ${replySan}.`);
    }

    if (replySan && ref && ref.pv.length > 1 && !points[0]?.includes(formatLine(afterFen, ref.pv, notation, 1)))
      points.push(dot(`Suite probable : ${formatLine(afterFen, ref.pv, notation, 5)}`));

    if (loss >= 2) points.push(`Bilan : tu perdrais environ ${loss} points de matériel.`);
  }

  if (verdict === 'fail')
    points.push(`Évaluation : ${fmtEval(evBest, mateBest)} avec le bon coup, ${fmtEval(evWrong, mateWrong)} après le tien.`);

  return {
    verdict,
    title,
    points,
    hint: hintFor(p, fenBefore, expectedUci),
    themes: [],
    shapes,
  };
}
