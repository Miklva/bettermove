// Jouer contre le professeur : Stockfish commente chaque coup (meilleur coup, erreur, menaces),
// avec des fleches et des cercles sur le plateau, et une barre d'avantage. La partie continue toujours.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { Board } from '../components/Board';
import { BotPortrait } from '../bots/portraits';
import { engine } from '../engine/stockfish';
import { chooseMove, paramsFor } from '../engine/humanBot';
import type { Bot } from '../bots/roster';
import { CATEGORY, classifyPly, evaluatePosition, type MoveReview, type PlyInfo, type PosEval } from '../review/analysis';
import { explainMove, findThreat } from '../review/explainMove';
import { loadBook, lookup } from '../review/openings';
import { EvalBar } from '../review/widgets';
import { badgePos } from '../review/ReviewPage';
import type { ReviewRequest } from '../review/ImportPanel';
import { formatSan } from '../lib/notation';
import { openingFr } from '../history/names';
import { sounds } from '../lib/sounds';
import { useSettings } from '../settings/settings';
import { dropLocalGame, ongoingGames, type OngoingGame } from '../teacher/guard';
import { useSync } from '../sync/AccountModal';
import { circle, loadTeacherOptions, piecesInDanger, saveTeacherOptions, uciToShape, type TeacherOptions } from '../teacher/coach';
import { track } from '../achievements/events';
import { rewardTeacher } from '../economy/rewards';

import { t, tmap } from '../i18n';
import { your, type P } from '../puzzles/explain';

const isFem = (p: P) => p === 'r' || p === 'q';
// Accord en francais (entoure / entouree) : deux phrases distinctes
const inDanger = (p: P) =>
  t(isFem(p) ? 'Attention, {piece} entourée en rouge est en danger.' : 'Attention, {piece} entouré en rouge est en danger.', { piece: your(p) });
const hintNote = (p: P) =>
  t(isFem(p) ? 'Indice : regarde ce que peut faire {piece} entourée en bleu.' : 'Indice : regarde ce que peut faire {piece} entouré en bleu.', { piece: your(p) });
type Side = 'w' | 'b' | 'both';
type Shape = { orig: string; dest?: string; brush: string };

const LEVELS = [  { id: 'debutant', label: 'Débutant', rating: 800, desc: 'Fait des erreurs, idéal pour apprendre' },
  { id: 'club', label: 'Club', rating: 1200, desc: 'Solide, punit les grosses fautes' },
  { id: 'fort', label: 'Fort', rating: 1600, desc: 'Bon joueur de club' },
  { id: 'expert', label: 'Expert', rating: 2000, desc: 'Très peu d’erreurs' },
].map((l) => tmap(l));

interface Entry {
  fen: string;
  uci?: string;
  san?: string;
  color?: 'w' | 'b';
  by?: 'user' | 'prof';
  review?: MoveReview;
}

interface Comment {
  title: string;
  points: string[];
  category?: MoveReview['category'];
  san?: string;
}

const START = new Chess().fen();
const toCg = (c: 'w' | 'b') => (c === 'w' ? 'white' : 'black');

function destsOf(c: Chess) {
  const d = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) d.set(m.from, [...(d.get(m.from) ?? []), m.to]);
  return d;
}

function resultText(c: Chess): string | null {
  if (c.isCheckmate()) return c.turn() === 'w' ? t('Échec et mat : victoire des Noirs.') : t('Échec et mat : victoire des Blancs.');
  if (c.isStalemate()) return t('Pat : partie nulle.');
  if (c.isThreefoldRepetition()) return t('Nulle par répétition.');
  if (c.isInsufficientMaterial()) return t('Nulle : matériel insuffisant.');
  if (c.isDraw()) return t('Partie nulle.');
  return null;
}

export function TeacherPage({
  onReview,
  onGoto,
}: {
  onReview: (r: ReviewRequest) => void;
  onGoto: (g: OngoingGame) => void;
}) {
  const sync = useSync();
  const logged = !!sync.user && sync.status !== 'offline';
  // Anti-triche : pas de professeur (Stockfish) pendant une partie en cours
  const [ongoing, setOngoing] = useState<OngoingGame[] | null>(null);
  const checkOngoing = useCallback(() => {
    ongoingGames(logged).then(setOngoing);
  }, [logged]);
  useEffect(() => {
    checkOngoing();
    const id = window.setInterval(checkOngoing, 8000);
    window.addEventListener('focus', checkOngoing);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', checkOngoing);
    };
  }, [checkOngoing]);
  const { settings } = useSettings();
  const notation = settings.notation;
  const [opts, setOpts] = useState<TeacherOptions>(loadTeacherOptions);
  const [phase, setPhase] = useState<'setup' | 'play'>('setup');
  const [side, setSide] = useState<Side>(() => (localStorage.getItem('bettermove.teacherSide') as Side) || 'w');
  const [level, setLevel] = useState(() => LEVELS.find((l) => l.id === localStorage.getItem('bettermove.teacherLevel')) ?? LEVELS[1]);
  const [hist, setHist] = useState<Entry[]>([{ fen: START }]);
  const [evals, setEvals] = useState<Record<string, PosEval>>({});
  const [comment, setComment] = useState<Comment | null>(null);
  const [profNote, setProfNote] = useState<string | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [hint, setHint] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [over, setOver] = useState<string | null>(null);
  const inBook = useRef(true);
  const gen = useRef(0);
  const evalCache = useRef<Record<string, PosEval>>({});

  const update = (o: Partial<TeacherOptions>) => {
    const next = { ...opts, ...o };
    setOpts(next);
    saveTeacherOptions(next);
  };

  const cur = hist[hist.length - 1];
  const chess = useMemo(() => new Chess(cur.fen), [cur.fen]);
  const turn = chess.turn();
  // Fin de partie contre le professeur : comptee pour les succes
  useEffect(() => {
    if (!over) return;
    track('teacher-game');
    const won = side !== 'both' && over === t(side === 'w' ? 'Échec et mat : victoire des Blancs.' : 'Échec et mat : victoire des Noirs.');
    if (won) track('teacher-win');
    rewardTeacher(won);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);
  const userTurn = phase === 'play' && !over && (side === 'both' || side === turn);
  const orientation: 'white' | 'black' = side === 'b' ? 'black' : 'white';
  const lastEntry = hist.length > 1 ? cur : null;

  const ensureEval = useCallback(async (fen: string) => {
    const hit = evalCache.current[fen];
    if (hit) return hit;
    const e = await evaluatePosition(fen, { depth: 13, movetime: 900 });
    evalCache.current[fen] = e;
    setEvals((x) => ({ ...x, [fen]: e }));
    return e;
  }, []);

  useEffect(() => {
    engine.init().catch(() => setBusy(t('Impossible de charger Stockfish')));
  }, []);

  const playSound = (m: Move, byUser: boolean) => {
    if (m.captured) sounds.capture(m.captured, !byUser);
    else if (m.san.includes('+')) sounds.check();
    else if (m.san.startsWith('O-O')) sounds.castle();
    else sounds.move();
  };

  /** Le professeur joue son coup, puis signale ses menaces */
  const profMove = useCallback(
    async (fen: string, g: number) => {
      setBusy(t('Le professeur réfléchit…'));
      const p = paramsFor(level.rating);
      const lines = await engine.analyse(fen, { depth: p.depth, multipv: p.multipv });
      if (g !== gen.current) return;
      const bot = { id: 'prof', name: t('Le Prof'), rating: level.rating, style: 'Équilibrée' } as Bot;
      let uci: string;
      try {
        uci = chooseMove(fen, bot, lines).move;
      } catch {
        setBusy(null);
        return;
      }
      await new Promise((r) => setTimeout(r, 350));
      if (g !== gen.current) return;
      const c = new Chess(fen);
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      playSound(m, false);
      const entry: Entry = { fen: c.fen(), uci, san: m.san, color: m.color, by: 'prof' };
      setHist((h) => [...h, entry]);
      inBook.current = inBook.current && lookup(await loadBook(), c.fen()) !== undefined;
      const end = resultText(c);
      if (end) {
        setOver(end);
        setBusy(null);
        setProfNote(`${t('Le professeur joue {move}.', { move: formatSan(m.san, notation) })} ${end}`);
        return;
      }
      setBusy(t('Le professeur analyse la position…'));
      const e = await ensureEval(c.fen());
      if (g !== gen.current) return;
      const userColor = c.turn();
      const danger = piecesInDanger(c.fen(), userColor);
      let note = t('Le professeur joue {move}.', { move: formatSan(m.san, notation) });
      const s: Shape[] = [];
      if (opts.profComments) {
        const threat = await findThreat(c.fen(), e, notation);
        if (g !== gen.current) return;
        if (threat) {
          note += ` ${threat.text}`;
          s.push(uciToShape(threat.uci, 'red'));
        }
        if (danger.length)
          note += ' ' + (danger.length > 1 ? t('Attention, tes pièces entourées en rouge sont en danger.') : inDanger((c.get(danger[0])?.type ?? 'p') as P));
        else if (!threat) note += ' ' + t('Pas de menace immédiate : à toi de jouer ton plan.');
        if (c.inCheck()) note += ' ' + t('Tu es en échec !');
      }
      danger.forEach((sq) => s.push(circle(sq, 'red')));
      setProfNote(note);
      setShapes(s);
      setHint(0);
      setBusy(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level.rating, notation, opts.profComments, ensureEval],
  );

  const start = async () => {
    gen.current++;
    const g = gen.current;
    localStorage.setItem('bettermove.teacherSide', side);
    localStorage.setItem('bettermove.teacherLevel', level.id);
    inBook.current = true;
    setHist([{ fen: START }]);
    setComment(null);
    setProfNote(null);
    setShapes([]);
    setOver(null);
    setHint(0);
    setPhase('play');
    track('teacher-start');
    sounds.start();
    if (side === 'b') await profMove(START, g);
    else {
      setBusy(t('Le professeur prépare la partie…'));
      await ensureEval(START);
      if (g === gen.current) setBusy(null);
    }
  };

  const onMove = async (from: string, to: string) => {
    if (!userTurn || busy) {
      setResetToken((x) => x + 1);
      return;
    }
    const g = gen.current;
    const c = new Chess(cur.fen);
    const piece = c.get(from as never) as { type: string } | null;
    const promotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined;
    let m: Move;
    try {
      m = c.move({ from, to, promotion });
    } catch {
      setResetToken((x) => x + 1);
      return;
    }
    playSound(m, true);
    const fenBefore = cur.fen;
    const entry: Entry = { fen: c.fen(), uci: from + to + (promotion ?? ''), san: m.san, color: m.color, by: 'user' };
    setHist((h) => [...h, entry]);
    setShapes([]);
    setProfNote(null);
    setHint(0);
    setBusy(t('Le professeur regarde ton coup…'));

    const [before, after, book] = await Promise.all([ensureEval(fenBefore), ensureEval(c.fen()), loadBook()]);
    if (g !== gen.current) return;
    inBook.current = inBook.current && hist.length < 30 && lookup(book, c.fen()) !== undefined;
    const ply: PlyInfo = { index: hist.length, san: m.san, uci: entry.uci!, color: m.color, fenBefore, fenAfter: c.fen(), move: m };
    const review = classifyPly(ply, before, after, inBook.current);
    const raw = lookup(book, c.fen()) ?? null;
    const opening = raw ? openingFr(raw) : null;
    const ex = explainMove(ply, review, before, after, notation, opening ?? null);
    setHist((h) => h.map((x, i) => (i === h.length - 1 ? { ...x, review } : x)));
    setComment({ title: ex.title, points: ex.points, category: review.category, san: m.san });
    if (CATEGORY[review.category].good) sounds.review(review.category);
    else if (review.category === 'blunder' || review.category === 'mistake') sounds.review(review.category);

    // Reperes visuels : meilleur coup, reponse dangereuse, pieces en danger
    const s: Shape[] = [];
    if (!CATEGORY[review.category].good) {
      s.push(uciToShape(entry.uci!, 'red'));
      if (ex.better) s.push(uciToShape(ex.better.uci, 'green'));
      if (after.best) {
        const t = new Chess(c.fen());
        try {
          const reply = t.move({ from: after.best.slice(0, 2), to: after.best.slice(2, 4), promotion: after.best[4] });
          if (reply.captured || reply.san.includes('#')) s.push(uciToShape(after.best, 'yellow'));
        } catch {
          /* rien */
        }
      }
    }
    piecesInDanger(c.fen(), m.color).forEach((sq) => s.push(circle(sq, 'red')));
    // Cibles : pieces adverses que tu attaques sans qu'elles soient protegees
    piecesInDanger(c.fen(), m.color === 'w' ? 'b' : 'w').forEach((sq) => s.push(circle(sq, 'green')));
    setShapes(s);

    const end = resultText(c);
    if (end) {
      setOver(end);
      setBusy(null);
      return;
    }
    if (side === 'both') {
      setBusy(null);
      return;
    }
    // Laisse le temps de lire le commentaire et de voir les fleches
    await new Promise((r) => setTimeout(r, CATEGORY[review.category].good ? 700 : 1600));
    if (g !== gen.current) return;
    await profMove(c.fen(), g);
  };

  /** Reprendre le dernier coup (et la reponse du professeur) */
  const takeback = () => {
    track('teacher-takeback');
    gen.current++;
    setHist((h) => {
      let n = h.length;
      while (n > 1 && h[n - 1].by === 'prof') n--;
      if (n > 1) n--;
      return h.slice(0, Math.max(1, n));
    });
    setComment({ title: t('Coup repris'), points: [t('Cherche un meilleur coup : le professeur commentera ton nouvel essai.')] });
    setProfNote(null);
    setShapes([]);
    setHint(0);
    setOver(null);
    setBusy(null);
    inBook.current = false;
  };

  const showHint = async () => {
    if (!userTurn || busy) return;
    const e = await ensureEval(cur.fen);
    if (!e.best) return;
    const next = Math.min(2, hint + 1);
    setHint(next);
    if (next === 1) {
      const p = chess.get(e.best.slice(0, 2) as never) as { type: string } | null;
      setShapes([circle(e.best.slice(0, 2), 'blue')]);
      setProfNote(hintNote((p?.type ?? 'p') as P));
    } else {
      let san = '';
      try {
        san = formatSan(new Chess(cur.fen).move({ from: e.best.slice(0, 2), to: e.best.slice(2, 4), promotion: e.best[4] }).san, notation);
      } catch {
        /* rien */
      }
      setShapes([uciToShape(e.best, 'blue')]);
      setProfNote(t('Le meilleur coup ici : {move}.', { move: san }));
    }
  };

  const pgn = () => {
    const c = new Chess();
    for (const e of hist.slice(1)) if (e.uci) c.move({ from: e.uci.slice(0, 2), to: e.uci.slice(2, 4), promotion: e.uci[4] });
    c.setHeader('Event', t('Partie contre le professeur'));
    c.setHeader('White', side === 'b' ? t('Le Prof') : t('Toi'));
    c.setHeader('Black', side === 'w' ? t('Le Prof') : t('Toi'));
    return c.pgn();
  };

  const current = evals[cur.fen];
  const dests = useMemo(() => (userTurn && !busy ? destsOf(chess) : new Map<string, string[]>()), [chess, userTurn, busy]);
  const moves = hist.slice(1);
  const rows: { n: number; w?: Entry; b?: Entry }[] = [];
  moves.forEach((e, i) => {
    const n = Math.floor(i / 2);
    rows[n] = rows[n] ?? { n: n + 1 };
    if (i % 2 === 0) rows[n].w = e;
    else rows[n].b = e;
  });

  const options = (
    <div className="teacher-opts">
      <label className="switch-row">
        <input type="checkbox" checked={opts.evalBar} onChange={(e) => update({ evalBar: e.target.checked })} />{" "}{t("Barre d’avantage")}</label>
      <label className="switch-row">
        <input type="checkbox" checked={opts.arrows} onChange={(e) => update({ arrows: e.target.checked })} />{" "}{t("Flèches et cercles")}</label>
      <label className="switch-row">
        <input type="checkbox" checked={opts.profComments} onChange={(e) => update({ profComments: e.target.checked })} />{" "}{t("Signaler les menaces du professeur")}</label>
    </div>
  );

  // Une partie commence ailleurs pendant la lecon : on fige le professeur
  const blocked = !!ongoing && ongoing.length > 0;
  useEffect(() => {
    if (blocked) {
      gen.current++;
      setBusy(null);
    }
  }, [blocked]);

  if (ongoing === null) return <div className="teacher-setup"><p className="muted center">{t("Vérification de tes parties en cours…")}</p></div>;
  if (blocked)
    return (
      <div className="teacher-setup">
        <section className="card teacher-blocked">
          <BotPortrait id="prof" size={84} />
          <div>
            <h1>{t("Le professeur attend la fin de ta partie")}</h1>
            <p className="muted">{t("Pour que personne ne puisse se faire aider par Stockfish pendant un match, ce mode est désactivé tant qu’une partie est en cours. Termine-la (ou abandonne-la), puis reviens : le professeur sera là.")}</p>
            <ul className="teacher-ongoing">
              {ongoing.map((g) => (
                <li key={g.kind}>
                  <span>
                    {g.kind === 'online' ? '🌍' : g.kind === 'bot' ? '🤖' : '👥'} {g.label}
                  </span>
                  <span className="row">
                    <button className="btn primary" onClick={() => onGoto(g)}>{t("Reprendre la partie")}</button>
                    {g.kind === 'local' && (
                      <button
                        className="btn ghost"
                        onClick={() => {
                          dropLocalGame();
                          checkOngoing();
                        }}
                        title={t("Une partie 1v1 sur écran n’a pas d’enjeu : tu peux l’arrêter d’ici")}
                      >{t("Arrêter cette partie")}</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    );

  if (phase === 'setup')
    return (
      <div className="teacher-setup">
        <section className="card teacher-hero">
          <BotPortrait id="prof" size={96} />
          <div>
            <h1>{t("Jouer contre le professeur")}</h1>
            <p className="muted">{t("Une vraie partie, avec un professeur qui commente chacun de tes coups : bon coup, imprécision, erreur, et ce qu’il fallait jouer. Des flèches et des cercles montrent les menaces et les pièces en danger. La partie continue toujours, et tu peux reprendre un coup pour essayer mieux.")}</p>
          </div>
        </section>
        <section className="card teacher-config">
          <span className="label">{t("Tu joues")}</span>
          <div className="chips">
            {(
              [
                ['w', t("♔ Les Blancs")],
                ['b', t("♚ Les Noirs")],
                ['both', t("♔♚ Les deux, à tour de rôle")],
              ] as [Side, string][]
            ).map(([id, l]) => (
              <button key={id} className={`chip ${side === id ? 'selected' : ''}`} onClick={() => setSide(id)}>
                {l}
              </button>
            ))}
          </div>
          {side === 'both' && (
            <p className="muted small">{t("Tu joues les deux camps : le professeur commente chaque coup, sans jouer lui-même.")}</p>
          )}
          {side !== 'both' && (
            <>
              <span className="label">{t("Niveau du professeur")}</span>
              <div className="teacher-levels">
                {LEVELS.map((l) => (
                  <button key={l.id} className={`teacher-level ${level.id === l.id ? 'selected' : ''}`} onClick={() => setLevel(l)}>
                    <strong>{l.label}</strong>
                    <span className="muted tiny">{t("environ")}{" "}{l.rating}{" "}{t("Elo")}</span>
                    <span className="muted tiny">{l.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="label">{t("Aides affichées")}</span>
          {options}
          <button className="btn primary big" onClick={() => void start()}>{t("Commencer la partie")}</button>
        </section>
      </div>
    );

  const cat = comment?.category ? CATEGORY[comment.category] : null;

  return (
    <div className="play teacher">
      <section className="board-col">
        <div className={`teacher-board ${opts.evalBar ? '' : 'no-bar'}`}>
          {opts.evalBar && <EvalBar e={current} flipped={orientation === 'black'} />}
          <div className="board-stage">
            <Board
              fen={cur.fen}
              orientation={orientation}
              turnColor={toCg(turn)}
              movableColor={userTurn && !busy ? toCg(turn) : undefined}
              dests={dests}
              lastMove={lastEntry?.uci?.slice(0, 4) ?? ''}
              inCheck={chess.inCheck()}
              premovable={false}
              shapes={opts.arrows ? shapes : []}
              resetToken={resetToken}
              onMove={(f, t) => void onMove(f, t)}
            />
            {lastEntry?.review && lastEntry.uci && (
              <span
                className="move-badge"
                style={{ background: CATEGORY[lastEntry.review.category].color, ...badgePos(lastEntry.uci.slice(2, 4), orientation === 'black') }}
                title={CATEGORY[lastEntry.review.category].label}
              >
                {CATEGORY[lastEntry.review.category].symbol}
              </span>
            )}
          </div>
        </div>
      </section>
      <aside className="side flush">
        <div className="card teacher-talk">
          <div className="teacher-talk-head">
            <BotPortrait id="prof" size={44} />
            <div>
              <div className="tc-label">{t("Le professeur ·")}{" "}{side === 'both' ? t('tu joues les deux camps') : t('niveau {level}', { level: level.label })}
              </div>
              <strong>
                {over ?? busy ?? (userTurn ? (turn === 'w' ? t('À toi de jouer (Blancs)') : t('À toi de jouer (Noirs)')) : '…')}
              </strong>
            </div>
          </div>
          {comment && (
            <div className="teacher-comment" style={cat ? { borderColor: cat.color } : undefined}>
              <div className="teacher-comment-title">
                {cat && (
                  <span className="cat-pill" style={{ background: cat.color }}>
                    {cat.symbol} {cat.label}
                  </span>
                )}
                <strong>{comment.san ? formatSan(comment.san, notation) : comment.title}</strong>
              </div>
              <ul>
                {comment.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {profNote && <p className="teacher-note">{profNote}</p>}
          {opts.arrows && shapes.length > 0 && (
            <div className="teacher-legend muted tiny">
              <span><i className="lg green" />{" "}{t("meilleur coup / cible")}</span>
              <span><i className="lg red" />{" "}{t("ton coup raté / menace / pièce en danger")}</span>
              <span><i className="lg yellow" />{" "}{t("réponse dangereuse")}</span>
              <span><i className="lg blue" />{" "}{t("indice")}</span>
            </div>
          )}
        </div>
        <div className="card teacher-moves">
          {rows.length === 0 ? (
            <p className="muted small">{t("Les coups apparaîtront ici, avec l’avis du professeur.")}</p>
          ) : (
            <ol>
              {rows.map((r) => (
                <li key={r.n}>
                  <span className="mv-n">{r.n}.</span>
                  {[r.w, r.b].map((e, i) =>
                    e ? (
                      <span key={i} className={`mv ${e.by}`}>
                        {formatSan(e.san ?? '', notation)}
                        {e.review && (
                          <b style={{ color: CATEGORY[e.review.category].color }} title={CATEGORY[e.review.category].label}>
                            {' '}
                            {CATEGORY[e.review.category].symbol}
                          </b>
                        )}
                      </span>
                    ) : (
                      <span key={i} />
                    ),
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="card actions">
          <button className="btn" disabled={!userTurn || !!busy} onClick={() => void showHint()}>
            💡 {hint === 0 ? t("Indice") : hint === 1 ? t("Montrer le coup") : t("Coup montré")}
          </button>
          <button className="btn" disabled={hist.length < 2 || (!!busy && !over)} onClick={takeback}>{t("↶ Reprendre mon coup")}</button>
          {over && (
            <button
              className="btn primary"
              onClick={() => onReview({ id: `prof-${Date.now()}`, pgn: pgn(), userColor: side === 'b' ? 'b' : 'w', source: 'local' })}
            >{t("🔍 Analyser la partie")}</button>
          )}
          <button
            className="btn ghost"
            onClick={() => {
              gen.current++;
              setBusy(null);
              setPhase('setup');
            }}
          >{t("Nouvelle partie")}</button>
        </div>
        <div className="card">{options}</div>
      </aside>
    </div>
  );
}
