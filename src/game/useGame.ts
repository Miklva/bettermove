import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { Color, GameResult, GameSettings, PlayedMove } from './types';
import { DEFAULT_TIME_CONTROL } from './timeControls';
import { detectResult, hasMatingMaterial, materialFromFen, other } from './rules';
import { sounds } from '../lib/sounds';
import { load, save } from '../lib/storage';
import { t } from '../i18n';

const START_FEN = new Chess().fen();
/** Alerte de pendule quand il reste 1/10 du temps de depart */
const LOW_TIME_RATIO = 0.1;

interface GameState {
  settings: GameSettings;
  moves: PlayedMove[];
  result: GameResult | null;
  /** Temps restant au debut du tour en cours (ms) */
  clock: { w: number; b: number };
  /** Horodatage du debut du tour en cours, null si la pendule ne tourne pas */
  since: number | null;
  paused: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  timeControl: DEFAULT_TIME_CONTROL,
  whiteName: t('Joueur 1'),
  blackName: t('Joueur 2'),
  autoFlip: false,
};

function initialClock(settings: GameSettings) {
  const ms = (settings.timeControl.initial ?? 0) * 1000;
  return { w: ms, b: ms };
}

function freshState(settings: GameSettings): GameState {
  return { settings, moves: [], result: null, clock: initialClock(settings), since: null, paused: false };
}

function hasClock(s: GameState) {
  return s.settings.timeControl.initial !== null;
}

/** La pendule doit-elle tourner ? (comme sur Lichess : apres le premier coup de chaque camp) */
function clockShouldRun(s: GameState) {
  return hasClock(s) && !s.result && !s.paused && s.moves.length >= 2;
}

function turnOf(s: GameState): Color {
  return s.moves.length % 2 === 0 ? 'w' : 'b';
}

/** Maintient l'invariant : since != null si et seulement si la pendule tourne */
function syncSince(s: GameState, t: number) {
  const run = clockShouldRun(s);
  if (run && s.since === null) s.since = t;
  if (!run && s.since !== null) {
    const turn = turnOf(s);
    s.clock = { ...s.clock, [turn]: Math.max(0, s.clock[turn] - (t - s.since)) };
    s.since = null;
  }
}

/** `user` : camp du joueur (contre un bot) pour distinguer "je prends" et "on me prend" */
function playMoveSound(move: Move, chess: Chess, user?: 'w' | 'b') {
  if (chess.inCheck()) sounds.check();
  else if (move.promotion) sounds.promote();
  else if (move.isKingsideCastle() || move.isQueensideCastle()) sounds.castle();
  else if (move.captured) sounds.capture(move.captured, !!user && move.color !== user);
  else sounds.move();
}

function restore(chess: Chess, storageKey: string): GameState | null {
  const saved = load<GameState | null>(storageKey, null);
  if (!saved || !Array.isArray(saved.moves)) return null;
  try {
    for (const m of saved.moves) chess.move(m.san);
  } catch {
    chess.reset();
    return null;
  }
  const s: GameState = { ...saved, since: null };
  // Apres un rechargement, la partie reprend en pause
  if (clockShouldRun({ ...s, paused: false })) s.paused = true;
  return s;
}

/**
 * Etat complet d'une partie (coups, pendules, resultat), sauvegarde sous `storageKey`.
 * Utilise par le 1v1 local et par les parties contre les bots.
 */
export function useGame(STORAGE_KEY: string, defaultSettings: GameSettings = DEFAULT_SETTINGS) {
  const chessRef = useRef<Chess>(null as unknown as Chess);
  const stateRef = useRef<GameState>(null as unknown as GameState);
  const [hadSavedGame] = useState(() => {
    chessRef.current = new Chess();
    const restored = restore(chessRef.current, STORAGE_KEY);
    stateRef.current = restored ?? freshState(load(STORAGE_KEY + '.settings', defaultSettings));
    return restored !== null;
  });
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const [viewPly, setViewPly] = useState(() => stateRef.current.moves.length);
  const [now, setNow] = useState(() => Date.now());
  // Partie reprise deja sous le seuil : pas d'alerte en arrivant
  const lowTimeWarned = useRef<{ w: boolean; b: boolean }>(
    (() => {
      const st = stateRef.current;
      const low = (st.settings.timeControl.initial ?? 0) * 1000 * LOW_TIME_RATIO;
      return { w: st.moves.length > 0 && st.clock.w < low, b: st.moves.length > 0 && st.clock.b < low };
    })(),
  );

  const s = stateRef.current;
  const chess = chessRef.current;
  const turn = turnOf(s);
  const running = s.since !== null;

  const remaining = (c: Color) => (c === turn && s.since !== null ? s.clock[c] - Math.max(0, now - s.since) : s.clock[c]);

  const endGame = useCallback((result: GameResult) => {
    const st = stateRef.current;
    st.result = result;
    syncSince(st, Date.now());
    // Son de fin selon le resultat du joueur (1v1 sur ecran : victoire de l'un des deux)
    const user = st.settings.bot ? other(st.settings.bot.color) : null;
    sounds.end(result.winner === null ? 'draw' : !user || result.winner === user ? 'win' : 'loss');
  }, []);

  // Tic de la pendule
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [running, version]);

  // Chute du drapeau + alerte de temps
  useEffect(() => {
    const st = stateRef.current;
    if (st.since === null) return;
    const t = turnOf(st);
    const left = st.clock[t] - (Date.now() - st.since);
    if (left <= 0) {
      st.clock = { ...st.clock, [t]: 0 };
      st.since = null;
      const winner = other(t);
      const lastFen = chessRef.current.fen();
      endGame(
        hasMatingMaterial(lastFen, winner)
          ? { winner, reason: `Temps écoulé pour les ${t === 'w' ? 'Blancs' : 'Noirs'}` }
          : { winner: null, reason: 'Temps écoulé, matériel insuffisant pour mater' },
      );
      bump();
      return;
    }
    // Alerte : il reste 1/10 du temps de depart (contre un bot, seulement pour le joueur)
    const initial = (st.settings.timeControl.initial ?? 0) * 1000;
    const user = st.settings.bot ? other(st.settings.bot.color) : null;
    if (initial >= 30_000 && left < initial * LOW_TIME_RATIO && !lowTimeWarned.current[t] && (!user || user === t)) {
      lowTimeWarned.current[t] = true;
      sounds.dong();
    }
  }, [now, endGame]);

  // Sauvegarde a chaque changement d'etat de la partie
  useEffect(() => {
    save(STORAGE_KEY, stateRef.current);
  }, [version]);

  // Avant de quitter la page : on fige le temps ecoule
  useEffect(() => {
    const onUnload = () => {
      const st = stateRef.current;
      if (st.since !== null) {
        st.paused = true;
        syncSince(st, Date.now());
      }
      save(STORAGE_KEY, st);
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const isPromotion = useCallback((from: string, to: string) => {
    const piece = chessRef.current.get(from as Square);
    return !!piece && piece.type === 'p' && (to[1] === '8' || to[1] === '1');
  }, []);

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const st = stateRef.current;
      const ch = chessRef.current;
      if (st.result) return false;
      const t = Date.now();
      const mover = ch.turn();
      let move: Move;
      try {
        move = ch.move({ from, to, promotion });
      } catch {
        sounds.illegal();
        bump();
        return false;
      }
      if (hasClock(st) && st.since !== null) {
        const left = st.clock[mover] - (t - st.since) + st.settings.timeControl.increment * 1000;
        st.clock = { ...st.clock, [mover]: Math.max(0, left) };
        st.since = null;
      }
      st.moves = [
        ...st.moves,
        {
          san: move.san,
          from: move.from,
          to: move.to,
          color: move.color,
          piece: move.piece,
          captured: move.captured,
          promotion: move.promotion,
          flags: move.flags,
          fen: ch.fen(),
          clockAfter: { ...st.clock },
        },
      ];
      syncSince(st, t);
      const result = detectResult(ch);
      if (result) endGame(result);
      else {
        // Contre un bot, on connait ton camp : les prises du bot ont leur propre son
        const bot = st.settings.bot;
        playMoveSound(move, ch, bot ? (bot.color === 'w' ? 'b' : 'w') : undefined);
      }
      setViewPly(st.moves.length);
      bump();
      return true;
    },
    [endGame],
  );

  const takeback = useCallback(() => {
    const st = stateRef.current;
    if (st.moves.length === 0) return;
    chessRef.current.undo();
    st.moves = st.moves.slice(0, -1);
    st.result = null;
    st.since = null;
    st.clock = st.moves.length ? { ...st.moves[st.moves.length - 1].clockAfter } : initialClock(st.settings);
    const low = (st.settings.timeControl.initial ?? 0) * 1000 * LOW_TIME_RATIO;
    lowTimeWarned.current = { w: st.clock.w < low, b: st.clock.b < low };
    syncSince(st, Date.now());
    setViewPly(st.moves.length);
    sounds.move();
    bump();
  }, []);

  const resign = useCallback(
    (color: Color, reason?: string) => {
      const st = stateRef.current;
      if (st.result) return;
      const name = color === 'w' ? st.settings.whiteName : st.settings.blackName;
      endGame({ winner: other(color), reason: reason ?? `${name} abandonne` });
      bump();
    },
    [endGame],
  );

  const agreeDraw = useCallback(() => {
    if (stateRef.current.result) return;
    endGame({ winner: null, reason: 'Nulle par accord mutuel' });
    bump();
  }, [endGame]);

  const togglePause = useCallback(() => {
    const st = stateRef.current;
    if (st.result || !hasClock(st)) return;
    const t = Date.now();
    // On fige d'abord le temps du tour en cours, puis on bascule
    st.paused = !st.paused;
    syncSince(st, t);
    setNow(t);
    bump();
  }, []);

  const newGame = useCallback((settings: GameSettings) => {
    chessRef.current.reset();
    stateRef.current = freshState({ ...settings, gameId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    lowTimeWarned.current = { w: false, b: false };
    save(STORAGE_KEY + '.settings', settings);
    setViewPly(0);
    setNow(Date.now());
    sounds.start();
    bump();
  }, []);

  const pgn = useCallback(() => {
    const st = stateRef.current;
    const pg = new Chess();
    const d = new Date();
    const tc = st.settings.timeControl;
    const resultTag = !st.result ? '*' : st.result.winner === 'w' ? '1-0' : st.result.winner === 'b' ? '0-1' : '1/2-1/2';
    pg.setHeader('Event', st.settings.bot ? t('Partie contre un bot') : t('Partie locale'));
    pg.setHeader('Site', 'BetterMove');
    pg.setHeader('Date', `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
    pg.setHeader('White', st.settings.whiteName);
    pg.setHeader('Black', st.settings.blackName);
    pg.setHeader('Result', resultTag);
    pg.setHeader('TimeControl', tc.initial === null ? '-' : `${tc.initial}+${tc.increment}`);
    if (st.result) pg.setHeader('Termination', st.result.reason);
    for (const m of st.moves) pg.move(m.san);
    const text = pg.pgn();
    return text.endsWith(resultTag) ? text : `${text} ${resultTag}`.trim();
  }, []);

  // Etat derive pour l'affichage
  const live = viewPly === s.moves.length;
  const viewFen = viewPly === 0 ? START_FEN : s.moves[viewPly - 1]?.fen ?? START_FEN;
  const viewTurn: Color = viewPly % 2 === 0 ? 'w' : 'b';
  const viewLast = viewPly > 0 ? s.moves[viewPly - 1] : undefined;
  const lastMove = viewLast ? `${viewLast.from}${viewLast.to}` : '';
  const inCheck = !!viewLast && /[+#]$/.test(viewLast.san);
  const canMove = live && !s.result && !s.paused;

  const dests = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!canMove) return map;
    for (const m of chess.moves({ verbose: true })) {
      const arr = map.get(m.from);
      if (arr) arr.push(m.to);
      else map.set(m.from, [m.to]);
    }
    return map;
  }, [version, canMove]);

  const material = useMemo(() => materialFromFen(viewFen), [viewFen]);

  return {
    hadSavedGame,
    liveFen: chess.fen(),
    version,
    settings: s.settings,
    moves: s.moves,
    result: s.result,
    paused: s.paused,
    hasClock: hasClock(s),
    running,
    turn,
    remaining,
    viewPly,
    setViewPly: (p: number) => setViewPly(Math.max(0, Math.min(s.moves.length, p))),
    live,
    viewFen,
    viewTurn,
    lastMove,
    inCheck,
    canMove,
    dests,
    material,
    isPromotion,
    makeMove,
    takeback,
    resign,
    agreeDraw,
    togglePause,
    newGame,
    pgn,
  };
}

export type Game = ReturnType<typeof useGame>;
