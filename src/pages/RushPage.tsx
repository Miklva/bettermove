// Puzzle Rush : un maximum de problemes en temps limite, 3 erreurs et c'est fini.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Board } from '../components/Board';
import { nextPuzzle, type Puzzle } from '../puzzles/db';
import { sounds } from '../lib/sounds';
import { earn } from '../shop/store';
import { apiCall } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { addMistakes } from '../review/store';
import { loadRush, recordRun, rushTarget, RUSH_MODES, RUSH_STRIKES, type RushMode } from '../rush/store';
import { Avatar } from '../profile/avatar';
import { useRouteTab } from '../router';
import { track } from '../achievements/events';

interface Props {
  player: { grantXp: (n: number) => void };
}

type Phase = 'menu' | 'loading' | 'playing' | 'over';
interface Done {
  puzzle: Puzzle;
  ok: boolean;
}
interface Top {
  all: { username: string; score: number }[];
  today: { username: string; score: number }[];
}

const toCg = (c: 'w' | 'b') => (c === 'w' ? 'white' : 'black');

function destsOf(c: Chess) {
  const d = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) d.set(m.from, [...(d.get(m.from) ?? []), m.to]);
  return d;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RushPage({ player }: Props) {
  const sync = useSync();
  const logged = !!sync.user && sync.status !== 'offline';
  const [mode, setMode] = useState<RushMode>(() => (localStorage.getItem('bettermove.rushMode') as RushMode) || '3');
  const [phase, setPhase] = useState<Phase>('menu');
  useRouteTab(2, mode, setMode, { '3': '3-min', '5': '5-min', survival: 'survie' }, phase === 'menu');
  const [data, setData] = useState(loadRush);
  const [top, setTop] = useState<Top | null>(null);
  const [topTab, setTopTab] = useState<'today' | 'all'>('all');
  const [topErr, setTopErr] = useState(false);

  // Partie en cours
  const chess = useRef(new Chess());
  const [fen, setFen] = useState(chess.current.fen());
  const [lastMove, setLastMove] = useState('');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const ply = useRef(0);
  const [locked, setLocked] = useState(true);
  const [done, setDone] = useState<Done[]>([]);
  const [shapes, setShapes] = useState<{ orig: string; dest?: string; brush: string }[]>([]);
  const [flash, setFlash] = useState<'ok' | 'ko' | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<{ score: number; record: boolean; coins: number; rank?: number; reason: string } | null>(
    null,
  );
  const queue = useRef<Promise<Puzzle>[]>([]);
  const used = useRef(new Set<string>());
  const index = useRef(0);
  const timers = useRef<number[]>([]);
  const over = useRef(false);

  const cfg = RUSH_MODES.find((m) => m.id === mode)!;
  const score = done.filter((d) => d.ok).length;
  const strikes = done.filter((d) => !d.ok).length;

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const loadTop = useCallback(() => {
    setTopErr(false);
    apiCall<Top>(`/rush/top?mode=${mode}`)
      .then(setTop)
      .catch(() => {
        setTop(null);
        setTopErr(true);
      });
  }, [mode]);
  useEffect(() => {
    if (phase === 'menu' || phase === 'over') loadTop();
  }, [phase, loadTop]);

  // File de problemes prechargee (toujours 2 d'avance)
  const fetchOne = async (n: number): Promise<Puzzle> => {
    for (let i = 0; i < 4; i++) {
      const p = await nextPuzzle(rushTarget(n));
      if (!used.current.has(p.id)) {
        used.current.add(p.id);
        return p;
      }
    }
    return nextPuzzle(rushTarget(n) + 100);
  };
  const fill = () => {
    while (queue.current.length < 2) {
      const n = index.current + queue.current.length;
      const pr = fetchOne(n);
      pr.catch(() => undefined);
      queue.current.push(pr);
    }
  };

  const syncBoard = () => {
    setFen(chess.current.fen());
    const h = chess.current.history({ verbose: true });
    const l = h[h.length - 1];
    setLastMove(l ? l.from + l.to : '');
  };

  const playUci = (u: string, opponent: boolean) => {
    const m = chess.current.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    syncBoard();
    if (m.captured) sounds.capture(m.captured, opponent);
    else if (chess.current.inCheck()) sounds.check();
    else sounds.move();
  };

  const finish = useCallback(
    (reason: string, list: Done[]) => {
      if (over.current) return;
      over.current = true;
      timers.current.forEach(clearTimeout);
      setLocked(true);
      const sc = list.filter((d) => d.ok).length;
      const record = recordRun(mode, sc);
      const coins = Math.floor(sc / 2) + (record && sc > 0 ? 10 : 0);
      earn(coins, `Puzzle Rush : ${sc}`, true);
      player.grantXp(Math.min(40, sc * 2));
      track('rush-run');
      track('rush-points', sc);
      // Les problemes rates rejoignent les revisions
      const missed = list.filter((d) => !d.ok).map((d) => ({ ...d.puzzle, origin: `Puzzle Rush (${d.puzzle.rating} Elo)` }));
      addMistakes(missed);
      sounds.gameEnd();
      setData(loadRush());
      setResult({ score: sc, record, coins, reason });
      setPhase('over');
      if (logged && sc > 0)
        apiCall<{ rank: number }>('/rush', { method: 'POST', body: JSON.stringify({ mode, score: sc }) })
          .then((r) => {
            setResult((x) => (x ? { ...x, rank: r.rank } : x));
            loadTop();
          })
          .catch(() => undefined);
    },
    [mode, logged, player, loadTop],
  );

  const showNext = async () => {
    fill();
    const pr = queue.current.shift()!;
    let p: Puzzle;
    try {
      p = await pr;
    } catch {
      finish('Impossible de charger les problèmes', doneRef.current);
      return;
    }
    if (over.current) return;
    index.current++;
    fill();
    chess.current = new Chess(p.fen);
    ply.current = 0;
    setShapes([]);
    setPuzzle(p);
    syncBoard();
    setLocked(true);
    later(() => {
      playUci(p.moves[0], true);
      ply.current = 1;
      setLocked(false);
    }, 280);
  };

  const doneRef = useRef<Done[]>([]);
  const push = (d: Done) => {
    const list = [...doneRef.current, d];
    doneRef.current = list;
    setDone(list);
    return list;
  };

  const start = async () => {
    localStorage.setItem('bettermove.rushMode', mode);
    over.current = false;
    used.current = new Set();
    queue.current = [];
    index.current = 0;
    doneRef.current = [];
    setDone([]);
    setResult(null);
    setPhase('loading');
    fill();
    try {
      await queue.current[0];
    } catch {
      setPhase('menu');
      return;
    }
    sounds.start();
    setPhase('playing');
    setEndAt(cfg.seconds ? Date.now() + cfg.seconds * 1000 : null);
    setNow(Date.now());
    void showNext();
  };

  // Chrono
  useEffect(() => {
    if (phase !== 'playing' || endAt === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) finish('Temps écoulé', doneRef.current);
    }, 200);
    return () => clearInterval(id);
  }, [phase, endAt, finish]);

  const onMove = useCallback(
    (from: string, to: string) => {
      if (!puzzle || locked || over.current) return;
      const c = chess.current;
      const expected = puzzle.moves[ply.current];
      const piece = c.get(from as Square);
      const promo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
      const promotion = promo ? (expected.slice(0, 4) === from + to && expected[4] ? expected[4] : 'q') : undefined;
      const test = new Chess(c.fen());
      try {
        test.move({ from, to, promotion });
      } catch {
        setResetToken((x) => x + 1);
        return;
      }
      const last = ply.current === puzzle.moves.length - 1;
      const correct = from + to + (promotion ?? '') === expected || (last && test.isCheckmate());
      if (!correct) {
        // Erreur : on montre le bon coup puis on passe au suivant
        setLocked(true);
        sounds.fail();
        setFlash('ko');
        setShapes([{ orig: expected.slice(0, 2), dest: expected.slice(2, 4), brush: 'green' }]);
        setResetToken((x) => x + 1);
        const list = push({ puzzle, ok: false });
        later(() => setFlash(null), 500);
        if (list.filter((d) => !d.ok).length >= RUSH_STRIKES) later(() => finish('3 erreurs', list), 900);
        else later(() => void showNext(), 900);
        return;
      }
      playUci(from + to + (promotion ?? ''), false);
      ply.current++;
      if (ply.current >= puzzle.moves.length) {
        setLocked(true);
        sounds.success();
        setFlash('ok');
        push({ puzzle, ok: true });
        later(() => setFlash(null), 350);
        later(() => void showNext(), 350);
        return;
      }
      setLocked(true);
      later(() => {
        playUci(puzzle.moves[ply.current], true);
        ply.current++;
        setLocked(false);
      }, 260);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzle, locked, finish],
  );

  const orientation = puzzle ? toCg(new Chess(puzzle.fen).turn() === 'w' ? 'b' : 'w') : 'white';
  const turn = chess.current.turn();
  const dests = useMemo(() => (locked ? new Map<string, string[]>() : destsOf(chess.current)), [fen, locked]); // eslint-disable-line react-hooks/exhaustive-deps
  const remaining = endAt ? endAt - now : null;

  const board = (
    <section className={`board-col rush-board ${flash ? `flash-${flash}` : ''}`}>
      <div className="board-stage">
        <Board
          fen={fen}
          orientation={orientation}
          turnColor={toCg(turn)}
          movableColor={locked ? undefined : orientation}
          dests={dests}
          lastMove={lastMove}
          inCheck={chess.current.inCheck()}
          premovable={false}
          shapes={shapes}
          resetToken={resetToken}
          onMove={onMove}
        />
      </div>
    </section>
  );

  const leaderboard = (
    <div className="card rush-top">
      <div className="rush-top-head">
        <div className="tc-label">🏆 Classement · {cfg.label}</div>
        <div className="chips small">
          <button className={`chip ${topTab === 'all' ? 'selected' : ''}`} onClick={() => setTopTab('all')}>
            Tous temps
          </button>
          <button className={`chip ${topTab === 'today' ? 'selected' : ''}`} onClick={() => setTopTab('today')}>
            Aujourd’hui
          </button>
        </div>
      </div>
      {topErr && <p className="muted small">Serveur injoignable : classement indisponible. Tes records restent enregistrés ici.</p>}
      {top && top[topTab].length === 0 && <p className="muted small">Personne pour l’instant. À toi d’ouvrir le bal !</p>}
      {top && top[topTab].length > 0 && (
        <ol className="rush-rank">
          {top[topTab].map((r, i) => (
            <li key={r.username} className={sync.user?.toLowerCase() === r.username.toLowerCase() ? 'me' : ''}>
              <span className="rank-n">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
              <Avatar name={r.username} size={24} />
              <span className="rank-name">{r.username}</span>
              <b>{r.score}</b>
            </li>
          ))}
        </ol>
      )}
      {!logged && !topErr && <p className="muted tiny">Connecte-toi pour apparaître dans le classement.</p>}
    </div>
  );

  if (phase === 'menu' || phase === 'loading')
    return (
      <div className="rush">
        <section className="card rush-hero">
          <div>
            <h1>⚡ Puzzle Rush</h1>
            <p className="muted">
              Enchaîne les problèmes le plus vite possible. Ils commencent faciles et deviennent de plus en plus durs. À la 3e erreur,
              c’est fini. Les problèmes ratés rejoignent tes révisions.
            </p>
          </div>
          <div className="rush-modes">
            {RUSH_MODES.map((m) => (
              <button key={m.id} className={`rush-mode ${mode === m.id ? 'selected' : ''}`} onClick={() => setMode(m.id)}>
                <span className="rush-mode-icon">{m.icon}</span>
                <strong>{m.label}</strong>
                <span className="muted small">{m.desc}</span>
                <span className="rush-best">Record : {data.best[m.id] ?? '–'}</span>
              </button>
            ))}
          </div>
          <button className="btn primary big" disabled={phase === 'loading'} onClick={() => void start()}>
            {phase === 'loading' ? 'Chargement des problèmes…' : `Lancer · ${cfg.label}`}
          </button>
          <p className="muted tiny">
            Gains : 1 🪙 tous les 2 problèmes, +10 🪙 pour un nouveau record. 2 XP par problème réussi.
          </p>
        </section>
        <div className="rush-side">
          {leaderboard}
          {data.runs.length > 0 && (
            <div className="card">
              <div className="tc-label">Tes dernières parties</div>
              <div className="rush-runs">
                {data.runs.slice(0, 8).map((r, i) => (
                  <span key={i} className="chip static" title={new Date(r.at).toLocaleString('fr-FR')}>
                    {RUSH_MODES.find((m) => m.id === r.mode)?.icon} {r.score}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );

  if (phase === 'over' && result)
    return (
      <div className="rush">
        <section className="card rush-over">
          <div className="tc-label">
            {cfg.icon} {cfg.label} · {result.reason}
          </div>
          <div className="rush-score-big">{result.score}</div>
          <p>
            {result.record && result.score > 0 ? '🎉 Nouveau record ! ' : `Record : ${data.best[mode] ?? 0}. `}
            {result.coins > 0 && `+${result.coins} 🪙 `}
            {result.rank && `· ${result.rank}${result.rank === 1 ? 'er' : 'e'} au classement`}
          </p>
          <div className="rush-done">
            {done.map((d, i) => (
              <span key={i} className={`rush-pill ${d.ok ? 'ok' : 'ko'}`} title={`${d.puzzle.rating} Elo`}>
                {d.ok ? '✓' : '✗'} {d.puzzle.rating}
              </span>
            ))}
          </div>
          {strikes > 0 && (
            <p className="muted small">
              {strikes} problème{strikes > 1 ? 's' : ''} raté{strikes > 1 ? 's' : ''} ajouté{strikes > 1 ? 's' : ''} à tes révisions
              (Problèmes, onglet 🧠 Révisions).
            </p>
          )}
          <div className="row">
            <button className="btn primary" onClick={() => void start()}>
              Rejouer
            </button>
            <button className="btn ghost" onClick={() => setPhase('menu')}>
              Changer de mode
            </button>
          </div>
        </section>
        <div className="rush-side">{leaderboard}</div>
      </div>
    );

  return (
    <div className="play rush-play">
      {board}
      <aside className="side flush">
        <div className="card rush-hud">
          <div className={`rush-clock ${remaining !== null && remaining < 20000 ? 'low' : ''}`}>
            {remaining !== null ? fmt(remaining) : '∞'}
          </div>
          <div className="rush-score">
            <span className="tc-label">Score</span>
            <b>{score}</b>
          </div>
          <div className="rush-strikes" title="Erreurs">
            {Array.from({ length: RUSH_STRIKES }, (_, i) => (
              <span key={i} className={i < strikes ? 'hit' : ''}>
                ✗
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="status">
            {puzzle ? `Trouve le meilleur coup pour les ${orientation === 'white' ? 'Blancs' : 'Noirs'}` : 'Chargement…'}
          </div>
          <p className="muted small">{puzzle ? `Problème ${index.current} · ${puzzle.rating} Elo` : ''}</p>
          <div className="rush-done">
            {done.slice(-24).map((d, i) => (
              <span key={i} className={`rush-pill ${d.ok ? 'ok' : 'ko'}`}>
                {d.ok ? '✓' : '✗'}
              </span>
            ))}
          </div>
        </div>
        <button className="btn ghost" onClick={() => finish('Arrêtée', doneRef.current)}>
          Arrêter
        </button>
      </aside>
    </div>
  );
}
