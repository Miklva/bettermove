// Les differents types d'etapes d'une lecon : theorie, quiz, serie de problemes, defi contre Stockfish.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Board } from '../components/Board';
import { HistoryNavBar, positionsFrom, useHistoryNav } from '../components/HistoryNav';
import type { Step } from './courses';
import { formatSan } from '../lib/notation';
import { useSettings } from '../settings/settings';
import { sounds } from '../lib/sounds';
import { engine } from '../engine/stockfish';
import { markSeen, nextPuzzle, type Puzzle } from '../puzzles/db';
import { PuzzleSolver, type SolveFinish, type SolveResult } from '../puzzles/PuzzleSolver';
import { THEMES } from '../puzzles/themes';
import { XP } from '../rating/xp';
import type { PlayerProfile } from '../rating/profile';
import { collectMoves, collectPar, xySq } from './collect';

export interface StepOutcome {
  errors: number;
  xp: number;
}

interface StepProps<T extends Step['type']> {
  step: Extract<Step, { type: T }>;
  onDone: (o: StepOutcome) => void;
  /** Bandeau de progression de la lecon */
  header: React.ReactNode;
}

const NO_DESTS = new Map<string, string[]>();
const colorOf = (fen: string) => (new Chess(fen).turn() === 'w' ? 'white' : 'black');

function lastMoveOf(c: Chess) {
  const h = c.history({ verbose: true });
  const l = h[h.length - 1];
  return l ? `${l.from}${l.to}` : '';
}

/** Plateau en lecture seule (theorie, quiz) */
function StaticBoard({ fen, shapes, lastMove = '', orientation }: { fen: string; shapes?: { orig: string; dest?: string; brush: string }[]; lastMove?: string; orientation?: 'white' | 'black' }) {
  const c = useMemo(() => new Chess(fen), [fen]);
  return (
    <Board
      fen={fen}
      orientation={orientation ?? 'white'}
      turnColor={c.turn() === 'w' ? 'white' : 'black'}
      dests={NO_DESTS}
      lastMove={lastMove}
      inCheck={c.inCheck()}
      premovable={false}
      shapes={shapes}
      resetToken={0}
      onMove={() => undefined}
    />
  );
}

/* ---------------- Theorie ---------------- */

export function TheoryStep({ step, onDone, header }: StepProps<'theory'>) {
  const { settings } = useSettings();
  // Positions de la demonstration : depart puis apres chaque coup
  const demo = useMemo(() => {
    if (!step.fen) return { positions: [], sans: [] as string[] };
    const c = new Chess(step.fen);
    const moves = (step.line ?? []).map((u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }));
    return { positions: positionsFrom(step.fen, moves), sans: moves.map((m) => m.san) };
  }, [step]);
  const last = Math.max(0, demo.positions.length - 1);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(false);
  };

  /** Va a une position de la demonstration (avec le son du coup si on avance d'un coup) */
  const show = (i: number, withSound: boolean) => {
    const n = Math.max(0, Math.min(last, i));
    if (withSound && n > 0) {
      const c = new Chess(demo.positions[n].fen);
      const prev = new Chess(demo.positions[n - 1].fen);
      const to = demo.positions[n].lastMove.slice(2, 4);
      if (c.isCheckmate()) sounds.gameEnd();
      else if (c.inCheck()) sounds.check();
      else if (prev.get(to as Square)) sounds.capture(prev.get(to as Square)!.type);
      else sounds.move();
    }
    setIdx(n);
  };

  const replay = () => {
    if (!last) return;
    stop();
    setIdx(0);
    setPlaying(true);
    for (let i = 1; i <= last; i++) {
      timers.current.push(
        window.setTimeout(() => {
          show(i, true);
          if (i === last) setPlaying(false);
        }, 1100 + (i - 1) * 950),
      );
    }
  };

  useEffect(() => {
    setIdx(0);
    replay();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Navigation au clavier dans la demonstration (interrompt l'animation)
  useEffect(() => {
    if (!last) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') show(idx - 1, false);
      else if (e.key === 'ArrowRight') show(idx + 1, true);
      else if (e.key === 'ArrowUp') show(0, false);
      else if (e.key === 'ArrowDown') show(last, false);
      else return;
      e.preventDefault();
      stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const nav = {
    idx,
    last,
    isLive: idx === last,
    current: demo.positions[idx],
    go: (i: number) => {
      stop();
      show(i, i === idx + 1);
    },
  };
  const fen = demo.positions[idx]?.fen ?? step.fen ?? '';
  const lastMove = demo.positions[idx]?.lastMove ?? '';
  const startTurn = step.fen ? new Chess(step.fen).turn() : 'w';
  const startNum = step.fen ? new Chess(step.fen).moveNumber() : 1;

  const shapes = [
    ...(step.arrows ?? []).map(([orig, dest, brush]) => ({ orig, dest, brush })),
    ...(step.circles ?? []).map(([orig, brush]) => ({ orig, brush })),
  ];
  // Fleches affichees seulement sur la position de depart (elles la decrivent)
  const showShapes = idx === 0;
  const card = (
    <div className="card lesson-text">
      <h2>{step.title}</h2>
      <p>{step.text}</p>
      {demo.sans.length > 0 && (
        <div className="demo-moves">
          {demo.sans.map((san, i) => {
            const ply = i + (startTurn === 'b' ? 1 : 0);
            const num = startNum + Math.floor(ply / 2);
            const prefix = ply % 2 === 0 ? `${num}. ` : i === 0 ? `${num}... ` : '';
            return (
              <button key={i} className={`demo-move ${idx === i + 1 ? 'current' : ''}`} onClick={() => nav.go(i + 1)}>
                {prefix}
                {formatSan(san, settings.notation)}
              </button>
            );
          })}
        </div>
      )}
      {demo.sans.length > 0 && <p className="muted small">Navigue dans la démonstration avec ← → ou les boutons sous le plateau.</p>}
      <div className="row">
        {step.line?.length ? (
          <button className="btn" onClick={replay} disabled={playing}>
            ↺ Revoir
          </button>
        ) : null}
        <button className="btn primary" onClick={() => onDone({ errors: 0, xp: 0 })}>
          Continuer
        </button>
      </div>
    </div>
  );

  if (!step.fen)
    return (
      <div className="lesson-solo">
        {header}
        {card}
      </div>
    );

  return (
    <>
      <div className="lesson-header-inline">{header}</div>
      <div className="play">
      <section className="board-col">
        <div className="board-stage">
          <StaticBoard fen={fen} shapes={showShapes ? shapes : []} lastMove={lastMove} orientation="white" />
        </div>
        {last > 0 && <HistoryNavBar nav={nav} liveLabel={`Fin de la démonstration (${last} coups)`} />}
      </section>
      <aside className="side flush">{card}</aside>
      </div>
    </>
  );
}

/* ---------------- Quiz ---------------- */

export function QuizStep({ step, onDone, header }: StepProps<'quiz'>) {
  const { settings } = useSettings();
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [step]);

  const options = useMemo(
    () =>
      step.options.map((u) => {
        const c = new Chess(step.fen);
        const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        return { uci: u, san: formatSan(m.san, settings.notation), from: m.from, to: m.to };
      }),
    [step, settings.notation],
  );

  const right = picked === step.answer;
  const shapes =
    picked === null
      ? []
      : [
          { orig: options[step.answer].from, dest: options[step.answer].to, brush: 'green' },
          ...(right ? [] : [{ orig: options[picked].from, dest: options[picked].to, brush: 'red' }]),
        ];

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === step.answer) sounds.success();
    else sounds.fail();
  };

  return (
    <>
      <div className="lesson-header-inline">{header}</div>
      <div className="play">
      <section className="board-col">
        <div className="board-stage">
          <StaticBoard fen={step.fen} shapes={shapes} orientation={colorOf(step.fen)} />
        </div>
      </section>
      <aside className="side flush">
        <div className={`card lesson-text feedback ${picked === null ? '' : right ? 'success' : 'fail'}`}>
          <h2>Quiz</h2>
          <p>{step.question}</p>
          <div className="quiz-options">
            {options.map((o, i) => (
              <button
                key={o.uci}
                className={`quiz-option ${picked === null ? '' : i === step.answer ? 'right' : i === picked ? 'wrong' : 'dim'}`}
                onClick={() => choose(i)}
              >
                {o.san}
              </button>
            ))}
          </div>
          {picked !== null && (
            <>
              <div className="status">{right ? '✓ Exact !' : '✗ Pas tout à fait'}</div>
              <p>{step.explain}</p>
              <button
                className="btn primary wide"
                onClick={() => onDone({ errors: right ? 0 : 1, xp: right ? XP.quizRight : 0 })}
              >
                Continuer
              </button>
            </>
          )}
        </div>
      </aside>
      </div>
    </>
  );
}

/* ---------------- Serie de problemes ---------------- */

export function PuzzleSetStep({ step, onDone, header, player }: StepProps<'puzzles'> & { player: PlayerProfile }) {
  const [index, setIndex] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totals = useRef<StepOutcome>({ errors: 0, xp: 0 });
  const rating = player.profile.puzzles.rating;

  const load = async () => {
    setPuzzle(null);
    setError(null);

    try {
      // Mode guide : problemes faciles ; entrainement : a ton niveau
      const target = step.mode === 'guided' ? Math.min(900, rating - 250) : rating;
      const p = await nextPuzzle(Math.round(target), step.theme);
      markSeen(p.id);
      setPuzzle(p);
    } catch {
      setError('Pas de problème disponible pour ce thème.');
    }
  };

  useEffect(() => {
    totals.current = { errors: 0, xp: 0 };
    setIndex(0);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const finished = useRef(false);

  // Classement problemes (entrainement uniquement) : meme regle que le mode Problemes
  const onResult = (r: SolveResult) => {

    if (step.mode === 'practice' && puzzle)
      player.recordPuzzle(puzzle, r.win ? (r.usedHint ? 'assisted' : 'win') : 'fail', 1, r.seconds);
  };

  // XP et erreurs de la lecon : rien si un indice ou la solution ont ete vus
  const onFinish = (f: SolveFinish) => {
    finished.current = true;
    if (f.solved && !f.usedHint && f.firstTry) totals.current.xp += XP.lessonPuzzleFirstTry;
    else {
      totals.current.errors += 1;
      if (f.solved && !f.usedHint) totals.current.xp += XP.lessonPuzzleRetry;
    }
  };

  const next = () => {
    if (!finished.current) {
      // Probleme quitte sans etre termine : compte comme une erreur
      totals.current.errors += 1;
    }
    finished.current = false;
    if (index + 1 >= step.count) onDone(totals.current);
    else {
      setIndex(index + 1);
      load();
    }
  };

  const theme = THEMES[step.theme];
  const progress = (
    <div className="card lesson-progress-card">
      <div className="tc-label">{step.mode === 'guided' ? 'Exercices guidés' : 'Entraînement à ton niveau'}</div>
      <div className="status">
        {step.title} · {index + 1}/{step.count}
      </div>
      <div className="mini-dots">
        {Array.from({ length: step.count }, (_, i) => (
          <span key={i} className={i < index ? 'done' : i === index ? 'current' : ''} />
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="lesson-header-inline">{header}</div>
      <PuzzleSolver
        puzzle={puzzle}
        error={error}
        onResult={onResult}
        onFinish={onFinish}
        onNext={next}
        nextLabel={index + 1 >= step.count ? 'Continuer' : 'Problème suivant'}
        guidance={step.mode === 'guided' && theme ? `${theme.label} : ${theme.tip ?? ''}` : undefined}
        allowSkip={false}
        sideTop={progress}
        onRetryLoad={() => onDone(totals.current)}
      />
    </>
  );
}

/* ---------------- Defi contre Stockfish ---------------- */

type GoalState = 'playing' | 'thinking' | 'success' | 'failed';

export function GoalStep({ step, onDone, header }: StepProps<'goal'>) {
  const { settings } = useSettings();
  const chess = useRef(new Chess(step.fen));
  const [fen, setFen] = useState(step.fen);
  const [lastMove, setLastMove] = useState('');
  const [state, setState] = useState<GoalState>('playing');
  const [message, setMessage] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const userColor = new Chess(step.fen).turn();
  const them = userColor === 'w' ? 'b' : 'w';

  const userMoves = Math.ceil(chess.current.history().length / 2);

  /** Generation de la tentative : ignore une reponse du moteur arrivee apres un "Recommencer" */
  const gen = useRef(0);

  const restart = () => {
    gen.current++;
    engine.stop();
    chess.current = new Chess(step.fen);
    setFen(step.fen);
    setLastMove('');
    setMessage(null);
    setState('playing');
  };

  useEffect(() => {
    restart();
    setAttempts(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const pieceCount = (color: 'w' | 'b', types: string[]) =>
    chess.current
      .board()
      .flat()
      .filter((p) => p && p.color === color && types.includes(p.type)).length;

  const fail = (msg: string) => {
    setState('failed');
    setMessage(msg);
    setAttempts((a) => a + 1);
    sounds.fail();
  };
  const win = (msg: string) => {
    setState('success');
    setMessage(msg);
    sounds.success();
  };

  /** Verifie l'objectif apres chaque demi-coup. Renvoie true si l'etape est terminee. */
  const check = (byUser: boolean, promoted?: boolean): boolean => {
    const c = chess.current;
    if (c.isCheckmate()) {
      if (c.turn() === them) {
        win('Échec et mat ! Bravo.');
      } else fail('Tu t’es fait mater…');
      return true;
    }
    if (step.goal === 'hold') {
      if (c.isDraw() || c.isStalemate()) {
        win('Partie nulle : tu as tenu la position. Mission accomplie.');
        return true;
      }
      if (!byUser && promoted) {
        fail('Le pion adverse a fait dame : la défense a cédé. Recommence.');
        return true;
      }
      if (pieceCount(userColor, ['r', 'q']) === 0 && pieceCount(them, ['r', 'q']) > 0) {
        fail('Tu as perdu ta tour : la position n’est plus tenable.');
        return true;
      }
      if (byUser && Math.ceil(c.history().length / 2) >= step.maxMoves) {
        win(`Tu as tenu ${step.maxMoves} coups sans craquer : c’est nul. Bravo !`);
        return true;
      }
      return false;
    }
    if (c.isStalemate()) {
      fail('Pat ! Le roi adverse n’avait plus de coup légal sans être en échec : la partie est nulle. Laisse-lui toujours une case.');
      return true;
    }
    if (step.goal === 'promote' && byUser && promoted) {
      win('Promotion réussie : la partie est gagnée.');
      return true;
    }
    // La promotion adverse se verifie AVANT le compte des pions (un pion promu disparait aussi)
    if (step.goal === 'capturePawns' && !byUser && promoted) {
      fail('Trop tard, le pion a fait dame. Ton roi n’était pas dans le carré.');
      return true;
    }
    if (step.goal === 'capturePawns' && pieceCount(them, ['p']) === 0) {
      win('Pion rattrapé : la règle du carré a fonctionné.');
      return true;
    }
    if (step.goal !== 'capturePawns' && pieceCount(userColor, ['p', 'n', 'b', 'r', 'q']) === 0) {
      fail('Tu as perdu ta dernière pièce : impossible de gagner.');
      return true;
    }
    if (c.isDraw()) {
      fail('Partie nulle (répétition ou matériel insuffisant).');
      return true;
    }
    if (byUser && step.goal !== 'capturePawns' && Math.ceil(c.history().length / 2) >= step.maxMoves) {
      fail(`Limite de ${step.maxMoves} coups atteinte. Recommence en étant plus direct.`);
      return true;
    }
    return false;
  };

  const engineReply = async () => {
    setState('thinking');
    const myGen = gen.current;
    try {
      const [line] = await engine.analyse(chess.current.fen(), { depth: 12 });
      if (!line) return;
      await new Promise((r) => setTimeout(r, 350));
      if (myGen !== gen.current) return;
      const u = line.move;
      const m = chess.current.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      setFen(chess.current.fen());
      setLastMove(`${m.from}${m.to}`);
      if (chess.current.inCheck()) sounds.check();
      // Reponse de Stockfish : c'est une de tes pieces qui tombe
      else if (m.captured) sounds.capture(m.captured, true);
      else sounds.move();
      if (!check(false, !!m.promotion)) setState('playing');
    } catch {
      setState('playing');
    }
  };

  const onMove = (from: string, to: string) => {
    if (state !== 'playing') return;
    const piece = chess.current.get(from as Square);
    const promotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined;
    let m;
    try {
      m = chess.current.move({ from, to, promotion });
    } catch {
      setResetToken((x) => x + 1);
      return;
    }
    setFen(chess.current.fen());
    setLastMove(lastMoveOf(chess.current));
    if (chess.current.inCheck()) sounds.check();
    else if (m.captured) sounds.capture(m.captured);
    else sounds.move();
    if (!check(true, !!m.promotion)) engineReply();
  };

  const dests = useMemo(() => {
    const map = new Map<string, string[]>();
    if (state !== 'playing') return map;
    for (const m of new Chess(fen).moves({ verbose: true })) map.set(m.from, [...(map.get(m.from) ?? []), m.to]);
    return map;
  }, [fen, state]);

  const positions = useMemo(
    () => positionsFrom(step.fen, chess.current.history({ verbose: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fen, step.fen],
  );
  const nav = useHistoryNav(positions);
  const shownFen = nav.isLive ? fen : nav.current.fen;
  const c = new Chess(shownFen);
  const history = chess.current.history();

  return (
    <>
      <div className="lesson-header-inline">{header}</div>
      <div className="play">
      <section className="board-col">
        <div className="board-stage">
          <Board
            fen={shownFen}
            orientation={userColor === 'w' ? 'white' : 'black'}
            turnColor={c.turn() === 'w' ? 'white' : 'black'}
            movableColor={state === 'playing' && nav.isLive ? (userColor === 'w' ? 'white' : 'black') : undefined}
            dests={dests}
            lastMove={nav.isLive ? lastMove : nav.current.lastMove}
            inCheck={c.inCheck()}
            premovable={false}
            resetToken={resetToken}
            onMove={onMove}
          />
        </div>
        <HistoryNavBar nav={nav} />
      </section>
      <aside className="side flush">
        <div className={`card lesson-text feedback ${state === 'success' ? 'success' : state === 'failed' ? 'fail' : ''}`}>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
          {step.goal !== 'capturePawns' && (
            <div className="goal-counter">
              {step.goal === 'hold' ? 'Tenir : coup' : 'Coup'} <b>{Math.min(userMoves + (state === 'playing' ? 1 : 0), step.maxMoves)}</b> / {step.maxMoves}
              <div className="bar">
                <span style={{ width: `${Math.min(100, (userMoves / step.maxMoves) * 100)}%` }} />
              </div>
            </div>
          )}
          {state === 'thinking' && <p className="muted">Stockfish réfléchit…</p>}
          {message && <div className="status">{message}</div>}
          {history.length > 0 && (
            <p className="muted small">
              {history
                .map((san, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '') + formatSan(san, settings.notation))
                .join(' ')}
            </p>
          )}
          <ul className="tips">
            {step.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="row">
            {state === 'success' ? (
              <button
                className="btn primary wide"
                onClick={() => onDone({ errors: attempts, xp: attempts === 0 ? XP.goalFirstTry : XP.goalRetry })}
              >
                Continuer
              </button>
            ) : (
              <>
                <button className={`btn ${state === 'failed' ? 'primary' : ''}`} onClick={restart}>
                  Recommencer
                </button>
                {attempts >= 2 && (
                  <button className="btn ghost" onClick={() => onDone({ errors: attempts + 1, xp: 0 })}>
                    Passer
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
      </div>
    </>
  );
}

/* ---------------- Initiation : deplacer une piece pour prendre les cibles ---------------- */

const PIECE_NAME: Record<string, string> = { R: 'la tour', B: 'le fou', Q: 'la dame', N: 'le cavalier', K: 'le roi', P: 'le pion' };

function collectFen(piece: string, at: string, targets: Set<string>, blockers: string[]) {
  const rows: string[] = [];
  for (let y = 7; y >= 0; y--) {
    let row = '';
    let empty = 0;
    for (let x = 0; x < 8; x++) {
      const s = xySq(x, y);
      const ch = s === at ? piece : targets.has(s) ? 'p' : blockers.includes(s) ? 'P' : '';
      if (!ch) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += ch;
      }
    }
    rows.push(row + (empty ? empty : ''));
  }
  return `${rows.join('/')} w - - 0 1`;
}

export function CollectStep({ step, onDone, header }: StepProps<'collect'>) {
  const blockers = step.blockers ?? [];
  const par = useMemo(() => collectPar(step.piece, step.start, step.targets, blockers), [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const [at, setAt] = useState(step.start);
  const [left, setLeft] = useState(() => new Set(step.targets));
  const [moves, setMoves] = useState(0);
  const [last, setLast] = useState('');
  const [piece, setPiece] = useState<string>(step.piece);
  const done = left.size === 0;

  const reset = () => {
    setAt(step.start);
    setLeft(new Set(step.targets));
    setMoves(0);
    setLast('');
    setPiece(step.piece);
  };
  useEffect(reset, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const dests = useMemo(() => {
    if (done) return NO_DESTS;
    return new Map([[at, collectMoves(piece, at, left, new Set(blockers))]]);
  }, [at, left, piece, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (from: string, to: string) => {
    if (from !== at) return;
    const next = new Set(left);
    const took = next.delete(to);
    setLeft(next);
    setAt(to);
    setLast(from + to);
    setMoves((m) => m + 1);
    // Promotion du pion en dame sur la derniere rangee
    if (piece === 'P' && to[1] === '8') setPiece('Q');
    if (next.size === 0) sounds.success();
    else if (took) sounds.capture('p');
    else sounds.move();
  };

  const extra = Math.max(0, moves - par);
  const stars = extra === 0 ? 3 : extra <= 2 ? 2 : 1;
  return (
    <>
      <div className="lesson-header-inline">{header}</div>
      <div className="play">
        <section className="board-col">
          <div className="board-stage">
            <Board
              fen={collectFen(piece, at, left, blockers)}
              orientation="white"
              turnColor="white"
              movableColor={done ? undefined : 'white'}
              dests={dests}
              lastMove={last}
              inCheck={false}
              premovable={false}
              resetToken={moves}
              onMove={onMove}
            />
          </div>
        </section>
        <aside className="side flush">
          <div className={`card lesson-text feedback ${done ? 'success' : ''}`}>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
            <div className="goal-counter">
              Coups joués <b>{moves}</b> · objectif <b>{par}</b> · cibles restantes <b>{left.size}</b>
            </div>
            {done ? (
              <>
                <div className="status">
                  {extra === 0 ? `Parfait : en ${par} coup${par > 1 ? 's' : ''}, le minimum !` : `Bravo ! Possible en ${par} coup${par > 1 ? 's' : ''}, retente pour faire mieux.`}{' '}
                  {'★'.repeat(stars)}
                </div>
                <div className="row">
                  <button className="btn" onClick={reset}>
                    Recommencer
                  </button>
                  <button className="btn primary" onClick={() => onDone({ errors: Math.min(3, extra), xp: extra === 0 ? XP.quizRight * 2 : XP.quizRight })}>
                    Continuer
                  </button>
                </div>
              </>
            ) : (
              <p className="muted small">
                Déplace {PIECE_NAME[step.piece]} pour prendre tous les pions noirs.{blockers.length ? ' Tes propres pions bloquent le passage.' : ''}
              </p>
            )}
            {step.tips && (
              <ul className="tips">
                {step.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {!done && moves > 0 && (
              <button className="btn ghost" onClick={reset}>
                Recommencer
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

/* ---------------- Question a choix ---------------- */

export function ChoiceStep({ step, onDone, header }: StepProps<'choice'>) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [step]);
  const right = picked === step.answer;
  const shapes = [
    ...(step.arrows ?? []).map(([o, d, b]) => ({ orig: o, dest: d, brush: b })),
    ...(step.circles ?? []).map(([o, b]) => ({ orig: o, brush: b })),
  ];
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === step.answer) sounds.success();
    else sounds.fail();
  };
  return (
    <>
      <div className="lesson-header-inline">{header}</div>
      <div className={step.fen ? 'play' : 'play no-board'}>
        {step.fen && (
          <section className="board-col">
            <div className="board-stage">
              <StaticBoard fen={step.fen} shapes={shapes} />
            </div>
          </section>
        )}
        <aside className="side flush">
          <div className={`card lesson-text feedback ${picked === null ? '' : right ? 'success' : 'fail'}`}>
            <h2>Question</h2>
            <p>{step.question}</p>
            <div className="quiz-options column">
              {step.options.map((o, i) => (
                <button
                  key={o}
                  className={`quiz-option ${picked === null ? '' : i === step.answer ? 'right' : i === picked ? 'wrong' : 'dim'}`}
                  onClick={() => choose(i)}
                >
                  {o}
                </button>
              ))}
            </div>
            {picked !== null && (
              <>
                <div className="status">{right ? '✓ Exact !' : '✗ Pas tout à fait'}</div>
                <p>{step.explain}</p>
                <button className="btn primary wide" onClick={() => onDone({ errors: right ? 0 : 1, xp: right ? XP.quizRight : 0 })}>
                  Continuer
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
