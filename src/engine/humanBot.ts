// Choix de coup "humain". Stockfish propose plusieurs coups (MultiPV), puis le bot choisit
// comme le ferait un joueur de son niveau et de son caractere :
//
// - Attention limitee (bas Elo) : il regarde surtout la zone du dernier coup et rate ce qui se passe
//   ailleurs (piece attaquee a l'autre bout, coup en arriere, longue diagonale).
// - Biais humains : les debutants adorent prendre, donner echec, sortir la dame tot ; tout le monde
//   reprend presque automatiquement une piece qu'on vient de prendre.
// - Emotions : apres une erreur, le bot se crispe (tilt) et joue moins bien quelques coups ; en grosse
//   avance il se relache (bas Elo) ou simplifie (haut Elo) ; perdu, il cherche les coups tordus ;
//   a court de temps, il panique et joue vite.
// - Difficulte : plus la position offre de facons de se tromper, plus il se trompe.
//
// Reperes utilises (etudes sur des millions de parties Lichess et projet Maia) : les erreurs dependent
// surtout de la difficulte de la position ; le manque de temps augmente fortement les gaffes sous
// ~10 secondes ; de petites imprecisions en entrainent d'autres (tilt) ; les gaffes des joueurs humains
// sont des coups "naturels", pas des coups au hasard.
import { Chess, type Color, type Move, type Square } from 'chess.js';
import type { EngineLine } from './stockfish';
import { winChance } from './stockfish';
import type { Bot } from '../bots/roster';

interface Params {
  depth: number;
  multipv: number;
  /** Tolerance a la perte de chances de gain (plus c'est haut, plus le bot joue des coups moyens) */
  temperature: number;
  /** Probabilite de gaffe "naturelle" */
  blunder: number;
}

const TABLE: [number, Params][] = [
  [400, { depth: 3, multipv: 10, temperature: 0.2, blunder: 0.16 }],
  [800, { depth: 5, multipv: 8, temperature: 0.1, blunder: 0.07 }],
  [1200, { depth: 7, multipv: 7, temperature: 0.05, blunder: 0.03 }],
  [1600, { depth: 9, multipv: 6, temperature: 0.025, blunder: 0.012 }],
  [2000, { depth: 11, multipv: 5, temperature: 0.012, blunder: 0.004 }],
  [2300, { depth: 13, multipv: 4, temperature: 0.006, blunder: 0.0012 }],
  [2700, { depth: 16, multipv: 3, temperature: 0.0015, blunder: 0 }],
];

/** Interpolation des parametres entre les paliers du tableau */
export function paramsFor(rating: number): Params {
  if (rating <= TABLE[0][0]) return TABLE[0][1];
  for (let i = 1; i < TABLE.length; i++) {
    const [r1, p1] = TABLE[i - 1];
    const [r2, p2] = TABLE[i];
    if (rating <= r2) {
      const t = (rating - r1) / (r2 - r1);
      const lin = (a: number, b: number) => a + (b - a) * t;
      const log = (a: number, b: number) => (a === 0 || b === 0 ? lin(a, b) : Math.exp(lin(Math.log(a), Math.log(b))));
      return {
        depth: Math.round(lin(p1.depth, p2.depth)),
        multipv: Math.round(lin(p1.multipv, p2.multipv)),
        temperature: log(p1.temperature, p2.temperature),
        blunder: log(p1.blunder, p2.blunder),
      };
    }
  }
  return TABLE[TABLE.length - 1][1];
}

/* ---------------- Traits de caractere ---------------- */

export interface Traits {
  /** Envie de prendre (x poids des prises) */
  greed: number;
  /** "Je vois un echec, je le donne" */
  checks: number;
  /** Sortie precoce de la dame */
  earlyQueen: number;
  /** Envie de roquer */
  castle: number;
  /** Developpement des pieces mineures dans l'ouverture */
  develop: number;
  /** Coups vers le roi adverse (attaque) */
  attack: number;
  /** Coups calmes, sans prise ni echec */
  quiet: number;
  /** Echanges quand il mene */
  simplify: number;
  /** Accepte de sacrifier un peu pour attaquer (perte de chances toleree, 0 a 0.15) */
  sacrifice: number;
  /** Sensibilite au tilt apres une erreur (0 a 1.5) */
  tilt: number;
  /** Relachement quand il gagne largement (0 a 1) */
  relax: number;
  /** Panique a court de temps (0 a 1.5) */
  panic: number;
  /** Coups tordus quand il est perdu (0 a 1.5) */
  swindle: number;
  /** Ne laisse jamais passer une piece gratuite */
  punish: number;
}

const BASE: Traits = {
  greed: 1,
  checks: 1,
  earlyQueen: 1,
  castle: 1,
  develop: 1,
  attack: 1,
  quiet: 1,
  simplify: 1,
  sacrifice: 0,
  tilt: 0.8,
  relax: 0.5,
  panic: 1,
  swindle: 0.6,
  punish: 1,
};

/** Caractere de chaque bot (inspire des profils de joueurs reels a ce niveau) */
const TRAITS: Record<string, Partial<Traits>> = {
  // Debutant : prend tout ce qui bouge, donne tous les echecs, sort la dame, roque rarement
  pip: { greed: 2.2, checks: 2.4, earlyQueen: 2.6, castle: 0.5, develop: 0.7, tilt: 1.3, relax: 1, panic: 1.4, swindle: 0.3, punish: 0.6 },
  // Debutante appliquee : developpe et roque comme on lui a appris, mais se crispe vite
  lea: { greed: 1.6, checks: 1.5, earlyQueen: 1.4, castle: 1.8, develop: 1.6, tilt: 1.2, relax: 0.8, panic: 1.2, punish: 0.8 },
  // Agressif : echecs, attaques du roi, gambits ; perd ses moyens quand l'attaque echoue
  hugo: { greed: 1.4, checks: 2, earlyQueen: 1.6, castle: 0.6, attack: 2, quiet: 0.6, sacrifice: 0.06, tilt: 1.3, relax: 0.9, swindle: 1.2 },
  // Solide : roque, developpe, echange pour simplifier, evite les prises de pion risquees
  camille: { greed: 0.9, checks: 0.8, earlyQueen: 0.5, castle: 2.2, develop: 1.6, quiet: 1.3, simplify: 1.8, tilt: 0.7, relax: 0.4, swindle: 0.4 },
  // Tacticien : coups forcants (prises, echecs) des qu'ils tiennent la route, ne rate pas les cadeaux
  malik: { greed: 1.6, checks: 1.8, attack: 1.3, sacrifice: 0.04, punish: 2, tilt: 0.8, swindle: 1.3 },
  // Joueuse de club : punit les erreurs, echange quand elle mene
  sofia: { punish: 2.5, simplify: 1.5, castle: 1.3, tilt: 0.7, relax: 0.3, swindle: 0.9 },
  // Positionnel : coups calmes, structure, finales ; tres peu sensible a la pression
  theo: { greed: 0.8, checks: 0.7, quiet: 1.7, castle: 1.6, simplify: 2, tilt: 0.4, relax: 0.2, panic: 0.6, swindle: 0.4 },
  // Attaquante : sacrifie volontiers pour aller au roi
  ines: { checks: 1.8, attack: 2.3, quiet: 0.7, castle: 0.9, sacrifice: 0.1, tilt: 0.9, relax: 0.6, swindle: 1.4 },
  // Le Prof : equilibre, propre, simplifie quand il gagne
  prof: { castle: 1.5, develop: 1.4, simplify: 1.6, punish: 1.8, tilt: 0.4, relax: 0.2, panic: 0.7, swindle: 0.7 },
  // La Reine : sa dame est toujours active, elle se relache parfois par exces de confiance
  reine: { earlyQueen: 1.6, attack: 1.4, punish: 2, tilt: 0.5, relax: 0.6, panic: 0.6, swindle: 1 },
  // Titan : une machine, aucune emotion
  titan: { greed: 1, checks: 1, earlyQueen: 1, castle: 1, develop: 1, attack: 1, quiet: 1, simplify: 1, tilt: 0, relax: 0, panic: 0, swindle: 0, punish: 1 },
};

export const traitsOf = (bot: Bot): Traits => ({ ...BASE, ...(TRAITS[bot.id] ?? {}) });

/* ---------------- Etat d'esprit pendant la partie ---------------- */

export interface Mind {
  /** Crispation apres une erreur (0 a 1), retombe au fil des coups */
  tilt: number;
  /** Confiance (0 a 1) : monte quand il mene */
  confidence: number;
  /** Stress du temps (0 a 1) */
  panic: number;
  /** Evaluation au coup precedent (point de vue du bot, centipions) */
  lastEval: number | null;
  /** Ecart entre les deux dernieres evaluations (negatif = la position s'est degradee) */
  swing: number;
}

export const newMind = (): Mind => ({ tilt: 0, confidence: 0, panic: 0, lastEval: null, swing: 0 });

/** Etat d'esprit courant, lu par le chat pour que le bot parle de ce qu'il ressent */
let current: Mind = newMind();
export const currentMind = () => current;

/** Met a jour l'etat d'esprit au debut du tour du bot */
export function updateMind(mind: Mind, bot: Bot, evalCp: number, clock: { remainingMs: number | null; initialMs: number | null }): Mind {
  const t = traitsOf(bot);
  const strong = bot.rating >= 1800;
  const swing = mind.lastEval === null ? 0 : Math.max(-1500, Math.min(1500, evalCp)) - Math.max(-1500, Math.min(1500, mind.lastEval));
  let tilt = mind.tilt * 0.72;
  if (swing < -60) {
    const drop = Math.min(1, -swing / 400);
    // Etude sur les joueurs forts : les petites imprecisions crispent, les grosses gaffes "reveillent"
    tilt += strong && -swing >= 300 ? -0.2 : drop * t.tilt * (strong ? 0.5 : 1);
  }
  tilt = Math.max(0, Math.min(1, tilt));
  const target = evalCp >= 250 ? Math.min(1, (evalCp - 150) / 600) : 0;
  const confidence = Math.max(0, Math.min(1, mind.confidence * 0.6 + target * 0.4 - tilt * 0.2));
  let panic = 0;
  if (clock.remainingMs !== null && clock.initialMs) {
    const frac = clock.remainingMs / clock.initialMs;
    if (clock.remainingMs < 10_000) panic = 1;
    else if (clock.remainingMs < 30_000 || frac < 0.1) panic = 0.6;
    else if (frac < 0.2) panic = 0.25;
    panic *= t.panic;
  }
  current = { tilt, confidence, panic: Math.min(1, panic), lastEval: evalCp, swing };
  return current;
}

/* ---------------- Choix du coup ---------------- */

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const fileOf = (s: string) => s.charCodeAt(0) - 97;
const rankOf = (s: string) => Number(s[1]) - 1;
const dist = (a: string, b: string) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export interface MoveContext {
  ply: number;
  mind: Mind;
  /** Dernier coup adverse et dernier coup du bot (ex. "e2e4") */
  lastOpp?: string;
  lastOwn?: string;
  /** Le dernier coup adverse etait une prise */
  lastOppCapture?: boolean;
}

/** Le bot "voit"-il ce coup ? Les joueurs faibles regardent surtout pres de l'action. */
function seen(m: Move, ctx: MoveContext, rating: number, focus: string[]): boolean {
  if (rating >= 1500 || !focus.length) return true;
  // Les echecs et les reprises se voient toujours
  if (m.san.includes('+') || m.flags.includes('k') || m.flags.includes('q')) return true;
  if (ctx.lastOpp && m.to === ctx.lastOpp.slice(2, 4)) return true;
  const radius = 1 + rating / 400;
  return focus.some((f) => dist(m.from, f) <= radius || dist(m.to, f) <= radius);
}

/** Coup qui "a l'air" bon pour un humain : naturel, actif */
function bias(m: Move, bot: Bot, t: Traits, ctx: MoveContext, enemyKing: string | null): number {
  let w = 1;
  const low = bot.rating < 1200;
  const opening = ctx.ply < 16;
  if (m.captured) w *= 1 + (t.greed - 1) * (VAL[m.captured] >= 3 ? 1 : 0.6);
  if (m.san.includes('+')) w *= t.checks;
  if (ctx.lastOpp && m.captured && m.to === ctx.lastOpp.slice(2, 4)) w *= low ? 3 : 1.8; // reprise reflexe
  if (m.piece === 'q' && ctx.ply < 12) w *= t.earlyQueen;
  if (m.flags.includes('k') || m.flags.includes('q')) w *= t.castle;
  if (opening && (m.piece === 'n' || m.piece === 'b') && (m.from[1] === '1' || m.from[1] === '8')) w *= t.develop;
  if (!m.captured && !m.san.includes('+')) w *= t.quiet;
  if (enemyKing && dist(m.to, enemyKing) < dist(m.from, enemyKing) && dist(m.to, enemyKing) <= 3) w *= t.attack;
  // Les joueurs faibles ratent les coups en arriere et les longs deplacements
  const back = m.color === 'w' ? rankOf(m.to) < rankOf(m.from) : rankOf(m.to) > rankOf(m.from);
  if (bot.rating < 1600 && back && m.piece !== 'k') w *= bot.rating < 900 ? 0.45 : 0.7;
  if (bot.rating < 1000 && dist(m.from, m.to) >= 5) w *= 0.6;
  // Debutant : pousse les pions de bord au hasard dans l'ouverture
  if (bot.rating < 600 && opening && m.piece === 'p' && 'ah'.includes(m.from[0])) w *= 1.6;
  return w;
}

/* ---------------- Erreurs "trop grosses" pour etre humaines ---------------- */
// Meme a 600, un joueur reprend une piece qu'on vient de lui prendre, ne pose pas une piece la ou un pion
// la mange et sauve sa dame attaquee. Ces coups-la donnent l'impression que le bot ne connait pas
// les regles : on les ecarte (presque toujours) des gaffes et on les penalise fortement sinon.

const ATK: Record<string, number> = { ...VAL, k: 100 };
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** La piece sur `sq` peut-elle etre prise avec gain (attaquant moins cher, ou piece non defendue) ? */
function hanging(chess: Chess, sq: Square): boolean {
  const piece = chess.get(sq);
  if (!piece || piece.type === 'k') return false;
  const attackers = chess.attackers(sq, other(piece.color));
  if (!attackers.length) return false;
  if (attackers.some((a) => ATK[chess.get(a)!.type] < VAL[piece.type])) return true;
  return chess.attackers(sq, piece.color).length === 0;
}

interface Obvious {
  /** Case ou l'adversaire vient de prendre une piece qu'on peut reprendre sans perte */
  recapture: Square | null;
}

/** Ce que n'importe quel joueur remarque avant de jouer */
function obviousFacts(chess: Chess, legal: Move[], ctx: MoveContext): Obvious {
  const sq = ctx.lastOpp?.slice(2, 4) as Square | undefined;
  if (!sq || !ctx.lastOppCapture) return { recapture: null };
  const target = chess.get(sq);
  if (!target || VAL[target.type] < 3) return { recapture: null };
  // Une reprise qui ne perd pas de materiel : piece moins chere, ou case non defendue
  const ok = legal.some((m) => m.to === sq && (VAL[m.piece] <= VAL[target.type] || chess.attackers(sq, target.color).length === 0));
  return { recapture: ok ? sq : null };
}

/** Ce coup ignore-t-il quelque chose d'evident (reprise, piece posee en prise, dame/tour qui tombe) ? */
function obviousMiss(chess: Chess, m: Move, facts: Obvious): boolean {
  if (facts.recapture && m.to !== facts.recapture) return true;
  chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  try {
    // Piece posee sur une case ou elle se fait prendre (sauf si on vient de prendre aussi gros)
    if (m.piece !== 'p' && m.piece !== 'k' && hanging(chess, m.to) && !(m.captured && VAL[m.captured] >= VAL[m.piece])) return true;
    // Dame ou tour laissee en prise
    for (const row of chess.board()) {
      for (const pc of row) {
        if (pc && pc.color === m.color && (pc.type === 'q' || pc.type === 'r') && hanging(chess, pc.square)) return true;
      }
    }
    return false;
  } finally {
    chess.undo();
  }
}

/** Probabilite d'eviter une erreur evidente : quasi certaine des 1000 Elo, tres forte meme a 400 */
const avoidObvious = (rating: number) => (rating >= 1000 ? 1 : 0.9 + (0.1 * Math.max(0, rating - 400)) / 600);

export interface Choice {
  move: string;
  /** Pourquoi ce coup (pour le debug et le chat) */
  why: 'best' | 'human' | 'blunder' | 'swindle';
}

/** Choisit le coup du bot parmi les lignes du moteur et les coups "naturels" */
export function chooseMove(fen: string, bot: Bot, lines: EngineLine[], ctx: MoveContext = { ply: 0, mind: newMind() }): Choice {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) throw new Error('Aucun coup legal');
  if (lines.length === 0) return { move: legal[0].lan, why: 'best' };
  const p = paramsFor(bot.rating);
  const t = traitsOf(bot);
  const { mind } = ctx;
  const byUci = new Map(legal.map((m) => [m.lan, m]));
  const me = chess.turn();
  const enemyKing = chess.findPiece({ type: 'k', color: me === 'w' ? 'b' : 'w' })[0] ?? null;

  // Mat force : un joueur de ce niveau le voit presque toujours
  const mate = lines.find((l) => l.mate && l.mate > 0 && l.mate <= (bot.rating >= 1600 ? 4 : bot.rating >= 1000 ? 2 : 1));
  if (mate && Math.random() < 0.6 + bot.rating / 5000) return { move: mate.move, why: 'best' };

  const best = winChance(lines[0].cp);
  const evalCp = lines[0].cp;
  // Difficulte de la position : part des coups candidats qui perdent beaucoup
  const losing = lines.filter((l) => best - winChance(l.cp) > 0.15).length / lines.length;

  // Attention : zone du dernier coup adverse (et de son propre dernier coup)
  const focus = [ctx.lastOpp?.slice(2, 4), ctx.lastOpp?.slice(0, 2), ctx.lastOwn?.slice(2, 4)].filter(Boolean) as string[];
  const tunnelChance = Math.max(0, Math.min(0.8, (1500 - bot.rating) / 1300 + mind.panic * 0.2 + mind.confidence * t.relax * 0.2));
  const tunnel = Math.random() < tunnelChance;

  // Etat d'esprit -> temperature et risque de gaffe
  const relaxing = bot.rating < 1800 ? mind.confidence * t.relax : 0;
  const temp = p.temperature * (1 + 1.4 * mind.tilt + 1.2 * mind.panic + relaxing + 0.6 * losing);
  const blunderRisk = Math.min(0.3, p.blunder * (1 + 2 * mind.tilt + 2 * mind.panic + losing + relaxing * 0.8));

  // Erreurs evidentes a eviter (reprise oubliee, piece posee en prise, dame laissee attaquee)
  const facts = obviousFacts(chess, legal, ctx);
  const missMemo = new Map<string, boolean>();
  const miss = (m: Move) => {
    if (!missMemo.has(m.lan)) missMemo.set(m.lan, obviousMiss(chess, m, facts));
    return missMemo.get(m.lan)!;
  };
  const careful = Math.random() < avoidObvious(bot.rating);
  // Reprendre une piece qui vient d'etre prise : reflexe acquis des 500 Elo, jamais oublie
  const mustRecapture = facts.recapture !== null && bot.rating >= 500;
  const isRecapture = (m: Move) => m.to === facts.recapture;

  // Gaffe "naturelle" : un coup qui a l'air bien (prise, echec, coup pres de l'action), pas un coup au hasard
  if (Math.random() < blunderRisk) {
    let pool = legal.filter((m) => seen(m, ctx, bot.rating, focus));
    if (!pool.length) pool = legal;
    if (mustRecapture) {
      const r = legal.filter(isRecapture);
      if (r.length) pool = r;
    }
    // Une gaffe humaine est une erreur subtile (menace lointaine, mauvais calcul), pas un oubli des regles
    if (careful) {
      const subtle = pool.filter((m) => !miss(m));
      if (subtle.length) pool = subtle;
    }
    const cands = pool;
    const ws = cands.map((m) => bias(m, bot, t, ctx, enemyKing) * (m.captured ? 1.5 : 1));
    return { move: pickWeighted(cands, ws).lan, why: 'blunder' };
  }

  // Candidats : lignes du moteur, filtrees par l'attention du bot
  let cands = lines.filter((l) => byUci.has(l.move));
  if (tunnel) {
    const visible = cands.filter((l) => seen(byUci.get(l.move)!, ctx, bot.rating, focus));
    if (visible.length) cands = visible;
  }
  if (mustRecapture) {
    const rc = cands.filter((l) => isRecapture(byUci.get(l.move)!));
    // Sauf si le moteur voit bien mieux ailleurs (mat, prise plus grosse...)
    if (rc.length && best - Math.max(...rc.map((l) => winChance(l.cp))) < 0.15) cands = rc;
  }
  const losingBadly = evalCp <= -300;
  const ahead = evalCp >= 250;
  let why: Choice['why'] = 'human';

  const weights = cands.map((l) => {
    const m = byUci.get(l.move)!;
    const loss = Math.max(0, best - winChance(l.cp) - t.sacrifice * ((m.san.includes('+') || (enemyKing && dist(m.to, enemyKing) <= 2)) ? 1 : 0));
    let w = Math.exp(-loss / temp) * bias(m, bot, t, ctx, enemyKing);
    // Coup qui perd du materiel de facon evidente : un humain de ce niveau ne le joue presque jamais
    if (careful && loss > 0.02 && miss(m)) w *= 0.03;
    // Piece gratuite : les joueurs qui "punissent" ne la ratent pas
    if (m.captured && VAL[m.captured] >= 3 && loss < 0.05) w *= t.punish;
    // En avance : les bons joueurs echangent pour simplifier
    if (ahead && m.captured && bot.rating >= 1200 && loss < 0.06) w *= t.simplify;
    // Perdu : coups tordus (echecs, prises, menaces sur le roi) pour tenter un piege
    if (losingBadly && (m.san.includes('+') || m.captured) && loss < 0.25) w *= 1 + t.swindle;
    return w;
  });
  const chosen = pickWeighted(cands, weights);
  if (chosen === lines[0]) why = 'best';
  else if (losingBadly && byUci.get(chosen.move)?.san.includes('+')) why = 'swindle';
  return { move: chosen.move, why };
}

/** Temps de reflexion "humain" en ms */
export function thinkTime(opts: {
  remainingMs: number | null;
  incrementMs: number;
  ply: number;
  legalCount: number;
  lines: EngineLine[];
  bot?: Bot;
  mind?: Mind;
  /** Le coup choisi est une reprise sur la case du dernier coup adverse */
  recapture?: boolean;
}): number {
  const { remainingMs, incrementMs, ply, legalCount, lines, bot, mind, recapture } = opts;
  if (legalCount === 1) return 300 + Math.random() * 300;

  let base: number;
  if (remainingMs === null) base = 1400;
  else base = remainingMs / (ply < 40 ? 38 : 28) + incrementMs * 0.7;

  // Coups d'ouverture joues vite (comme un humain qui connait sa theorie)
  if (ply < 10) base *= 0.35;
  else if (ply < 16) base *= 0.7;

  // Coup evident (reprise, seul bon coup) : rapide. Position tendue : plus long.
  if (recapture) base *= 0.4;
  if (lines.length >= 2) {
    const gap = winChance(lines[0].cp) - winChance(lines[1].cp);
    if (gap > 0.25) base *= 0.45;
    else if (gap < 0.03) base *= 1.35;
  }

  if (mind && bot) {
    // Surprise : la position vient de se degrader, on reflechit plus longtemps
    if (mind.swing < -150) base *= 1.5;
    // Crispe : les faibles jouent vite et mal, les forts ralentissent pour se reprendre
    if (mind.tilt > 0.3) base *= bot.rating < 1400 ? 0.7 : 1.3;
    // En confiance : ca va plus vite
    if (mind.confidence > 0.5) base *= 0.8;
    // Panique : quelques secondes par coup
    if (mind.panic > 0.5) base *= 0.5;
  }

  // Variabilite naturelle (loi log-normale)
  const gauss = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
  base *= Math.exp(gauss * 0.45);

  const max = remainingMs === null ? 6000 : remainingMs < 10_000 ? 900 : Math.min(remainingMs * 0.15, 60_000);
  return Math.max(350, Math.min(base, max));
}

