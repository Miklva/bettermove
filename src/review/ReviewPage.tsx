// Review : analyse complete d'une partie, navigation au clavier, fleches (meilleur coup, menaces),
// explications, moments cles et entrainement sur ses propres erreurs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../components/Board';
import type { ReviewRequest } from './ImportPanel';
import {
  analyseGame,
  CATEGORY,
  classify,
  openingName,
  parseGame,
  summary,
  type Category,
  type GameData,
  type MoveReview,
  type PosEval,
} from './analysis';
import { explainMove, findThreat, type Threat } from './explainMove';
import { EvalBar, EvalGraph } from './widgets';
import { addMistakes, listGames, recordMistakeAttempt, saveGame, type SavedGame } from './store';
import { buildGameAnalysis, coachColor, type GameAnalysis } from '../coach/analyze';
import { saveAnalysis } from '../coach/report';
import { GameCoachCard, type NavTarget } from '../coach/GameCoachCard';
import { RepertoireCheckCard } from '../repertoire/CheckCard';
import { CapturedPieces } from '../components/CapturedPieces';
import { PuzzleSolver } from '../puzzles/PuzzleSolver';
import type { Puzzle } from '../puzzles/db';
import { formatSan } from '../lib/notation';
import { useSettings } from '../settings/settings';
import { sounds } from '../lib/sounds';
import { engine } from '../engine/stockfish';
import { materialFromFen } from '../game/rules';
import { recordReview } from '../achievements/facts';
import { HistoryPage } from '../history/HistoryPage';
import type { PlayerProfile } from '../rating/profile';
import { track } from '../achievements/events';
import { rewardReview } from '../economy/rewards';

interface Props {
  request: ReviewRequest | null;
  onRequest: (r: ReviewRequest | null) => void;
  notify: (msg: string) => void;
  player: PlayerProfile;
  onNavigate: (t: NavTarget) => void;
}

export function ReviewPage({ request, onRequest, notify, player, onNavigate }: Props) {
  if (!request) return <HistoryPage player={player} onOpen={onRequest} />;
  return (
    <AnalysisView key={request.id} request={request} onBack={() => onRequest(null)} notify={notify} onNavigate={onNavigate} />
  );
}

const NO_DESTS = new Map<string, string[]>();
const KEY_CATEGORIES: Category[] = ['blunder', 'mistake', 'miss'];

function AnalysisView({
  request,
  onBack,
  notify,
  onNavigate,
}: {
  request: ReviewRequest;
  onBack: () => void;
  notify: (m: string) => void;
  onNavigate: (t: NavTarget) => void;
}) {
  const { settings } = useSettings();
  const game: GameData | null = useMemo(() => {
    try {
      return parseGame(request.pgn);
    } catch {
      return null;
    }
  }, [request.pgn]);
  const [evals, setEvals] = useState<(PosEval | undefined)[]>([]);
  const [reviews, setReviews] = useState<(MoveReview | undefined)[]>([]);
  const [done, setDone] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(request.userColor === 'b');
  const [showBest, setShowBest] = useState(true);
  const [showThreats, setShowThreats] = useState(true);
  const [threats, setThreats] = useState<Record<number, Threat | null>>({});
  const [training, setTraining] = useState(false);
  const stopped = useRef(false);
  // Partie sauvegardee (camp suivi, spectateur, 1v1...)
  const [saved, setSaved] = useState<SavedGame | null>(() => listGames().find((g) => g.id === request.id) ?? null);
  const followed = saved ? coachColor(saved) : request.source === 'local' ? null : request.userColor;
  // En 1v1, la review se fait du point de vue du camp choisi pour le suivi
  const user = saved?.source === 'local' && followed ? followed : (saved?.userColor ?? request.userColor);
  const [coach, setCoach] = useState<GameAnalysis | null>(null);
  const total = game ? game.positions.length : 0;
  const finished = game !== null && done >= total;

  // Analyse complete en arriere-plan (resultats affiches au fur et a mesure)
  useEffect(() => {
    if (!game) return;
    stopped.current = false;
    openingName(game).then(setOpening);
    analyseGame(
      game,
      (ev, n) => {
        setEvals(ev);
        setDone(n);
        classify(game, ev).then(setReviews);
      },
      () => stopped.current,
    );
    return () => {
      stopped.current = true;
      engine.stop();
    };
  }, [game]);

  // Fin d'analyse : les erreurs du joueur rejoignent son deck d'entrainement
  const added = useRef(false);
  useEffect(() => {
    if (!finished || !game || added.current) return;
    // Spectateur ou 1v1 sans camp choisi : ce ne sont pas les erreurs du joueur
    if (saved?.observer || (saved?.source === 'local' && !followed)) return;
    added.current = true;
    const cards = mistakePuzzles(game, evals, reviews, user, request.id).map((c) => ({
      ...c,
      origin: `${game.headers.White ?? 'Blancs'} - ${game.headers.Black ?? 'Noirs'}`,
    }));
    // Succes : resume de la review du joueur
    {
      const s = summary(game, reviews)[user];
      recordReview({
        id: request.id,
        accuracy: s.accuracy,
        brilliant: s.counts.brilliant ?? 0,
        great: s.counts.great ?? 0,
        blunders: s.counts.blunder ?? 0,
        mistakes: s.counts.mistake ?? 0,
        moves: game.plies.filter((p) => p.color === user).length,
      });
      track('review');
      rewardReview(request.id);
    }
    const n = addMistakes(cards);
    if (n) notify(`${n} erreur${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} à ton entraînement`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, followed]);

  // Suivi personnalise : la partie analysee met a jour les points faibles
  useEffect(() => {
    if (!finished || !game || !saved || !followed) return;
    const a = buildGameAnalysis(saved, followed, game.plies.map((p) => p.move), evals);
    saveAnalysis(a);
    setCoach(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, followed, saved]);

  const updateSaved = (patch: Partial<SavedGame>) => {
    if (!saved) return;
    const next = { ...saved, ...patch };
    saveGame(next);
    setSaved(next);
  };

  // Menace de la position affichee (calculee a la demande, mise en cache)
  useEffect(() => {
    if (!game || !showThreats || threats[ply] !== undefined) return;
    let cancelled = false;
    findThreat(game.positions[ply], evals[ply], settings.notation)
      .then((t) => !cancelled && setThreats((m) => ({ ...m, [ply]: t })))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply, showThreats, game, evals[ply] !== undefined]);

  const go = (p: number, withSound = false) => {
    if (!game) return;
    const n = Math.max(0, Math.min(game.plies.length, p));
    if (withSound && n === ply + 1 && n > 0) {
      const r = reviews[n - 1];
      const m = game.plies[n - 1].move;
      // Son de la categorie du coup (selon le pack de sons equipe), sinon son du coup lui-meme
      if (r && sounds.review(r.category)) {
        /* deja joue */
      } else if (new Chess(game.plies[n - 1].fenAfter).inCheck()) sounds.check();
      else if (m.captured) sounds.capture(m.captured, m.color !== user);
      else sounds.move();
    }
    setPly(n);
  };

  useEffect(() => {
    if (training) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') go(ply - 1);
      else if (e.key === 'ArrowRight') go(ply + 1, true);
      else if (e.key === 'ArrowUp') go(0);
      else if (e.key === 'ArrowDown') go(total - 1);
      else if (e.key.toLowerCase() === 'f') setFlipped((f) => !f);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!game)
    return (
      <div className="review-import">
        <p className="error card">Impossible de lire cette partie.</p>
        <button className="btn" onClick={onBack}>
          Retour
        </button>
      </div>
    );

  const keyMoments = game.plies
    .map((p, i) => ({ p, i, r: reviews[i] }))
    .filter((x) => x.p.color === user && x.r && KEY_CATEGORIES.includes(x.r.category))
    .sort((a, b) => b.r!.loss - a.r!.loss);

  if (training)
    return (
      <MistakeTrainer
        puzzles={mistakePuzzles(game, evals, reviews, user, request.id)}
        onExit={() => setTraining(false)}
      />
    );

  const fen = game.positions[ply];
  const current = evals[ply];
  const lastPly = ply > 0 ? game.plies[ply - 1] : null;
  const rev = ply > 0 ? reviews[ply - 1] : undefined;
  const threat = threats[ply];
  const shapes = [
    ...(showBest && current?.best ? [{ orig: current.best.slice(0, 2), dest: current.best.slice(2, 4), brush: 'green' }] : []),
    ...(showThreats && threat ? [{ orig: threat.uci.slice(0, 2), dest: threat.uci.slice(2, 4), brush: 'red' }] : []),
  ];
  const explanation =
    lastPly && rev && evals[ply - 1] && evals[ply]
      ? explainMove(lastPly, rev, evals[ply - 1]!, evals[ply]!, settings.notation, opening)
      : null;
  const sum = summary(game, reviews);
  const c = new Chess(fen);
  const name = (col: 'w' | 'b') => (col === 'w' ? game.headers.White : game.headers.Black) ?? (col === 'w' ? 'Blancs' : 'Noirs');
  const bestSan = (() => {
    if (!current?.best) return '';
    try {
      return formatSan(new Chess(fen).move({ from: current.best.slice(0, 2), to: current.best.slice(2, 4), promotion: current.best[4] }).san, settings.notation);
    } catch {
      return '';
    }
  })();

  return (
    <div className="play review">
      <section className="board-col">
        <div className="puzzle-topline">
          <button className="btn ghost" onClick={onBack}>
            ← Historique
          </button>
          <span className="review-opening">{opening ? opening.replace(/^[A-E]\d\d /, '') : ''}</span>
          <button className="btn flip-btn" onClick={() => setFlipped((f) => !f)} title="Retourner l’échiquier (touche F)">
            ⇅ Retourner
          </button>
        </div>
        <div className="review-board">
          <span />
          <ReviewPlayerBar color={flipped ? 'w' : 'b'} game={game} fen={fen} accuracy={done > 2 ? sum[flipped ? 'w' : 'b'].accuracy : null} isUser={user === (flipped ? 'w' : 'b')} />
          <EvalBar e={current} flipped={flipped} />
          <div className="board-stage">
            <Board
              fen={fen}
              orientation={flipped ? 'black' : 'white'}
              turnColor={c.turn() === 'w' ? 'white' : 'black'}
              dests={NO_DESTS}
              lastMove={lastPly ? `${lastPly.move.from}${lastPly.move.to}` : ''}
              inCheck={c.inCheck()}
              premovable={false}
              shapes={shapes}
              resetToken={0}
              onMove={() => undefined}
            />
            {rev && lastPly && (
              <span
                className="move-badge"
                style={{ background: CATEGORY[rev.category].color, ...badgePos(lastPly.move.to, flipped) }}
                title={CATEGORY[rev.category].label}
              >
                {CATEGORY[rev.category].symbol}
              </span>
            )}
          </div>
          <span />
          <ReviewPlayerBar color={flipped ? 'b' : 'w'} game={game} fen={fen} accuracy={done > 2 ? sum[flipped ? 'b' : 'w'].accuracy : null} isUser={user === (flipped ? 'b' : 'w')} />
        </div>
        <div className="board-nav">
          <button className="btn ghost" onClick={() => go(0)} aria-label="Début">
            «
          </button>
          <button className="btn ghost" onClick={() => go(ply - 1)} aria-label="Précédent">
            ‹
          </button>
          <span className="board-nav-label">
            {ply === 0 ? 'Position de départ' : `Coup ${Math.ceil(ply / 2)}${lastPly?.color === 'b' ? '…' : '.'} ${formatSan(lastPly!.san, settings.notation)}`}
          </span>
          <button className="btn ghost" onClick={() => go(ply + 1, true)} aria-label="Suivant">
            ›
          </button>
          <button className="btn ghost" onClick={() => go(total - 1)} aria-label="Fin">
            »
          </button>
        </div>
        <div className="arrow-toggles">
          <label className="toggle">
            <input type="checkbox" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} />
            <span>
              <i className="dot green" /> Meilleur coup
            </span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={showThreats} onChange={(e) => setShowThreats(e.target.checked)} />
            <span>
              <i className="dot red" /> Menaces
            </span>
          </label>
        </div>
      </section>

      <aside className="side review-side">
        {!finished && (
          <div className="card">
            <div className="tc-label">Analyse Stockfish en cours</div>
            <div className="xp-bar analysis-bar">
              <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
            <p className="muted small">
              Position {done} / {total}. Tu peux déjà naviguer avec les flèches ← →.
            </p>
          </div>
        )}

        <div className={`card feedback move-card ${rev ? (CATEGORY[rev.category].good ? 'success' : 'fail') : ''}`}>
          {ply === 0 ? (
            <>
              <div className="status">
                {name('w')} contre {name('b')}
              </div>
              <p className="muted">
                Avance avec → pour revoir la partie coup par coup. La flèche verte montre le meilleur coup de la position, la flèche
                rouge ce que menace l’adversaire.
              </p>
            </>
          ) : explanation && rev ? (
            <>
              <div className="status" style={{ color: CATEGORY[rev.category].color }}>
                {CATEGORY[rev.category].symbol} {explanation.title}
              </div>
              <ul className="explain">
                {explanation.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Analyse de ce coup en cours…</p>
          )}
          {showThreats && threat && <p className="threat">⚠️ {threat.text}</p>}
          {showBest && bestSan && !c.isGameOver() && (
            <p className="muted small">
              À jouer ici : <b>{bestSan}</b> (flèche verte)
            </p>
          )}
        </div>

        <div className="card moves-card">
          <ReviewMoveList game={game} reviews={reviews} ply={ply} onSelect={(p) => go(p)} />
        </div>

        <div className="card">
          <EvalGraph evals={evals} reviews={reviews} ply={ply} userColor={user} onSelect={(p) => go(p)} />
          <div className="accuracy-row">
            {(['w', 'b'] as const).map((col) => (
              <div key={col} className={`accuracy ${col === user ? 'mine' : ''}`}>
                <span className={`color-dot ${col === 'w' ? 'white' : 'black'}`} />
                <span className="acc-name">{name(col)}</span>
                <strong>{done > 2 ? `${sum[col].accuracy.toFixed(1)} %` : '…'}</strong>
              </div>
            ))}
          </div>
          <table className="cat-table">
            <tbody>
              {(['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'] as Category[]).map((k) => (
                <tr key={k}>
                  <td>{sum.w.counts[k] ?? 0}</td>
                  <td>
                    <span className="cat-symbol" style={{ background: CATEGORY[k].color }}>
                      {CATEGORY[k].symbol}
                    </span>{' '}
                    {CATEGORY[k].label}
                  </td>
                  <td>{sum.b.counts[k] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {finished && saved?.source === 'local' && !saved.coachSide && (
          <div className="card coach-ask">
            <div className="tc-label">📈 Suivi personnalisé</div>
            <p>Mettre à jour ton suivi avec cette partie ? Choisis le joueur que tu étais.</p>
            <div className="chips">
              <button className="chip" onClick={() => updateSaved({ coachSide: 'w' })}>
                {name('w')} (Blancs)
              </button>
              <button className="chip" onClick={() => updateSaved({ coachSide: 'b' })}>
                {name('b')} (Noirs)
              </button>
              <button className="chip" onClick={() => updateSaved({ coachSide: 'none' })}>
                Non merci
              </button>
            </div>
          </div>
        )}
        {finished && saved?.observer && (
          <div className="card coach-ask">
            <div className="tc-label">👀 Partie analysée en spectateur</div>
            <p className="muted small">Ton suivi n’est pas modifié. Tu jouais finalement cette partie ?</p>
            <div className="chips">
              <button className="chip" onClick={() => updateSaved({ observer: false, userColor: 'w' })}>
                J’avais les Blancs ({name('w')})
              </button>
              <button className="chip" onClick={() => updateSaved({ observer: false, userColor: 'b' })}>
                J’avais les Noirs ({name('b')})
              </button>
            </div>
          </div>
        )}
        {!saved?.observer && !(saved?.source === 'local' && !followed) && game.plies.length > 0 && (
          <RepertoireCheckCard
            sans={game.plies.map((p) => p.san)}
            color={user}
            startFen={game.startFen}
            onOpen={() => onNavigate('repertoire')}
          />
        )}
        {finished && coach && (
          <GameCoachCard
            analysis={coach}
            opening={opening}
            trainCount={mistakePuzzles(game, evals, reviews, user, request.id).length}
            onTrain={() => setTraining(true)}
            onNavigate={onNavigate}
          />
        )}
        {finished && (
          <div className="card">
            <div className="tc-label">Tes moments clés</div>
            {keyMoments.length === 0 ? (
              <p className="muted">Aucune erreur grave de ta part. Bravo !</p>
            ) : (
              <>
                <div className="key-moments">
                  {keyMoments.slice(0, 5).map(({ p, i, r }) => (
                    <button key={i} className="key-moment" onClick={() => go(i + 1)}>
                      <span className="cat-symbol" style={{ background: CATEGORY[r!.category].color }}>
                        {CATEGORY[r!.category].symbol}
                      </span>
                      <span>
                        {Math.ceil(p.index / 2)}
                        {p.color === 'b' ? '…' : '.'} {formatSan(p.san, settings.notation)}
                      </span>
                      <span className="muted small">{CATEGORY[r!.category].label}</span>
                    </button>
                  ))}
                </div>
                <button className="btn primary wide" onClick={() => setTraining(true)}>
                  S’entraîner sur mes erreurs ({mistakePuzzles(game, evals, reviews, user, request.id).length})
                </button>
                <p className="muted small">Elles sont aussi ajoutées à « Mes erreurs » dans le mode Problèmes.</p>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/** Barre joueur autour du plateau : nom, Elo, materiel pris, precision */
function ReviewPlayerBar({
  color,
  game,
  fen,
  accuracy,
  isUser,
}: {
  color: 'w' | 'b';
  game: GameData;
  fen: string;
  accuracy: number | null;
  isUser: boolean;
}) {
  const name = (color === 'w' ? game.headers.White : game.headers.Black) || (color === 'w' ? 'Blancs' : 'Noirs');
  const elo = color === 'w' ? game.headers.WhiteElo : game.headers.BlackElo;
  const result = game.headers.Result;
  const won = (result === '1-0' && color === 'w') || (result === '0-1' && color === 'b');
  const mat = materialFromFen(fen);
  return (
    <div className={`player-bar review-player ${isUser ? 'is-user' : ''}`}>
      <div className="player-id">
        <span className={`color-dot ${color === 'w' ? 'white' : 'black'}`} aria-hidden />
        <span className="player-name">{name}</span>
        {elo && elo !== '?' && <span className="bar-rating">({elo})</span>}
        {isUser && <span className="you-badge">toi</span>}
        {won && <span className="winner-badge">Victoire</span>}
      </div>
      <CapturedPieces pieces={mat.captured[color]} color={color} diff={mat.diff[color]} />
      {accuracy !== null && (
        <span className="acc-pill" title="Précision sur la partie">
          {accuracy.toFixed(1)} %
        </span>
      )}
    </div>
  );
}

/** Position du badge de categorie sur la case d'arrivee du coup */
export function badgePos(sq: string, flipped: boolean): React.CSSProperties {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const col = flipped ? 7 - f : f;
  const row = flipped ? r : 7 - r;
  return { left: `calc(${((col + 1) / 8) * 100}% - 14px)`, top: `calc(${(row / 8) * 100}% - 8px)` };
}

function ReviewMoveList({
  game,
  reviews,
  ply,
  onSelect,
}: {
  game: GameData;
  reviews: (MoveReview | undefined)[];
  ply: number;
  onSelect: (p: number) => void;
}) {
  const { settings } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Defilement de la liste seulement (scrollIntoView ferait bouger toute la page sur mobile)
    const list = ref.current;
    const el = list?.querySelector<HTMLElement>('.mv.current');
    if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2;
  }, [ply]);
  const cell = (i: number) => {
    const p = game.plies[i];
    if (!p) return <span />;
    const r = reviews[i];
    const showSym = r && !['best', 'excellent', 'good', 'book', 'forced'].includes(r.category);
    return (
      <button className={`mv ${ply === i + 1 ? 'current' : ''}`} onClick={() => onSelect(i + 1)}>
        {formatSan(p.san, settings.notation)}
        {showSym && (
          <span className="mv-sym" style={{ color: CATEGORY[r.category].color }}>
            {' '}
            {CATEGORY[r.category].symbol}
          </span>
        )}
      </button>
    );
  };
  const rows = [];
  const offset = game.plies[0]?.color === 'b' ? 1 : 0;
  for (let i = -offset; i < game.plies.length; i += 2) {
    rows.push(
      <div className="mv-row" key={i}>
        <span className="mv-num">{Math.floor((i + offset) / 2) + 1}.</span>
        {i >= 0 ? cell(i) : <span />}
        {cell(i + 1)}
      </div>,
    );
  }
  return (
    <div className="move-list" ref={ref}>
      {rows}
    </div>
  );
}

/**
 * Transforme les erreurs du joueur en exercices : position avant le coup adverse precedent,
 * puis le joueur doit trouver le meilleur coup.
 */
function mistakePuzzles(
  game: GameData,
  evals: (PosEval | undefined)[],
  reviews: (MoveReview | undefined)[],
  user: 'w' | 'b',
  gameId: string,
): Puzzle[] {
  const out: Puzzle[] = [];
  game.plies.forEach((p, i) => {
    const r = reviews[i];
    if (p.color !== user || !r || !KEY_CATEGORIES.includes(r.category) || i < 1) return;
    const best = evals[i]?.best;
    if (!best) return;
    const prev = game.plies[i - 1];
    out.push({
      id: `${gameId}-${i}`,
      fen: prev.fenBefore,
      moves: [prev.uci, best],
      rating: 0,
      themes: [],
    });
  });
  return out;
}

function MistakeTrainer({ puzzles, onExit }: { puzzles: Puzzle[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const finishedAll = index >= puzzles.length;

  if (finishedAll)
    return (
      <div className="lesson-solo">
        <div className="card lesson-result">
          <h2>Entraînement terminé</h2>
          <div className="xp-gain">
            {score} / {puzzles.length}
          </div>
          <p className="muted">
            Les positions ratées restent dans « Mes erreurs » (mode Problèmes) jusqu’à ce que tu les trouves deux fois du premier coup.
          </p>
          <button className="btn primary wide" onClick={onExit}>
            Retour à l’analyse
          </button>
        </div>
      </div>
    );

  const p = puzzles[index];
  return (
    <PuzzleSolver
      puzzle={p}
      onResult={() => undefined}
      onFinish={(f) => {
        const ok = f.solved && f.firstTry && !f.usedHint;
        if (ok) setScore((s) => s + 1);
        recordMistakeAttempt(p.id, ok);
      }}
      onNext={() => setIndex(index + 1)}
      nextLabel={index + 1 >= puzzles.length ? 'Terminer' : 'Erreur suivante'}
      allowSkip={false}
      sideTop={
        <div className="card lesson-progress-card">
          <div className="tc-label">Rejoue tes erreurs</div>
          <div className="status">
            Position {index + 1} / {puzzles.length}
          </div>
          <p className="muted small">Pendant la partie, tu as raté le meilleur coup ici. À toi de le trouver.</p>
          <button className="btn ghost" onClick={onExit}>
            ← Retour à l’analyse
          </button>
        </div>
      }
    />
  );
}
