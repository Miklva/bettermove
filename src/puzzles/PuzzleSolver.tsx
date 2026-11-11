// Resolution d'un probleme : plateau, verification des coups, explications, indice, solution.
// Utilise par le mode Problemes et par les cours.
import { PhoneBar, PhonePop } from '../components/PhonePop';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Chess, type Square } from 'chess.js';
import { Board } from '../components/Board';
import { HistoryNavBar, positionsFrom, useHistoryNav, type Position } from '../components/HistoryNav';
import type { Puzzle } from './db';
import { explainMistake, explainSolution, HINT_LEVELS, progressiveHint, type Explanation, type Shape } from './explain';
import { useSettings } from '../settings/settings';
import { sounds } from '../lib/sounds';

import { t } from '../i18n';
export interface SolveResult {
  win: boolean;
  seconds: number;
  usedHint: boolean;
}

/** Issue finale d'un probleme (quand il est resolu ou que la solution a ete montree) */
export interface SolveFinish {
  solved: boolean;
  firstTry: boolean;
  usedHint: boolean;
  revealed: boolean;
  /** Nombre de mauvais coups joues */
  mistakes: number;
  seconds: number;
}

interface Props {
  puzzle: Puzzle | null;
  error?: string | null;
  /** Appele une seule fois par probleme : premiere reussite ou premier echec */
  onResult: (r: SolveResult) => void;
  /** Appele quand le probleme est termine (resolu ou solution affichee) */
  onFinish?: (f: SolveFinish) => void;
  onNext: () => void;
  nextLabel?: string;
  /** Rappel du theme affiche des le debut (mode guide) */
  guidance?: string;
  allowSkip?: boolean;
  /** Cartes affichees au-dessus du retour (classement, progression) */
  sideTop?: ReactNode;
  /** Cartes affichees en bas de la colonne (options) */
  sideBottom?: ReactNode;
  /** Infos supplementaires affichees une fois le probleme termine */
  doneMeta?: ReactNode;
  onRetryLoad?: () => void;
  /** Appele a chaque mauvais coup, et a chaque indice demande */
  onMistake?: () => void;
  onHint?: () => void;
}

type Phase = 'loading' | 'intro' | 'solving' | 'wrong' | 'solved' | 'revealing' | 'revealed' | 'error';

const uciOf = (m: { from: string; to: string; promotion?: string }) => `${m.from}${m.to}${m.promotion ?? ''}`;

export function PuzzleSolver({
  puzzle,
  error,
  onResult,
  onFinish,
  onNext,
  nextLabel,
  guidance,
  allowSkip = true,
  sideTop,
  sideBottom,
  doneMeta,
  onRetryLoad,
  onMistake,
  onHint,
}: Props) {
  const { settings } = useSettings();
  const chess = useRef(new Chess());
  const [phase, setPhase] = useState<Phase>('loading');
  const [ply, setPly] = useState(0);
  const [fen, setFen] = useState(chess.current.fen());
  const [lastMove, setLastMove] = useState('');
  const startFen = useRef(chess.current.fen());
  const [positions, setPositions] = useState<Position[]>([{ fen: chess.current.fen(), lastMove: '' }]);
  const nav = useHistoryNav(positions);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintShapes, setHintShapes] = useState<Shape[]>([]);
  // Indices de plus en plus precis : un niveau de plus a chaque echec ou clic sur Indice (remis a zero a chaque coup trouve)
  const [hintLevel, setHintLevel] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [resetToken, setResetToken] = useState(0);
  const usedHint = useRef(false);
  const reported = useRef(false);
  const timers = useRef<number[]>([]);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  /** Une erreur a deja ete commise sur ce probleme */
  const hadMistake = useRef(false);
  const mistakes = useRef(0);
  const startRef = useRef(0);
  // Numero de "tour" : une explication calculee en retard pour un ancien probleme (ou avant "Reessayer") est ignoree
  const gen = useRef(0);
  const onMistakeRef = useRef(onMistake);
  onMistakeRef.current = onMistake;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const sync = () => {
    setFen(chess.current.fen());
    const h = chess.current.history({ verbose: true });
    const last = h[h.length - 1];
    setLastMove(last ? `${last.from}${last.to}` : '');
    setPositions(positionsFrom(startFen.current, h));
  };

  const playerColor = useMemo(() => (puzzle ? (new Chess(puzzle.fen).turn() === 'w' ? 'b' : 'w') : 'w'), [puzzle]);

  // Nouveau probleme : on affiche la position puis on joue le coup adverse
  useEffect(() => {
    gen.current++;
    clearTimers();
    setExplanation(null);
    setHint(null);
    setHintShapes([]);
    setHintLevel(0);
    usedHint.current = false;
    reported.current = false;
    hadMistake.current = false;
    mistakes.current = 0;
    if (error) {
      setPhase('error');
      return;
    }
    if (!puzzle) {
      setPhase('loading');
      return;
    }
    chess.current = new Chess(puzzle.fen);
    startFen.current = puzzle.fen;
    setPly(0);
    sync();
    setPhase('intro');
    later(() => {
      const u = puzzle.moves[0];
      const m = chess.current.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      sync();
      setPly(1);
      // Le premier coup du probleme est celui de l'adversaire
      if (m.captured) sounds.capture(m.captured, true);
      else sounds.move();
      setPhase('solving');
      setStartedAt(Date.now());
      startRef.current = Date.now();
    }, 650);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle?.id, error]);

  // Chronometre
  useEffect(() => {
    if (phase !== 'solving' && phase !== 'wrong') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const report = (win: boolean) => {
    if (reported.current) return;
    reported.current = true;
    onResultRef.current({ win, seconds: Math.round((Date.now() - startedAt) / 1000), usedHint: usedHint.current });
  };

  const finishSolved = async (p: Puzzle) => {
    setPhase('solved');
    sounds.success();
    report(true);
    onFinishRef.current?.({
      solved: true,
      firstTry: !hadMistake.current,
      usedHint: usedHint.current,
      revealed: false,
      mistakes: mistakes.current,
      seconds: Math.round((Date.now() - startRef.current) / 1000),
    });
    setAnalysing(true);
    const g = gen.current;
    try {
      const ex = await explainSolution(p, settings.notation, false);
      if (g === gen.current) setExplanation(ex);
    } finally {
      if (g === gen.current) setAnalysing(false);
    }
  };

  const onMove = useCallback(
    (from: string, to: string) => {
      if (!puzzle || phase !== 'solving') return;
      const c = chess.current;
      const expected = puzzle.moves[ply];
      const piece = c.get(from as Square);
      const isPromo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
      const promotion = isPromo ? (expected.slice(0, 4) === from + to && expected[4] ? expected[4] : 'q') : undefined;
      const uci = `${from}${to}${promotion ?? ''}`;
      const fenBefore = c.fen();

      // Un autre mat sur le dernier coup est accepte (comme sur Lichess)
      const test = new Chess(fenBefore);
      let isMate = false;
      try {
        test.move({ from, to, promotion });
        isMate = test.isCheckmate();
      } catch {
        setResetToken((x) => x + 1);
        return;
      }
      const correct = uci === expected || (isMate && ply === puzzle.moves.length - 1);
      const m = c.move({ from, to, promotion });
      sync();
      setHint(null);
      setHintShapes([]);

      if (correct) {
        if (m.captured) sounds.capture(m.captured);
        else sounds.move();
        const nextPly = ply + 1;
        if (nextPly >= puzzle.moves.length || isMate) {
          setPly(puzzle.moves.length);
          finishSolved(puzzle);
          return;
        }
        // Reponse de l'adversaire
        setPly(nextPly);
        setPhase('intro');
        setHintLevel(0);
        setHint(null);
        setHintShapes([]);
        later(() => {
          const r = puzzle.moves[nextPly];
          const rm = chess.current.move({ from: r.slice(0, 2), to: r.slice(2, 4), promotion: r[4] });
          sync();
          if (chess.current.inCheck()) sounds.check();
          else if (rm.captured) sounds.capture(rm.captured, true);
          else sounds.move();
          setPly(nextPly + 1);
          setPhase('solving');
        }, 380);
        return;
      }

      // Mauvais coup : on l'explique
      setPhase('wrong');
      setAnalysing(true);
      setExplanation(null);
      const g = gen.current;
      explainMistake(puzzle, fenBefore, uciOf(m), expected, settings.notation)
        .then((ex) => {
          if (g !== gen.current) return;
          if (ex.verdict !== 'soft') {
            // Un indice de plus a chaque echec : de l'idee generale jusqu'a la piece a jouer
            const lv = Math.min(HINT_LEVELS, hintLevel + 1);
            const h = progressiveHint(puzzle, fenBefore, expected, lv);
            setHintLevel(lv);
            setHint(h.text);
            setHintShapes(h.shapes);
            ex = { ...ex, hint: h.text };
          }
          setExplanation(ex);
          if (ex.verdict === 'soft') sounds.move();
          else {
            sounds.fail();
            hadMistake.current = true;
            mistakes.current++;
            onMistakeRef.current?.();
            report(false);
          }
        })
        .catch(() => {
          if (g !== gen.current) return;
          sounds.fail();
          hadMistake.current = true;
          mistakes.current++;
          onMistakeRef.current?.();
          report(false);
          setExplanation({ verdict: 'fail', title: t('Pas ça…'), points: [t('Ce n’est pas le bon coup.')], themes: [], shapes: [] });
        })
        .finally(() => {
          if (g === gen.current) setAnalysing(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzle, phase, ply, settings.notation, hintLevel],
  );

  const retry = () => {
    if (phase !== 'wrong') return;
    gen.current++;
    chess.current.undo();
    sync();
    setExplanation(null);
    setAnalysing(false);
    setPhase('solving');
  };

  const showHint = () => {
    if (!puzzle || phase !== 'solving') return;
    usedHint.current = true;
    onHint?.();
    const expected = puzzle.moves[ply];
    const lv = Math.min(HINT_LEVELS, hintLevel + 1);
    const h = progressiveHint(puzzle, chess.current.fen(), expected, lv);
    setHintLevel(lv);
    setHint(h.text);
    setHintShapes(h.shapes);
  };

  const reveal = () => {
    if (!puzzle) return;
    if (phase === 'wrong') chess.current.undo();
    gen.current++;
    report(false);
    setPhase('revealing');
    setExplanation(null);
    setHint(null);
    setHintShapes([]);
    sync();
    let i = ply;
    const step = () => {
      if (i >= puzzle.moves.length) {
        setPhase('revealed');
        onFinishRef.current?.({
          solved: false,
          firstTry: false,
          usedHint: usedHint.current,
          revealed: true,
          mistakes: mistakes.current,
          seconds: Math.round((Date.now() - startRef.current) / 1000),
        });
        setAnalysing(true);
        const g = gen.current;
        explainSolution(puzzle, settings.notation, true)
          .then((ex) => {
            if (g === gen.current) setExplanation(ex);
          })
          .finally(() => {
            if (g === gen.current) setAnalysing(false);
          });
        return;
      }
      const u = puzzle.moves[i];
      const m = chess.current.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      sync();
      if (m.captured) sounds.capture(m.captured, i % 2 === 0);
      else sounds.move();
      i++;
      setPly(i);
      later(step, 750);
    };
    later(step, 300);
  };

  const done = phase === 'solved' || phase === 'revealed';

  // Raccourcis : Entree ou fleche droite pour continuer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (done && e.key === 'Enter') onNext();
      if (phase === 'wrong' && e.key === 'Enter') retry();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dests = useMemo(() => {
    const map = new Map<string, string[]>();
    if (phase !== 'solving') return map;
    const c = new Chess(fen);
    for (const m of c.moves({ verbose: true })) map.set(m.from, [...(map.get(m.from) ?? []), m.to]);
    return map;
  }, [fen, phase]);

  // Position affichee : la position actuelle, ou un coup precedent si on navigue avec les fleches
  const shownFen = nav.isLive ? fen : nav.current.fen;
  const shownLast = nav.isLive ? lastMove : nav.current.lastMove;
  const inCheck = useMemo(() => new Chess(shownFen).inCheck(), [shownFen]);
  const turn = new Chess(shownFen).turn();
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const shapes = nav.isLive ? [...(explanation?.shapes ?? []), ...hintShapes] : [];
  const sideName = playerColor === 'w' ? t('Blancs') : t('Noirs');

  return (
    <div className="play">
      <section className="board-col">
        <div className="puzzle-topline">
          <span className={`color-dot ${playerColor === 'w' ? 'white' : 'black'}`} />
          <span>{t("Tu joues les")}{" "}<b>{sideName}</b>
          </span>
          {(phase === 'solving' || phase === 'wrong') && <span className="timer">{elapsed}s</span>}
        </div>
        <div className="board-stage">
          <Board
            fen={shownFen}
            orientation={playerColor === 'w' ? 'white' : 'black'}
            turnColor={turn === 'w' ? 'white' : 'black'}
            movableColor={phase === 'solving' && nav.isLive ? (playerColor === 'w' ? 'white' : 'black') : undefined}
            dests={dests}
            lastMove={shownLast}
            inCheck={inCheck}
            premovable={false}
            shapes={shapes}
            resetToken={resetToken}
            onMove={onMove}
          />
          {phase === 'loading' && <div className="board-loading">{t("Chargement…")}</div>}
        </div>
        <HistoryNavBar nav={nav} />
      </section>

      <aside className="side puzzle-side">
        {sideTop}

        {/* Telephone : consigne et indice dans la barre du bas, explication dans la fenetre centrale : la carte ne se repete pas */}
        <div className={`card feedback ${explanation?.verdict ?? phase} ${phase === 'wrong' || done || phase === 'intro' || phase === 'solving' ? 'pop-inline' : ''}`}>
          {phase === 'loading' && <p className="muted">{t("Recherche d’un problème…")}</p>}
          {phase === 'error' && (
            <>
              <p className="error">{error}</p>
              {onRetryLoad && (
                <button className="btn" onClick={onRetryLoad}>{t("Réessayer")}</button>
              )}
            </>
          )}
          {(phase === 'intro' || phase === 'solving') && (
            <>
              <div className="status">{t("À toi de jouer")}</div>
              <p className="muted">{t('Trouve le meilleur coup pour les {side}.', { side: sideName })}</p>
              {guidance && <p className="hint">🎯 {guidance}</p>}
              {hint && (
                <>
                  <p className="hint">💡 {hint}</p>
                  {usedHint.current && <p className="muted small">{t("Indice utilisé : ce problème ne rapportera pas de points.")}</p>}
                </>
              )}
            </>
          )}
          {phase === 'revealing' && <div className="status">{t("Voici la solution…")}</div>}
          {(phase === 'wrong' || done) && (
            <>
              {analysing && !explanation && <p className="muted">{t("Analyse du coup avec Stockfish…")}</p>}
              {explanation && (
                <>
                  <div className="status">
                    {explanation.verdict === 'success' ? '✓ ' : explanation.verdict === 'fail' ? '✗ ' : ''}
                    {explanation.title}
                  </div>
                  <ul className="explain">
                    {explanation.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                  {explanation.hint && phase === 'wrong' && <p className="hint">💡 {explanation.hint}</p>}
                  {explanation.themes.length > 0 && (
                    <div className="theme-tags">
                      {explanation.themes.slice(0, 4).map((t) => (
                        <span key={t.label} className="theme-tag" title={t.tip}>
                          {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {explanation.themes.find((t) => t.tip) && done && (
                    <p className="muted small">{explanation.themes.find((t) => t.tip)!.tip}</p>
                  )}
                </>
              )}
              {done && puzzle && puzzle.rating > 0 && (
                <p className="muted small puzzle-meta">{t("Problème")}{" "}{puzzle.id} · {puzzle.rating}{" "}{t("Elo")}{" "}{doneMeta} ·{' '}
                  <a href={`https://lichess.org/training/${puzzle.id}`} target="_blank" rel="noreferrer">{t("voir sur Lichess")}</a>
                </p>
              )}
            </>
          )}
        </div>

        <div className="card actions pop-inline">
          {phase === 'solving' && (
            <>
              <button className="btn" onClick={showHint} disabled={hintLevel >= HINT_LEVELS} title={t("Utiliser un indice : le problème ne rapporte plus de points")}>{hintLevel ? t('Indice {n}/{max}', { n: Math.min(hintLevel + 1, HINT_LEVELS), max: HINT_LEVELS }) : t("Indice")}</button>
              <button className="btn" onClick={reveal}>{t("Voir la solution")}</button>
            </>
          )}
          {phase === 'wrong' && (
            <>
              <button className="btn primary" onClick={retry} disabled={analysing}>{t("Réessayer")}</button>
              <button className="btn" onClick={reveal} disabled={analysing}>{t("Voir la solution")}</button>
            </>
          )}
          {done && (
            <button className="btn primary wide" onClick={onNext}>
              {nextLabel ?? t("Problème suivant")}
            </button>
          )}
          {allowSkip && (phase === 'solving' || phase === 'wrong') && (
            <button className="btn ghost wide" onClick={onNext}>{t("Passer")}</button>
          )}
        </div>

        {sideBottom}
      </aside>

      {/* Telephone : actions toujours a portee de pouce */}
      {phase === 'solving' && (
        <PhoneBar note={hint ? `💡 ${hint}` : guidance ? `🎯 ${guidance}` : null}>
          <button className="btn" onClick={showHint} disabled={hintLevel >= HINT_LEVELS}>{hintLevel ? t('Indice {n}/{max}', { n: Math.min(hintLevel + 1, HINT_LEVELS), max: HINT_LEVELS }) : t("Indice")}</button>
          <button className="btn" onClick={reveal}>{t("Voir la solution")}</button>
          {allowSkip && <button className="btn ghost" onClick={onNext}>{t("Passer")}</button>}
        </PhoneBar>
      )}
      {(phase === 'wrong' || done) && (
        <PhonePop
          key={`${phase}-${explanation?.title ?? ''}`}
          tone={done ? (explanation?.verdict === 'fail' ? 'info' : 'success') : 'fail'}
          title={explanation ? explanation.title : analysing ? t("Analyse du coup avec Stockfish…") : done ? t("Problème terminé") : t("Pas ça…")}
          actions={
            phase === 'wrong' ? (
              <>
                <button className="btn primary" onClick={retry} disabled={analysing}>{t("Réessayer")}</button>
                <button className="btn" onClick={reveal} disabled={analysing}>{t("Voir la solution")}</button>
                {allowSkip && <button className="btn ghost" onClick={onNext}>{t("Passer")}</button>}
              </>
            ) : (
              <button className="btn primary" onClick={onNext}>{nextLabel ?? t("Problème suivant")}</button>
            )
          }
        >
          {explanation && (
            <>
              <ul className="explain">
                {explanation.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              {explanation.hint && phase === 'wrong' && <p className="hint">💡 {explanation.hint}</p>}
              {done && explanation.themes.find((x) => x.tip) && <p className="muted small">{explanation.themes.find((x) => x.tip)!.tip}</p>}
            </>
          )}
        </PhonePop>
      )}
    </div>
  );
}
