// Analyse rapide des parties de l'historique pour le suivi personnalise :
// chaque erreur du joueur est rangee dans une ou plusieurs familles (piece en prise, tactique manquee...).
import { Chess, type Move, type Square } from 'chess.js';
import { engine } from '../engine/stockfish';
import { wpWhite, type PosEval } from '../review/analysis';
import { loadBook, lookup } from '../review/openings';
import { detectMotifs, play, VAL, type P } from '../puzzles/explain';
import { load } from '../lib/storage';
import type { SavedGame } from '../review/store';

export type WeakId =
  | 'hanging'
  | 'ignoredThreat'
  | 'missedTactic'
  | 'missedMate'
  | 'allowedMate'
  | 'positional'
  | 'opening'
  | 'endgame'
  | 'conversion'
  | 'time';

export interface ErrorRec {
  id: string;
  gameId: string;
  /** Numero du coup du joueur */
  moveNo: number;
  fen: string;
  played: string;
  playedSan: string;
  best: string;
  bestSan: string;
  /** Perte de probabilite de gain (0..1) */
  loss: number;
  wpBefore: number;
  types: WeakId[];
  /** Motif du meilleur coup (fork, pin...) ou piece perdue */
  detail?: string;
  /** Tactique adverse rendue possible par le coup (fork, pin...) */
  oppMotif?: string;
  /** Position avant le coup adverse precedent, pour en faire un exercice */
  prevFen?: string;
  prevUci?: string;
}

export interface GameAnalysis {
  id: string;
  analyzedAt: string;
  playedAt?: string;
  source: SavedGame['source'];
  userColor: 'w' | 'b';
  result: 'win' | 'draw' | 'loss' | 'none';
  end?: string;
  userMoves: number;
  opening?: string;
  errors: ErrorRec[];
}

const STRONG = new Set(['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'promotion']);
const START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

function terminal(fen: string): PosEval | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { cp: c.turn() === 'w' ? -100_000 : 100_000, mate: 0, pv: [], depth: 99 };
  if (c.isDraw() || c.isStalemate()) return { cp: 0, pv: [], depth: 99 };
  return null;
}

/** Materiel sans les rois, toutes couleurs confondues, hors pions */
function pieceMaterial(c: Chess) {
  let s = 0;
  for (const row of c.board()) for (const p of row) if (p && p.type !== 'k' && p.type !== 'p') s += VAL[p.type as P];
  return s;
}

function materialOf(c: Chess, color: 'w' | 'b') {
  let s = 0;
  for (const row of c.board()) for (const p of row) if (p && p.type !== 'k') s += (p.color === color ? 1 : -1) * VAL[p.type as P];
  return s;
}

/**
 * Bilan materiel pour l'adversaire depuis la position AVANT le coup du joueur :
 * coup joue puis 4 demi-coups de la meilleure ligne (un echange egal donne 0).
 */
function oppGain(fen: string, line: string[], opp: 'w' | 'b') {
  const c = new Chess(fen);
  const before = materialOf(c, opp);
  let firstCapture: { sq: string; type: string } | null = null;
  for (const u of line.slice(0, 5)) {
    try {
      const m = play(c, u);
      if (!firstCapture && m.captured && m.color === opp) firstCapture = { sq: m.to, type: m.captured };
    } catch {
      break;
    }
  }
  return { gain: materialOf(c, opp) - before, firstCapture };
}

const resultOf = (g: SavedGame): GameAnalysis['result'] => {
  if (g.result === '1/2-1/2') return 'draw';
  if (g.result === '1-0') return g.userColor === 'w' ? 'win' : 'loss';
  if (g.result === '0-1') return g.userColor === 'b' ? 'win' : 'loss';
  return 'none';
};

/** Motif tactique d'un coup (fork, pin...) ou undefined */
function motifOf(fen: string, uci?: string, next?: string): string | undefined {
  if (!uci) return undefined;
  try {
    const c = new Chess(fen);
    const mv = play(c, uci);
    return detectMotifs(new Chess(fen), mv, c, next).find((x) => STRONG.has(x.key))?.key;
  } catch {
    return undefined;
  }
}

/**
 * Range les erreurs du joueur `user` dans les familles de points faibles.
 * `evals[i]` = evaluation (point de vue des Blancs) de la position avant le demi-coup i.
 */
export function classifyErrors(hist: Move[], evals: (PosEval | undefined)[], user: 'w' | 'b', gameId: string): ErrorRec[] {
  const g = { id: gameId };
  const errors: ErrorRec[] = [];
  const side = (e: PosEval) => (user === 'w' ? wpWhite(e) : 1 - wpWhite(e));
  const opp = user === 'w' ? 'b' : 'w';
  hist.forEach((m, i) => {
    if (m.color !== user) return;
    const before = evals[i];
    const after = evals[i + 1];
    if (!before || !after || !before.best) return;
    const wpB = side(before);
    const wpA = side(after);
    const loss = wpB - wpA;
    // Seuil "erreur" ; on ignore les positions deja perdues ou encore largement gagnees
    if (loss < 0.12 || wpB < 0.08 || wpA > 0.9) return;

    const types: WeakId[] = [];
    let detail: string | undefined;
    const userMate = (e: PosEval) => e.mate !== undefined && e.mate !== 0 && (user === 'w' ? e.mate > 0 : e.mate < 0);
    const oppMate = (e: PosEval) => e.mate !== undefined && e.mate !== 0 && (user === 'w' ? e.mate < 0 : e.mate > 0);

    if (userMate(before) && !userMate(after)) types.push('missedMate');
    if (oppMate(after)) types.push('allowedMate');
    let oppMotif: string | undefined;

    // Materiel perdu juste apres le coup : piece mise en prise ou menace ignoree
    if (!types.includes('allowedMate')) {
      const { gain, firstCapture } = oppGain(m.before, [m.lan, ...after.pv], opp);
      if (gain >= 2 && firstCapture) {
        detail = firstCapture.type;
        oppMotif = motifOf(m.after, after.pv[0], after.pv[1]);
        if (firstCapture.sq === m.to) types.push('hanging');
        else {
          const attackedBefore = new Chess(m.before).attackers(firstCapture.sq as Square, opp).length > 0;
          types.push(attackedBefore ? 'ignoredThreat' : 'hanging');
        }
      }
    }

    // Tactique que le meilleur coup permettait
    if (!types.includes('missedMate') && before.best !== m.lan) {
      try {
        const b = new Chess(m.before);
        const bm = play(b, before.best);
        const strong = detectMotifs(new Chess(m.before), bm, b, before.pv[1]).find((x) => STRONG.has(x.key));
        if (strong) {
          types.push('missedTactic');
          detail = detail ?? strong.key;
        }
      } catch {
        /* coup illisible : ignore */
      }
    }
    if (!types.some((t) => ['missedMate', 'allowedMate', 'hanging', 'ignoredThreat', 'missedTactic'].includes(t)))
      types.push('positional');

    const moveNo = Math.floor(i / 2) + 1;
    if (moveNo <= 10) types.push('opening');
    else if (pieceMaterial(new Chess(m.before)) <= 14) types.push('endgame');
    if (wpB >= 0.8 && wpA < 0.65) types.push('conversion');

    let bestSan = before.best;
    try {
      bestSan = new Chess(m.before).move({ from: before.best.slice(0, 2), to: before.best.slice(2, 4), promotion: before.best[4] }).san;
    } catch {
      /* garde l'UCI */
    }
    const prev = i > 0 ? hist[i - 1] : undefined;
    errors.push({
      id: `${g.id}-${i}`,
      gameId: g.id,
      moveNo,
      fen: m.before,
      played: m.lan,
      playedSan: m.san,
      best: before.best,
      bestSan,
      loss: Math.round(loss * 1000) / 1000,
      wpBefore: Math.round(wpB * 100) / 100,
      types,
      detail,
      oppMotif,
      prevFen: prev?.before,
      prevUci: prev?.lan,
    });
  });

  return errors;
}

/** Camp a suivre pour le coach, ou null si la partie ne doit pas compter */
export function coachColor(g: SavedGame): 'w' | 'b' | null {
  if (g.observer) return null;
  if (g.source === 'local') return g.coachSide === 'w' || g.coachSide === 'b' ? g.coachSide : null;
  return g.userColor;
}

/** Bilan d'une partie a partir d'evaluations deja calculees (review complete ou analyse rapide) */
export function buildGameAnalysis(g: SavedGame, user: 'w' | 'b', hist: Move[], evals: (PosEval | undefined)[]): GameAnalysis {
  const r = resultOf(g);
  // En 1v1 le resultat est vu du camp choisi
  const result: GameAnalysis['result'] =
    g.source === 'local' && user !== g.userColor && r !== 'none' && r !== 'draw' ? (r === 'win' ? 'loss' : 'win') : r;
  return {
    id: g.id,
    analyzedAt: new Date().toISOString(),
    playedAt: g.playedAt,
    source: g.source,
    userColor: user,
    result,
    end: g.end,
    userMoves: hist.filter((m) => m.color === user).length,
    opening: g.opening,
    errors: classifyErrors(hist, evals, user, g.id),
  };
}

/** Analyse une partie. `shouldStop` interrompt proprement (renvoie null). */
export async function analyzeForCoach(g: SavedGame, shouldStop: () => boolean): Promise<GameAnalysis | null> {
  const user = coachColor(g) ?? g.userColor;
  const c = new Chess();
  c.loadPgn(g.pgn);
  const h = c.getHeaders();
  const hist = c.history({ verbose: true });
  const startFen = hist[0]?.before ?? c.fen();
  const fens = [startFen, ...hist.map((m) => m.after)];

  // Evaluations deja calculees par une review complete : reutilisees
  const cacheKey = startFen + '|' + hist.map((m) => m.lan).join(' ');
  const cached = load<{ key: string; evals: PosEval[] }[]>('bettermove.analysisCache.v1', []).find((x) => x.key === cacheKey);

  const book = await loadBook();
  const standard = !h.FEN || h.FEN.split(' ')[0] === START_BOARD;
  let inBook = standard;
  const evals: (PosEval | undefined)[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (shouldStop()) return null;
    if (cached?.evals[i]) {
      evals[i] = cached.evals[i];
      continue;
    }
    // Positions theoriques : pas d'erreur possible, on ne les analyse pas
    inBook = inBook && i <= 24 && lookup(book, fens[i]) !== undefined;
    if (inBook && i > 0) {
      evals[i] = undefined;
      continue;
    }
    const t = terminal(fens[i]);
    if (t) {
      evals[i] = t;
      continue;
    }
    const [l] = await engine.analyse(fens[i], { depth: 11, movetime: 180 });
    const sign = fens[i].split(' ')[1] === 'w' ? 1 : -1;
    evals[i] = l
      ? { cp: sign * l.cp, mate: l.mate !== undefined ? sign * l.mate : undefined, best: l.move, pv: l.pv.slice(0, 6), depth: l.depth }
      : { cp: 0, pv: [], depth: 0 };
  }

  return buildGameAnalysis(g, user, hist, evals);
}
