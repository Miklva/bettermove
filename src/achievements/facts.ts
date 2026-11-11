// Faits extraits de chaque partie terminee (contre un bot ou en 1v1), du point de vue du joueur.
// Les succes sont calcules a partir de ces faits : on garde un journal compact et durable.
import { Chess, type Square } from 'chess.js';
import { load, save } from '../lib/storage';
import { loadBook, lookup } from '../review/openings';
import { listGames } from '../review/store';
import { BOTS } from '../bots/roster';

export type EndReason =
  | 'mate'
  | 'time'
  | 'resign'
  | 'stalemate'
  | 'repetition'
  | 'fifty'
  | 'insufficient'
  | 'agreement'
  | 'other';

export interface MateInfo {
  /** Piece qui donne le mat (p n b r q k), 'castle' pour un roque */
  piece: string;
  double: boolean;
  smothered: boolean;
  backRank: boolean;
  enPassant: boolean;
  promotion: boolean;
  /** Dame collee au roi mate */
  kiss: boolean;
  /** Mat du berger : dame sur f7/f2 avant le 5e coup */
  scholar: boolean;
}

export interface GameFact {
  id: string;
  date: string;
  source: 'bot' | 'local' | 'online';
  /** Partie en ligne classee */
  rated?: boolean;
  botId?: string;
  botRating?: number;
  userRating?: number;
  userColor: 'w' | 'b';
  result: 'win' | 'loss' | 'draw';
  reason: EndReason;
  /** Nombre de coups du joueur */
  userMoves: number;
  plies: number;
  /** Materiel (joueur - adversaire) en fin de partie, au pire et au mieux */
  finalDiff: number;
  minDiff: number;
  maxDiff: number;
  /** Pendules restantes en fin de partie (ms), absentes sans pendule */
  userClock?: number;
  oppClock?: number;
  /** Coup du joueur ou sa dame a ete prise (absent si jamais) */
  queenLostAt?: number;
  /** Pieces (hors pions) perdues par le joueur */
  piecesLost: number;
  castled: boolean;
  promotions: number;
  underpromotion: boolean;
  enPassant: boolean;
  /** Mat donne (si victoire par mat) ou recu (si defaite par mat) */
  mate?: MateInfo;
  opening?: string;
}

/** Coup minimal : compatible avec chess.js (verbose) et avec les coups de useGame */
export interface FactMove {
  color: 'w' | 'b';
  piece: string;
  captured?: string;
  promotion?: string;
  flags: string;
  from: string;
  to: string;
  /** Position apres le coup */
  after: string;
  clockAfter?: { w: number; b: number };
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function materialDiff(fen: string, color: 'w' | 'b'): number {
  let d = 0;
  for (const ch of fen.split(' ')[0]) {
    const low = ch.toLowerCase();
    if (!(low in VAL)) continue;
    const mine = (ch === low ? 'b' : 'w') === color;
    d += mine ? VAL[low] : -VAL[low];
  }
  return d;
}

export function reasonFrom(text: string, isMate: boolean): EndReason {
  const t = text.toLowerCase();
  if (isMate || t.includes('mat') && t.includes('chec')) return 'mate';
  if (t.includes('temps')) return 'time';
  if (t.includes('abandon')) return 'resign';
  if (t.startsWith('pat')) return 'stalemate';
  if (t.includes('pétition') || t.includes('petition')) return 'repetition';
  if (t.includes('50')) return 'fifty';
  if (t.includes('insuffisant')) return 'insufficient';
  if (t.includes('accord')) return 'agreement';
  return 'other';
}

function mateInfo(moves: FactMove[]): MateInfo {
  const last = moves[moves.length - 1];
  const c = new Chess(last.after);
  const loser = c.turn();
  const winner = loser === 'w' ? 'b' : 'w';
  const kingSq = (c
    .board()
    .flat()
    .find((p) => p && p.type === 'k' && p.color === loser)?.square ?? 'e1') as Square;
  const checkers = c.attackers(kingSq, winner);
  const file = kingSq.charCodeAt(0);
  const rank = Number(kingSq[1]);
  const around: (string | null)[] = [];
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const f = file + df;
      const r = rank + dr;
      around.push(f < 97 || f > 104 || r < 1 || r > 8 ? null : String.fromCharCode(f) + r);
    }
  const ownAround = (sq: string | null) => sq === null || c.get(sq as Square)?.color === loser;
  const piece = last.flags.includes('k') || last.flags.includes('q') ? 'castle' : (last.promotion ?? last.piece);
  const checkerTypes = checkers.map((s) => c.get(s)?.type);
  const homeRank = loser === 'w' ? 1 : 8;
  const forward = loser === 'w' ? 1 : -1;
  const kingNear = (sq: string) =>
    Math.abs(sq.charCodeAt(0) - file) <= 1 && Math.abs(Number(sq[1]) - rank) <= 1;
  const userMovesBefore = moves.filter((m) => m.color === winner).length;
  return {
    piece,
    double: checkers.length >= 2,
    smothered: checkerTypes.length === 1 && checkerTypes[0] === 'n' && around.every(ownAround),
    backRank:
      rank === homeRank &&
      checkers.some((s) => ['r', 'q'].includes(c.get(s)?.type ?? '') && Number(s[1]) === homeRank) &&
      around
        .filter((sq) => sq && Number(sq[1]) === homeRank + forward)
        .every((sq) => c.get(sq as Square)?.color === loser),
    enPassant: last.flags.includes('e'),
    promotion: !!last.promotion,
    kiss: checkers.some((s) => c.get(s)?.type === 'q' && kingNear(s)),
    scholar:
      last.piece === 'q' && (last.to === 'f7' || last.to === 'f2') && userMovesBefore <= 4,
  };
}

async function openingOf(startFen: string, moves: FactMove[]): Promise<string | undefined> {
  const book = await loadBook();
  let name: string | undefined;
  // Uniquement depuis la position de depart standard
  if (startFen.split(' ')[0] !== START.split(' ')[0]) return undefined;
  for (const m of moves.slice(0, 40)) {
    const n = lookup(book, m.after);
    if (n === undefined) break;
    if (n) name = n;
  }
  return name;
}

export interface FactInput {
  id: string;
  source: 'bot' | 'local' | 'online';
  rated?: boolean;
  userColor: 'w' | 'b';
  startFen?: string;
  moves: FactMove[];
  winner: 'w' | 'b' | null;
  reasonText: string;
  botId?: string;
  botRating?: number;
  userRating?: number;
  date?: string;
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export async function buildFact(i: FactInput): Promise<GameFact> {
  const me = i.userColor;
  const start = i.startFen ?? START;
  let minDiff = materialDiff(start, me);
  let maxDiff = minDiff;
  let queenLostAt: number | undefined;
  let piecesLost = 0;
  let castled = false;
  let promotions = 0;
  let underpromotion = false;
  let enPassant = false;
  let myMoves = 0;
  for (const m of i.moves) {
    if (m.color === me) {
      myMoves++;
      if (m.flags.includes('k') || m.flags.includes('q')) castled = true;
      if (m.promotion) {
        promotions++;
        if (m.promotion !== 'q') underpromotion = true;
      }
      if (m.flags.includes('e')) enPassant = true;
    } else if (m.captured) {
      if (m.captured === 'q' && queenLostAt === undefined) queenLostAt = Math.max(1, myMoves);
      if (m.captured !== 'p') piecesLost++;
    }
    const d = materialDiff(m.after, me);
    minDiff = Math.min(minDiff, d);
    maxDiff = Math.max(maxDiff, d);
  }
  const last = i.moves[i.moves.length - 1];
  const finalFen = last?.after ?? start;
  const isMate = !!last && new Chess(finalFen).isCheckmate();
  const reason = reasonFrom(i.reasonText, isMate);
  const opp = me === 'w' ? 'b' : 'w';
  return {
    id: i.id,
    date: i.date ?? new Date().toISOString(),
    source: i.source,
    rated: i.rated,
    botId: i.botId,
    botRating: i.botRating,
    userRating: i.userRating,
    userColor: me,
    result: i.winner === null ? 'draw' : i.winner === me ? 'win' : 'loss',
    reason,
    userMoves: myMoves,
    plies: i.moves.length,
    finalDiff: materialDiff(finalFen, me),
    minDiff,
    maxDiff,
    userClock: last?.clockAfter?.[me],
    oppClock: last?.clockAfter?.[opp],
    queenLostAt,
    piecesLost,
    castled,
    promotions,
    underpromotion,
    enPassant,
    mate: isMate ? mateInfo(i.moves) : undefined,
    opening: await openingOf(start, i.moves).catch(() => undefined),
  };
}

/* ---------------- Journal ---------------- */

const FACTS_KEY = 'bettermove.facts.v1';
const SEEDED_KEY = 'bettermove.factsSeeded.v1';
export const FACTS_EVENT = 'bettermove-facts';

export function listFacts(): GameFact[] {
  return load<GameFact[]>(FACTS_KEY, []);
}

/** Ajoute une partie au journal (ignoree si deja presente) */
export async function recordGame(i: FactInput) {
  if (i.moves.length < 2 || listFacts().some((f) => f.id === i.id)) return;
  const fact = await buildFact(i);
  const all = listFacts().filter((f) => f.id !== i.id);
  save(FACTS_KEY, [...all, fact].slice(-3000));
  window.dispatchEvent(new Event(FACTS_EVENT));
}

/** Premiere ouverture : reconstitue le journal depuis les parties deja sauvegardees */
export async function seedFromSavedGames() {
  if (load<boolean>(SEEDED_KEY, false)) return;
  save(SEEDED_KEY, true);
  const known = new Set(listFacts().map((f) => f.id));
  const out: GameFact[] = [];
  for (const g of listGames().slice().reverse()) {
    if (known.has(g.id) || (g.source !== 'bot' && g.source !== 'local')) continue;
    try {
      const c = new Chess();
      c.loadPgn(g.pgn);
      const h = c.getHeaders();
      const hist = c.history({ verbose: true });
      const oppName = g.userColor === 'w' ? g.black : g.white;
      const bot = BOTS.find((b) => oppName.startsWith(b.name));
      out.push(
        await buildFact({
          id: g.id,
          source: g.source,
          userColor: g.userColor,
          startFen: h.FEN,
          moves: hist.map((m) => ({ ...m, after: m.after })),
          winner: g.result === '1-0' ? 'w' : g.result === '0-1' ? 'b' : null,
          reasonText: h.Termination ?? '',
          botId: bot?.id,
          botRating: bot?.rating,
        }),
      );
    } catch {
      /* partie illisible : ignoree */
    }
  }
  if (out.length) {
    save(FACTS_KEY, [...out, ...listFacts()].slice(-3000));
    window.dispatchEvent(new Event(FACTS_EVENT));
  }
}

/* ---------------- Reviews ---------------- */

export interface ReviewFact {
  id: string;
  accuracy: number;
  brilliant: number;
  great: number;
  blunders: number;
  mistakes: number;
  moves: number;
}

const REVIEWS_KEY = 'bettermove.reviewFacts.v1';

export function listReviewFacts(): ReviewFact[] {
  return load<ReviewFact[]>(REVIEWS_KEY, []);
}

export function recordReview(r: ReviewFact) {
  const all = listReviewFacts().filter((x) => x.id !== r.id);
  save(REVIEWS_KEY, [...all, r].slice(-500));
  window.dispatchEvent(new Event(FACTS_EVENT));
}
