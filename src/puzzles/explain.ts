// Explications automatiques des problemes : pourquoi le bon coup marche, pourquoi un coup est faux.
// Combine des detecteurs de motifs tactiques (chess.js) et l'analyse de Stockfish.
import { Chess, type Move, type Square } from 'chess.js';
import { engine, winChance } from '../engine/stockfish';
import { formatLine, formatSan, type Notation } from '../lib/notation';
import { THEMES, visibleThemes } from './themes';
import type { Puzzle } from './db';
import { lang, t as tr, tn } from '../i18n';

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
// Noms des pieces dans les phrases generees : [le, ton, un] par langue (l'anglais pour une langue inconnue)
const PIECE_WORDS: Record<string, Record<P, [string, string, string]>> = {
  fr: { p: ['le pion', 'ton pion', 'un pion'], n: ['le cavalier', 'ton cavalier', 'un cavalier'], b: ['le fou', 'ton fou', 'un fou'], r: ['la tour', 'ta tour', 'une tour'], q: ['la dame', 'ta dame', 'une dame'], k: ['le roi', 'ton roi', 'un roi'] },
  en: { p: ['the pawn', 'your pawn', 'a pawn'], n: ['the knight', 'your knight', 'a knight'], b: ['the bishop', 'your bishop', 'a bishop'], r: ['the rook', 'your rook', 'a rook'], q: ['the queen', 'your queen', 'a queen'], k: ['the king', 'your king', 'a king'] },
  es: { p: ['el peón', 'tu peón', 'un peón'], n: ['el caballo', 'tu caballo', 'un caballo'], b: ['el alfil', 'tu alfil', 'un alfil'], r: ['la torre', 'tu torre', 'una torre'], q: ['la dama', 'tu dama', 'una dama'], k: ['el rey', 'tu rey', 'un rey'] },
  pt: { p: ['o peão', 'o teu peão', 'um peão'], n: ['o cavalo', 'o teu cavalo', 'um cavalo'], b: ['o bispo', 'o teu bispo', 'um bispo'], r: ['a torre', 'a tua torre', 'uma torre'], q: ['a dama', 'a tua dama', 'uma dama'], k: ['o rei', 'o teu rei', 'um rei'] },
  de: { p: ['der Bauer', 'dein Bauer', 'ein Bauer'], n: ['der Springer', 'dein Springer', 'ein Springer'], b: ['der Läufer', 'dein Läufer', 'ein Läufer'], r: ['der Turm', 'dein Turm', 'ein Turm'], q: ['die Dame', 'deine Dame', 'eine Dame'], k: ['der König', 'dein König', 'ein König'] },
  ru: { p: ['пешка', 'твоя пешка', 'пешка'], n: ['конь', 'твой конь', 'конь'], b: ['слон', 'твой слон', 'слон'], r: ['ладья', 'твоя ладья', 'ладья'], q: ['ферзь', 'твой ферзь', 'ферзь'], k: ['король', 'твой король', 'король'] },
};
// Pluriels pour "tu gagnes 2 pions"
const PLURAL: Record<string, Record<P, string>> = {
  fr: { p: 'pions', n: 'cavaliers', b: 'fous', r: 'tours', q: 'dames', k: 'rois' },
  en: { p: 'pawns', n: 'knights', b: 'bishops', r: 'rooks', q: 'queens', k: 'kings' },
  es: { p: 'peones', n: 'caballos', b: 'alfiles', r: 'torres', q: 'damas', k: 'reyes' },
  pt: { p: 'peões', n: 'cavalos', b: 'bispos', r: 'torres', q: 'damas', k: 'reis' },
  de: { p: 'Bauern', n: 'Springer', b: 'Läufer', r: 'Türme', q: 'Damen', k: 'Könige' },
  ru: { p: 'пешки', n: 'коня', b: 'слона', r: 'ладьи', q: 'ферзя', k: 'короля' },
};
const some = (p: P, n: number) => (n === 1 ? a(p) : `${n} ${(PLURAL[lang()] ?? PLURAL.en)[p]}`);
const words = (p: P) => (PIECE_WORDS[lang()] ?? PIECE_WORDS.en)[p];
const fem = (p: P) => p === 'r' || p === 'q';
export const the = (p: P) => words(p)[0];
export const your = (p: P) => words(p)[1];
export const a = (p: P) => words(p)[2];
const AND: Record<string, string> = { fr: 'et', en: 'and', es: 'y', pt: 'e', de: 'und', ru: 'и' };
const other = (c: C): C => (c === 'w' ? 'b' : 'w');
const SQUARES = 'abcdefgh'.split('').flatMap((f) => '12345678'.split('').map((r) => `${f}${r}` as Square));

/** Ajoute un point final sauf si la phrase finit deja par des points de suspension */
const dot = (t: string) => (t.endsWith('…') ? t : `${t}.`);

export function listFr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${AND[lang()] ?? 'and'} ${items[items.length - 1]}`;
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
  /** Motif indiscutable (ex. pion qui attaque deux pieces) : annonce meme sans theme Lichess */
  solid?: boolean;
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
    let text = tr('Échec et mat : {piece} en {sq} donne échec et le roi n’a plus aucune case.', { piece: your(mover), sq: to });
    let pattern: Motif['pattern'];
    // Cases devant le roi (vers le centre) occupees par ses propres pions
    const front = neighbours.filter((s) => Number(s[1]) === (kr === 8 ? 7 : 2));
    if (mover === 'n' && ownBlocked) {
      text = tr('Mat à l’étouffée : le roi est enfermé par ses propres pièces et le cavalier le mate.');
      pattern = 'smotheredMate';
    } else if (
      (mover === 'r' || mover === 'q') &&
      (kr === 1 || kr === 8) &&
      Number(to[1]) === kr &&
      front.some((s) => after.get(s)?.color === them && after.get(s)?.type === 'p')
    ) {
      text = tr('Mat du couloir : le roi est bloqué sur sa dernière rangée par ses propres pions, {piece} le mate en {sq}.', { piece: your(mover), sq: to });
      pattern = 'backRankMate';
    }
    found.push({ key: 'mate', pattern, text, hint: tr('Il y a un mat : cherche les échecs.'), shapes: [] });
    return found;
  }

  const kingSq = after.findPiece({ type: 'k', color: them })[0];
  const checkers = kingSq ? after.attackers(kingSq, us) : [];

  // Echec double
  if (checkers.length >= 2) {
    found.push({
      key: 'doubleCheck',
      text: tr('Échec double : deux pièces font échec en même temps, le roi est obligé de bouger.'),
      hint: tr('Cherche un échec double.'),
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
  // Une "fourchette" dont la piece se fait prendre gratuitement n'en est pas une
  const forkerAttackers = after.attackers(to, them);
  const forkerSafe =
    !forkerAttackers.length ||
    (isDefended(after, to, us) && Math.min(...forkerAttackers.map((s) => VAL[(after.get(s)?.type ?? 'q') as P])) >= VAL[mover]);
  if (tg.length >= 2 && forkerSafe) {
    const sorted = tg.sort((x, y) => VAL[y.type] - VAL[x.type]);
    found.push({
      key: 'fork',
      text: tr('Fourchette : {piece} en {sq} attaque {targets} en même temps. L’adversaire ne peut pas tout sauver.', { piece: your(mover), sq: to, targets: listFr(sorted.map((x) => the(x.type))) }),
      hint: tr('Cherche une fourchette : une pièce qui attaque deux cibles à la fois.'),
      shapes: sorted.map((t) => ({ orig: to, dest: t.sq, brush: 'red' as const })),
      solid: mover === 'p' && sorted.filter((x) => x.type !== 'k' && VAL[x.type] >= 3).length >= 2,
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
          ? tr('Échec à la découverte : en bougeant, {piece} libère la ligne de {other} qui donne échec.', { piece: your(mover), other: your(p.type as P) })
          : checkers.length === 1 && !checkers.includes(sq)
            ? tr('Attaque à la découverte : {piece} donne échec, l’adversaire doit s’occuper de son roi, et en même temps {other} attaque {target} en {sq}.', { piece: your(mover), other: your(p.type as P), target: the(t.type), sq: t.sq })
            : tr('Attaque à la découverte : en bougeant, {piece} libère {other} qui attaque {target} en {sq}.', { piece: your(mover), other: your(p.type as P), target: the(t.type), sq: t.sq }),
        hint: tr('Cherche une attaque à la découverte : une pièce qui bouge pour en démasquer une autre.'),
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
        text: tr(fem(front.type) ? 'Clouage : {piece} cloue {front} en {sq} sur {back}. Elle ne peut plus bouger sans exposer {back}.' : 'Clouage : {piece} cloue {front} en {sq} sur {back}. Il ne peut plus bouger sans exposer {back}.', { piece: your(mover), front: the(front.type), sq: front.sq, back: the(back.type) }),
        hint: tr('Cherche un clouage.'),
        shapes: [{ orig: to, dest: back.sq, brush: 'red' }],
      });
      break;
    }
    if ((front.type === 'k' || VAL[front.type] > VAL[back.type]) && VAL[back.type] >= 3) {
      found.push({
        key: 'skewer',
        text: tr('Enfilade : {piece} attaque {front}, qui doit s’écarter, et {back} derrière tombe.', { piece: your(mover), front: the(front.type), back: the(back.type) }),
        hint: tr('Cherche une enfilade : attaquer une pièce précieuse qui en cache une autre.'),
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
        text: tr(fem(cap) ? 'Tu prends {piece} en {sq}, qui n’était pas défendue.' : 'Tu prends {piece} en {sq}, qui n’était pas défendu.', { piece: the(cap), sq: to }),
        hint: tr('Une pièce adverse est mal protégée.'),
        shapes: [],
      });
    else if (VAL[cap] > VAL[mover])
      found.push({
        key: 'trade',
        text: tr('Tu prends {piece} avec {mine} : même si l’adversaire reprend, l’échange est gagnant.', { piece: the(cap), mine: your(mover) }),
        hint: tr('Un échange te fait gagner du matériel.'),
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
      text: tr('Sacrifice : tu donnes {piece} en {sq} pour obtenir plus fort ensuite.', { piece: your(mover), sq: to }),
      hint: tr('N’aie pas peur de sacrifier du matériel.'),
      shapes: [],
    });
  }

  if (mv.promotion)
    found.push({
      key: 'promotion',
      text: tr('Promotion : le pion devient {piece}.', { piece: a(mv.promotion as P) }),
      hint: tr('Un pion peut aller à promotion.'),
      shapes: [],
    });

  if (checkers.length === 1 && !found.some((m) => m.key === 'fork' || m.key === 'discoveredAttack'))
    found.push({
      key: 'check',
      text: tr('Échec avec {piece} : l’adversaire est obligé de répondre, tu gardes l’initiative.', { piece: your(mover) }),
      hint: tr('Commence par un coup forcing (échec, prise, menace).'),
      shapes: [],
    });

  return found;
}

/** Motifs "forts" qu'on n'annonce que si Lichess les a aussi reperes (evite les explications fausses) */
const CLAIMS = new Set(['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice']);
export function trusted(p: Puzzle, motifs: Motif[]): Motif[] {
  if (!p.themes?.length) return motifs;
  return motifs.filter((m) => m.solid || !CLAIMS.has(m.key) || p.themes.includes(m.key));
}

/** Evaluation en mots (point de vue du joueur), plutot qu'un chiffre */
export function evalWords(cpUs: number, mateUs?: number): string {
  if (mateUs === 0) return tr('échec et mat');
  if (mateUs !== undefined) return mateUs > 0 ? tr('tu as un mat en {n}', { n: mateUs }) : tr('l’adversaire a un mat en {n}', { n: -mateUs });
  if (cpUs >= 500) return tr('tu es gagnant');
  if (cpUs >= 200) return tr('tu as un net avantage');
  if (cpUs >= 80) return tr('tu es un peu mieux');
  if (cpUs > -80) return tr('la position est équilibrée');
  if (cpUs > -200) return tr('l’adversaire est un peu mieux');
  if (cpUs > -500) return tr('l’adversaire a un net avantage');
  return tr('tu es perdant');
}

/** Quantite de materiel en mots ("l'equivalent d'une tour") */
function lossWords(n: number): string {
  if (n >= 9) return tr('l’équivalent d’une dame');
  if (n >= 5) return tr('l’équivalent d’une tour');
  if (n >= 3) return tr('l’équivalent d’une pièce');
  return tn(n, '{n} pion', '{n} pions');
}

/** Themes "d'idee" de Lichess, utilises pour expliquer un coup sans motif detecte */
const QUIET_THEMES = ['quietMove', 'defensiveMove', 'zugzwang'];
const IDEA_THEMES = ['trappedPiece', 'deflection', 'attraction', 'clearance', 'interference', 'intermezzo', 'capturingDefender', 'xRayAttack', 'quietMove', 'defensiveMove', 'zugzwang'];

function themeList(p: Puzzle) {
  return visibleThemes(p.themes).map((k) => THEMES[k]);
}

export function fmtEval(cpUs: number, mateUs?: number): string {
  if (mateUs === 0) return tr('mat');
  if (mateUs !== undefined) return mateUs > 0 ? tr('mat en {n}', { n: mateUs }) : tr('mat contre toi en {n}', { n: -mateUs });
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
  // Bilan compte depuis AVANT le coup adverse : s'il vient de prendre, on le deduit
  const pre = new Chess(p.fen);
  const matStart = material(pre, us);
  const firstTake = play(pre, p.moves[0]).captured as P | undefined;
  const won: P[] = [];
  const lost: P[] = firstTake ? [firstTake] : [];
  const shapes: Shape[] = [];
  const sol = p.moves.slice(1);
  const order = ['mate', 'fork', 'doubleCheck', 'discoveredAttack', 'pin', 'skewer', 'sacrifice', 'hangingPiece', 'trade', 'promotion', 'check'];
  const ideaTheme = IDEA_THEMES.find((k) => p.themes?.includes(k));
  let ideaUsed = false;
  const said = new Set<string>();
  const steps: string[] = [];
  let mateText: string | null = null;
  const MAX_STEPS = 4;

  for (let i = 0; i < sol.length; i++) {
    const before = new Chess(c.fen());
    const moveNo = before.moveNumber();
    const mv = play(c, sol[i]);
    if (mv.captured) (mv.color === us ? won : lost).push(mv.captured as P);
    if (mv.color !== us) continue;
    shapes.push({ orig: mv.from, dest: mv.to, brush: 'green' });

    // Reponse adverse (forcee ou non) pour raconter la suite
    const replyUci = sol[i + 1];
    let replySan = '';
    let forced = false;
    if (replyUci) {
      const t = new Chess(c.fen());
      forced = t.moves().length === 1;
      try {
        replySan = formatSan(play(t, replyUci).san, notation);
      } catch {
        replySan = '';
      }
    }

    const motifs = trusted(p, detectMotifs(before, mv, c, replyUci)).sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key));
    if (motifs[0]?.key === 'mate') mateText = motifs[0].text;
    // On evite de repeter deux fois la meme idee
    const fresh = motifs.find((m) => m.key !== 'mate' && !said.has(m.key));
    let why = '';
    let replyTold = false;
    if (fresh) {
      why = fresh.text;
      said.add(fresh.key);
    } else if (motifs[0]?.key === 'mate') {
      why = motifs[0].text;
    } else if (ideaTheme && !ideaUsed && THEMES[ideaTheme]?.tip && (!QUIET_THEMES.includes(ideaTheme) || (!mv.captured && !c.inCheck()))) {
      const tip = tr(THEMES[ideaTheme].tip!);
      // Allemand : les noms gardent leur majuscule
      why = tr('{label} : {tip}', { label: tr(THEMES[ideaTheme].label), tip: lang() === 'de' ? tip : tip.charAt(0).toLowerCase() + tip.slice(1) });
      ideaUsed = true;
    } else if (mv.captured) {
      const recapture = replyUci?.slice(2, 4) === mv.to;
      replyTold = recapture && !!replySan;
      why = recapture
        ? tr('Échange : tu prends {piece} en {sq}, l’adversaire reprend avec {reply}.', { piece: the(mv.captured as P), sq: mv.to, reply: replySan })
        : tr('Tu prends {piece} en {sq}.', { piece: the(mv.captured as P), sq: mv.to });
    } else if (c.inCheck()) {
      why = tr('Échec : l’adversaire n’a pas le choix, il doit s’occuper de son roi.');
    } else {
      // Coup calme : que menace-t-il ?
      const beforeT = new Set(targets(before, mv.from as Square, us).map((x) => x.sq));
      const threat = targets(c, mv.to as Square, us)
        .filter((x) => x.type !== 'k' && !beforeT.has(x.sq) && (VAL[x.type] > VAL[mv.piece as P] || !isDefended(c, x.sq, other(us))))
        .sort((x, y) => VAL[y.type] - VAL[x.type])[0];
      const nearPromo = mv.piece === 'p' && mv.to[1] === (us === 'w' ? '7' : '2');
      why = threat
        ? tr('Menace : {piece} attaque {target} en {sq}.', { piece: your(mv.piece as P), target: the(threat.type), sq: threat.sq })
        : nearPromo
          ? tr('Ton pion arrive en {sq} : il menace d’aller à dame au prochain coup.', { sq: mv.to })
          : tr('Coup de préparation : il met en place la suite.');
    }

    const san = formatSan(mv.san, notation);
    const num = us === 'w' ? `${moveNo}. ` : `${moveNo}... `;
    let step = `${num}${san} — ${why}`;
    if (replySan && !replyTold) step = `${dot(step.replace(/\.$/, ''))} ${forced ? tr('Seul coup possible : {reply}.', { reply: replySan }) : tr('L’adversaire répond {reply}.', { reply: replySan })}`;
    if (steps.length < MAX_STEPS) steps.push(step);
  }

  const points: string[] = [...steps];
  if (steps.length * 2 < sol.length) points.push(tr('Solution complète : {line}', { line: formatLine(startFen, sol, notation, 12) }));

  if (c.isCheckmate()) {
    if (!steps.some((s) => mateText && s.includes(mateText))) points.push(mateText ?? tr('Le dernier coup est échec et mat.'));
  } else {
    const gain = material(c, us) - matStart;
    if (gain >= 1) {
      // Bilan net par type de piece (on ignore ce qui s'echange)
      const net = new Map<P, number>();
      for (const t of won) net.set(t, (net.get(t) ?? 0) + 1);
      for (const t of lost) net.set(t, (net.get(t) ?? 0) - 1);
      const plus = [...net].filter(([, n]) => n > 0).map(([t, n]) => some(t, n));
      const minus = [...net].filter(([, n]) => n < 0).map(([t, n]) => some(t, -n));
      points.push(
        plus.length
          ? minus.length
            ? tr('Résultat : tu gagnes {plus} contre {minus}.', { plus: listFr(plus), minus: listFr(minus) })
            : tr('Résultat : tu gagnes {plus}.', { plus: listFr(plus) })
          : tr('Résultat : tu gagnes {x}.', { x: lossWords(gain) }),
      );
    } else {
      const [line] = await engine.analyse(c.fen(), { depth: 12 });
      const sign = c.turn() === us ? 1 : -1;
      if (line) {
        const words = evalWords(sign * line.cp, line.mate !== undefined ? sign * line.mate : undefined);
        const saving = p.themes?.includes('equality') || p.themes?.includes('defensiveMove');
        points.push(
          saving
            ? tr('Résultat : tu sauves la position ({words}).', { words })
            : tr('Résultat : pas de matériel gagné tout de suite, mais {words}.', { words }),
        );
      }
    }
  }

  const themes = themeList(p);
  return {
    verdict: revealed ? 'solution' : 'success',
    title: revealed ? tr('La solution') : tr('Bien joué !'),
    points,
    themes,
    shapes,
  };
}

/** Indice sur l'idee du prochain bon coup (sans le reveler) */
export function hintFor(p: Puzzle, fenBefore: string, expectedUci: string): string {
  const mate = mateLength(p);
  if (mate) return tr('Il y a un mat en {n}. Commence par regarder tous les échecs.', { n: mate });
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  const mv = play(after, expectedUci);
  const motifs = trusted(p, detectMotifs(before, mv, after));
  if (motifs.length) return motifs[0].hint;
  const th = visibleThemes(p.themes)[0];
  if (th && THEMES[th]?.tip) return tr('Thème : {label}. {tip}', { label: THEMES[th].label, tip: THEMES[th].tip! });
  return tr('Cherche d’abord les coups forcing : échecs, prises, menaces.');
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
  let title = tr('Pas ça…');

  // Le coup reste tres bon : on ne le compte pas comme une erreur grave
  const stillWinning =
    mateWrong !== undefined ? mateWrong > 0 : winChance(evWrong) >= 0.8 && winChance(evBest) - winChance(evWrong) < 0.08;

  if (stillWinning) {
    verdict = 'soft';
    title = tr('Bon coup, mais pas le meilleur');
    points.push(
      tr('{move} est un bon coup ({words}), mais il existe plus fort ou plus direct. Le problème attend le coup le plus précis.', { move: wrongSan, words: evalWords(evWrong, mateWrong) }),
    );
  } else if (mateWrong !== undefined && mateWrong < 0) {
    points.push(dot(tr('Après {move}, l’adversaire a un mat en {n} : {line}', { move: wrongSan, n: -mateWrong, line: formatLine(afterFen, ref!.pv, notation, 6) })));
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
        tr(fem((wrong.promotion ?? wrong.piece) as P) ? 'Tu prends {piece}, mais {reply} reprend : {mine} était trop précieuse pour cet échange.' : 'Tu prends {piece}, mais {reply} reprend : {mine} était trop précieux pour cet échange.', { piece: the(wrong.captured as P), reply: firstCapture.san, mine: your((wrong.promotion ?? wrong.piece) as P) }),
      );
    } else if (firstCapture && firstCapture.sq === wrong.to && loss >= 1) {
      points.push(
        tr(fem(firstCapture.piece) ? '{move} place {piece} sur une case attaquée : l’adversaire répond {reply} et la prend.' : '{move} place {piece} sur une case attaquée : l’adversaire répond {reply} et le prend.', { move: wrongSan, piece: your(firstCapture.piece), reply: firstCapture.san }),
      );
    } else if (firstCapture && loss >= 1) {
      points.push(tr('Après {move}, {piece} en {sq} reste en prise : l’adversaire joue {reply}.', { move: wrongSan, piece: your(firstCapture.piece), sq: firstCapture.sq, reply: firstCapture.san }));
    } else if (missedMate) {
      points.push(
        (bestIsMate ? tr('Il y avait un mat immédiat ! {move} le laisse passer', { move: wrongSan }) : tr('Il y avait un mat ! {move} le laisse passer', { move: wrongSan })) + (replySan ? tr(' et l’adversaire respire avec {reply}', { reply: replySan }) : '') + '.',
      );
    } else if (winChance(evBest) - winChance(evWrong) > 0.3) {
      points.push(
        evBest >= 200
          ? tr('{move} laisse passer l’occasion : avec le bon coup tu prenais un gros avantage, ici l’adversaire a le temps de jouer {reply}.', { move: wrongSan, reply: replySan || tr('un coup de défense') })
          : tr('{move} est une erreur : le bon coup tenait la position, ici l’adversaire prend le dessus avec {reply}.', { move: wrongSan, reply: replySan || tr('sa réponse') }),
      );
    } else if (replySan) {
      points.push(tr('{move} ne met pas assez de pression : l’adversaire a le temps de jouer {reply}.', { move: wrongSan, reply: replySan }));
    }

    if (replySan && ref && ref.pv.length > 1 && !points[0]?.includes(formatLine(afterFen, ref.pv, notation, 1)))
      points.push(dot(tr('Suite probable : {line}', { line: formatLine(afterFen, ref.pv, notation, 5) })));

    if (loss >= 2) points.push(tr('Au bout de cette suite, tu perds {x}.', { x: lossWords(loss) }));
  }

  if (verdict === 'fail')
    points.push(tr('Avec le bon coup, {best}. Après le tien, {mine}.', { best: evalWords(evBest, mateBest), mine: evalWords(evWrong, mateWrong) }));

  return {
    verdict,
    title,
    points,
    hint: hintFor(p, fenBefore, expectedUci),
    themes: [],
    shapes,
  };
}

/* ---------------- Indices progressifs (apres un echec ou sur demande) ----------------
   Niveau 1 : l'idee du coup (attaque, defense, coup calme...).
   Niveau 2 : la piece a jouer.
   Niveau 3 : la case de depart et le but du coup (sans donner la case d'arrivee).
   But : faire reflechir, pas essayer tous les coups au hasard. */
export const HINT_LEVELS = 3;

type Idea = 'mate' | 'motif' | 'defend' | 'capture' | 'check' | 'castle' | 'threat' | 'pressure' | 'pawn' | 'improve';
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Pieces du camp `us` en prise (non defendues, ou attaquees par moins cher) */
function threatened(c: Chess, us: C): { sq: Square; type: P }[] {
  const them = other(us);
  const out: { sq: Square; type: P }[] = [];
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (!p || p.color !== us || p.type === 'k') continue;
    const att = c.attackers(sq, them);
    if (!att.length) continue;
    const cheapest = Math.min(...att.map((a) => VAL[(c.get(a)?.type ?? 'q') as P]));
    if (!isDefended(c, sq, us) || cheapest < VAL[p.type as P]) out.push({ sq, type: p.type as P });
  }
  return out;
}

/** Position avec l'autre camp au trait (pour voir ce que menace l'adversaire) */
function passTurn(fen: string): Chess | null {
  const f = fen.split(' ');
  f[1] = f[1] === 'w' ? 'b' : 'w';
  f[3] = '-';
  try {
    return new Chess(f.join(' '));
  } catch {
    return null;
  }
}

const ZONE = (sq: string) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]);
  if (f >= 2 && f <= 5 && r >= 3 && r <= 6) return tr('vers le centre');
  return f >= 4 ? tr('vers l’aile roi') : tr('vers l’aile dame');
};

function mobility(c: Chess, sq: Square): number {
  return c.moves({ square: sq, verbose: true }).length;
}

export function progressiveHint(p: Puzzle, fenBefore: string, expectedUci: string, level: number): { text: string; shapes: Shape[] } {
  const before = new Chess(fenBefore);
  const us = before.turn() as C;
  const them = other(us);
  const after = new Chess(fenBefore);
  const mv = play(after, expectedUci);
  const piece = mv.piece as P;
  const from = mv.from as Square;

  // L'idee du coup
  let idea: Idea = 'improve';
  let detail = '';
  let mate: number | null = null;
  try {
    mate = mateLength(p);
  } catch {
    mate = null;
  }
  const motifs = trusted(p, detectMotifs(before, mv, after));
  const threats = threatened(before, us);
  const threatsAfter = threatened(after, us);
  const newTargets = targets(after, mv.to as Square, us).filter(
    (x) => x.type !== 'k' && (!isDefended(after, x.sq, them) || VAL[x.type] > VAL[piece]),
  );
  // Pieces adverses (hors pions et roi) que la piece jouee attaque apres le coup
  const pressured = targets(after, mv.to as Square, us).filter((x) => x.type !== 'k' && x.type !== 'p');
  if (mate) idea = 'mate';
  else if (motifs.length) {
    idea = 'motif';
    detail = motifs[0].hint;
  } else if (threats.length && threatsAfter.length < threats.length) {
    idea = 'defend';
  } else if (mv.captured) idea = 'capture';
  else if (after.inCheck()) idea = 'check';
  else if (mv.flags.includes('k') || mv.flags.includes('q')) idea = 'castle';
  else if (newTargets.length) idea = 'threat';
  else if (pressured.length) idea = 'pressure';
  else if (piece === 'p') idea = 'pawn';
  // Ce que menace l'adversaire si on ne fait rien (utile meme pour un coup calme)
  const opp = passTurn(fenBefore);
  const oppThreat = opp ? threatened(opp, us)[0] : undefined;

  const L1: Record<Idea, string> = {
    mate: tr('Il y a un mat en {n}. Commence par regarder tous les échecs.', { n: mate ?? 1 }),
    motif: detail,
    defend: tr('Avant d’attaquer, regarde ce que menace ton adversaire : une de tes pièces est en danger.'),
    capture: tr('Une pièce adverse peut être prise avec profit. Compte les attaquants et les défenseurs.'),
    check: tr('Le bon coup donne échec et oblige l’adversaire à répondre.'),
    castle: tr('Ton roi est encore exposé : mets-le à l’abri.'),
    threat: tr('Le bon coup crée une menace : une pièce adverse est mal protégée.'),
    pressure: tr('Le bon coup attaque une pièce adverse : regarde ce qu’elle protège.'),
    pawn: tr('Le bon coup est un coup de pion : il gagne de l’espace ou ouvre le jeu pour tes pièces.'),
    improve: tr('Pas de tactique ici : c’est un coup calme. Cherche ta pièce la moins active et donne-lui plus de cases.'),
  };
  const lines = [L1[idea]];
  const shapes: Shape[] = [];

  if (level >= 2) {
    // Niveau 3 : la phrase "Joue ... de ..." remplace celle-ci
    if (level === 2) {
      if (idea === 'castle') lines.push(tr('Le coup se joue avec ton roi.'));
      else if (piece === 'p') lines.push(tr('Le coup se joue avec un pion.'));
      else lines.push(tr('Le coup se joue avec {piece}.', { piece: your(piece) }));
    }
    if (idea === 'defend' && threats[0]) {
      lines.push(cap(tr('{piece} en {sq} est en prise.', { piece: your(threats[0].type), sq: threats[0].sq })));
      shapes.push({ orig: threats[0].sq, brush: 'red' });
    } else if (idea === 'improve' && oppThreat) {
      lines.push(tr('Attention : l’adversaire vise {piece} en {sq}.', { piece: your(oppThreat.type), sq: oppThreat.sq }));
    }
  }
  if (level >= 3) {
    shapes.push({ orig: from, brush: 'blue' });
    let goal = '';
    const target = idea === 'threat' ? newTargets[0] : idea === 'pressure' ? pressured[0] : undefined;
    if (target) goal = tr('pour attaquer {piece} en {sq}', { piece: the(target.type), sq: target.sq });
    else if (idea === 'defend') goal = mv.from === threats[0]?.sq ? tr('pour échapper à la menace') : tr('pour défendre {sq}', { sq: threats[0]?.sq ?? mv.to });
    else if (idea === 'improve') {
      const gain = mobility(after, mv.to as Square) - mobility(new Chess(fenBefore), from);
      goal = gain > 0 ? tn(gain, '{dir}, avec {n} case de plus', '{dir}, avec {n} cases de plus', { dir: ZONE(mv.to) }) : ZONE(mv.to);
    } else if (idea === 'pawn') goal = ZONE(mv.to);
    if (idea === 'castle') lines.push(tr('Pense au roque.'));
    else lines.push(goal ? tr('Joue {piece} de {sq}, {goal}.', { piece: your(piece), sq: from, goal }) : tr('Joue {piece} de {sq}.', { piece: your(piece), sq: from }));
  }
  return { text: lines.join(' '), shapes };
}
