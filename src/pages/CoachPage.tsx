// Suivi personnalise : analyse de l'historique, points faibles recurrents et leur evolution,
// conseils, exercices sur ses propres erreurs et notes libres du joueur.
import { useEffect, useMemo, useRef, useState } from 'react';
import { listGames, type SavedGame } from '../review/store';
import { analyzeForCoach, coachColor, type ErrorRec, type WeakId } from '../coach/analyze';
import {
  buildReport,
  listAnalyses,
  listMastered,
  listSnapshots,
  loadNotes,
  markMastered,
  recordSnapshot,
  saveAnalysis,
  saveNotes,
  clearAnalyses,
  WEAKNESSES,
  type Trend,
  type WeakStat,
} from '../coach/report';
import { engine } from '../engine/stockfish';
import { load, save } from '../lib/storage';
import { PuzzleSolver } from '../puzzles/PuzzleSolver';
import type { Puzzle } from '../puzzles/db';
import { THEMES } from '../puzzles/themes';
import { ALL_LESSONS } from '../lessons/courses';
import { the, type P } from '../puzzles/explain';
import { openLessonNext } from './LessonsPage';
import type { PlayerProfile } from '../rating/profile';
import { earn } from '../shop/store';
import { EARN } from '../shop/items';

/** XP du suivi : par position maitrisee et par seance terminee */
const COACH_XP = { position: 5, session: 20 };
import { lessonsForOpening } from '../coach/openings';
import { MOTIF_NAME } from '../coach/GameCoachCard';
import { openingFr } from '../history/names';
import type { GameAnalysis } from '../coach/analyze';
import { track } from '../achievements/events';

import { locale, t, tmap, tn } from '../i18n';
type Mode = 'bots' | 'puzzles' | 'lessons' | 'review';

interface Props {
  onNavigate: (m: Mode) => void;
  player: PlayerProfile;
}

const WINDOW_KEY = 'bettermove.coach.window';
const TREND: Record<Trend, { label: string; cls: string }> = tmap({
  new: { label: '🆕 Nouveau', cls: 'worse' },
  worse: { label: '📈 En hausse', cls: 'worse' },
  stable: { label: '➖ Stable', cls: 'stable' },
  better: { label: '📉 En progrès', cls: 'better' },
  resolved: { label: '✅ Corrigé', cls: 'better' },
});
const MOTIF_FR: Record<string, string> = tmap({
  fork: 'la fourchette',
  pin: 'le clouage',
  skewer: 'l’enfilade',
  discoveredAttack: 'l’attaque à la découverte',
  doubleCheck: 'l’échec double',
  sacrifice: 'le sacrifice',
  promotion: 'la promotion',
});

const fmt = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 1 });
/** Parties ou l'on sait quel camp suivre (spectateur et 1v1 sans choix exclus) */
const isOwnGame = (g: SavedGame) => coachColor(g) !== null;

export function insight(s: WeakStat): string | null {
  const d = s.topDetail;
  switch (s.def.id) {
    case 'hanging':
    case 'ignoredThreat':
      return d && d.n >= 2 && 'pnbrq'.includes(d.key) ? t('Pièce la plus souvent perdue : {piece} ({n} fois).', { piece: t(the(d.key as P)), n: d.n }) : null;
    case 'missedTactic':
      return d && d.n >= 2 && MOTIF_FR[d.key] ? t('Motif le plus souvent raté : {motif} ({n} fois).', { motif: MOTIF_FR[d.key], n: d.n }) : null;
    case 'opening':
      return s.topOpening && s.topOpening.n >= 2 && s.topOpening.name !== 'Hors théorie' && s.topOpening.name !== t('Hors théorie')
        ? t('Surtout dans : {name} ({n} erreurs).', { name: s.topOpening.name, n: s.topOpening.n })
        : null;
    case 'time':
      return tn(s.count, '{n} partie perdue au temps.', '{n} parties perdues au temps.');
    default:
      return null;
  }
}

export function CoachPage({ onNavigate, player }: Props) {
  const [windowSize, setWindowSize] = useState<number>(() => load(WINDOW_KEY, 30));
  const [analyses, setAnalyses] = useState(listAnalyses);
  const [running, setRunning] = useState(true);
  const [progress, setProgress] = useState<{ i: number; n: number; label: string } | null>(null);
  const [training, setTraining] = useState<{ title: string; errors: ErrorRec[] } | null>(null);
  const stop = useRef(false);
  const [runId, setRunId] = useState(0);

  // Parties du joueur les plus recentes (1v1 seulement si un camp a ete choisi)
  const games = useMemo(() => {
    const own = listGames().filter(isOwnGame);
    return own.sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? '')).slice(0, windowSize);
  }, [windowSize]);
  const todo = games.filter((g) => !analyses[g.id]);

  // Analyse en tache de fond tant que l'onglet est ouvert
  useEffect(() => {
    if (!running || !todo.length) {
      setProgress(null);
      return;
    }
    stop.current = false;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < todo.length; i++) {
        if (stop.current || cancelled) break;
        const g = todo[i];
        const opp = coachColor(g) === 'w' ? g.black : g.white;
        setProgress({ i: i + 1, n: todo.length, label: opp.replace(/\s*\(\d+\)$/, '') });
        try {
          const a = await analyzeForCoach(g, () => stop.current || cancelled);
          if (!a) break;
          saveAnalysis(a);
          setAnalyses(listAnalyses());
        } catch {
          // Partie illisible : on la marque pour ne pas boucler dessus
          saveAnalysis({ id: g.id, analyzedAt: new Date().toISOString(), playedAt: g.playedAt, source: g.source, userColor: g.userColor, result: 'none', userMoves: 0, errors: [] });
        }
      }
      if (!cancelled) setProgress(null);
    })();
    return () => {
      cancelled = true;
      stop.current = true;
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, windowSize, todo.length === 0, runId]);

  const inWindow = games.map((g) => analyses[g.id]).filter((a) => !!a);
  const report = useMemo(() => buildReport(inWindow, games), [analyses, games]); // eslint-disable-line react-hooks/exhaustive-deps

  // Historique de l'evolution des points faibles (une fois l'analyse terminee)
  useEffect(() => {
    if (!todo.length && report.games >= 5) recordSnapshot(report);
  }, [todo.length, report]);

  if (training)
    return (
      <Trainer
        title={training.title}
        errors={training.errors}
        games={games}
        player={player}
        onExit={() => setTraining(null)}
      />
    );

  const active = report.stats.filter((s) => s.trend !== 'resolved');
  const priorities = active.filter((s) => s.def.id !== 'positional').slice(0, 3);
  const others = active.filter((s) => !priorities.includes(s));
  const progressList = report.stats.filter((s) => s.trend === 'resolved' || s.trend === 'better');
  const mastered = listMastered();
  const exercisesFor = (s: WeakStat) => s.errors.filter((e) => e.prevFen && e.prevUci && !mastered.has(e.id));
  const mix = priorities.flatMap((s) => exercisesFor(s).slice(0, 6));

  return (
    <div className="coach">
      <div className="card coach-head">
        <div>
          <h2>{t("Suivi personnalisé")}</h2>
          <p className="muted small">{t('Stockfish relit tes {n} dernières parties (bots, chess.com, Lichess, PGN) pour trouver les erreurs qui reviennent. Le bilan se met à jour à chaque nouvelle partie.', { n: windowSize })}</p>
        </div>
        <div className="coach-controls">
          <label className="small muted">{t("Parties suivies")}{' '}
            <select
              className="text-input select"
              value={windowSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                save(WINDOW_KEY, v);
                setWindowSize(v);
              }}
            >
              {[10, 20, 30, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {todo.length > 0 && (
            <button className="btn" onClick={() => setRunning(!running)}>
              {running ? t("⏸ Pause") : t("▶ Reprendre l’analyse")}
            </button>
          )}
          <button
            className="btn ghost"
            title={t("Réanalyser toutes les parties")}
            onClick={() => {
              if (!window.confirm(t('Réanalyser toutes les parties suivies ?'))) return;
              stop.current = true;
              engine.stop();
              clearAnalyses();
              setAnalyses({});
              setRunning(true);
              setRunId((x) => x + 1);
            }}
          >
            ↻
          </button>
        </div>
        {progress && (
          <div className="coach-progress">
            <div className="bar">
              <span style={{ width: `${((games.length - todo.length) / Math.max(1, games.length)) * 100}%` }} />
            </div>
            <span className="small muted">{t('Analyse en cours : partie contre {name} ({i}/{total}). Tu peux continuer à lire le bilan, il se complète au fur et à mesure.', { name: progress.label, i: games.length - todo.length + 1, total: games.length })}</span>
          </div>
        )}
        {!progress && todo.length > 0 && !running && (
          <p className="small muted">{tn(todo.length, '{n} partie en attente d’analyse.', '{n} parties en attente d’analyse.')}</p>
        )}
      </div>

      {games.length === 0 ? (
        <div className="card center">
          <p>{t("Pas encore de partie à analyser.")}</p>
          <p className="muted small">{t("Joue contre un bot ou importe tes parties chess.com et Lichess depuis l’Historique.")}</p>
          <div className="row center-row">
            <button className="btn primary" onClick={() => onNavigate('bots')}>{t("Jouer contre un bot")}</button>
            <button className="btn" onClick={() => onNavigate('review')}>{t("Importer mes parties")}</button>
          </div>
        </div>
      ) : report.games === 0 ? (
        <div className="card center muted">{t("Première analyse en cours…")}</div>
      ) : (
        <>
          <div className="stat-grid coach-summary">
            <div className="card stat-tile">
              <span className="tc-label">{t("Parties analysées")}</span>
              <strong>{report.games}</strong>
              <span className="muted small">
                {report.olderGames >= 3
                  ? t('{recent} récentes comparées aux {older} précédentes', { recent: report.recentGames, older: report.olderGames })
                  : t("Encore quelques parties pour mesurer ton évolution")}
              </span>
            </div>
            <div className="card stat-tile">
              <span className="tc-label">{t("Erreurs par partie")}</span>
              <strong>{fmt(report.errorsPerGame)}</strong>
              <span className="muted small">{t("erreurs et gaffes (hors imprécisions)")}</span>
            </div>
            <div className="card stat-tile accent">
              <span className="tc-label">{t("Priorité n°1")}</span>
              <strong className="small-strong">{priorities[0] ? `${priorities[0].def.icon} ${priorities[0].def.title}` : t("Rien à signaler")}</strong>
            </div>
            <div className="card stat-tile">
              <span className="tc-label">{t("Positions à retravailler")}</span>
              <strong>{report.stats.reduce((n, s) => n + exercisesFor(s).length, 0)}</strong>
              <span className="muted small">{mastered.size}{" "}{t("déjà maîtrisée")}{mastered.size > 1 ? 's' : ''}</span>
            </div>
          </div>

          {mix.length > 0 && (
            <div className="card coach-cta">
              <div>
                <strong>{t("🏋️ Séance du jour")}</strong>
                <p className="muted small">
                  {t('{n} positions tirées de tes parties, sur tes {p} priorités. Trouve le coup que tu as raté.', { n: mix.length, p: priorities.length })}</p>
              </div>
              <button className="btn primary" onClick={() => setTraining({ title: t('Séance du jour'), errors: shuffle(mix) })}>{t("Commencer")}</button>
            </div>
          )}

          <h3 className="coach-h">{t("Tes priorités")}</h3>
          {priorities.length === 0 && <p className="card muted">{t("Aucune erreur récurrente sur cette période. Beau travail !")}</p>}
          {priorities.map((s, i) => (
            <WeakCard
              key={s.def.id}
              s={s}
              rank={i + 1}
              exercises={exercisesFor(s)}
              onTrain={() => setTraining({ title: s.def.title, errors: exercisesFor(s) })}
              onNavigate={onNavigate}
            />
          ))}

          <MissedCard analyses={inWindow} onNavigate={onNavigate} />
          <OpeningsCard analyses={inWindow} onNavigate={onNavigate} />

          {others.length > 0 && (
            <>
              <h3 className="coach-h">{t("À surveiller")}</h3>
              {others.map((s) => (
                <WeakCard
                  key={s.def.id}
                  s={s}
                  compact
                  exercises={exercisesFor(s)}
                  onTrain={() => setTraining({ title: s.def.title, errors: exercisesFor(s) })}
                  onNavigate={onNavigate}
                />
              ))}
            </>
          )}

          {progressList.length > 0 && (
            <>
              <h3 className="coach-h">{t("Tes progrès")}</h3>
              <div className="card progress-list">
                {progressList.map((s) => (
                  <div key={s.def.id} className="progress-item">
                    <span>
                      {s.def.icon} {s.def.title}
                    </span>
                    <span className={`trend ${TREND[s.trend].cls}`}>{TREND[s.trend].label}</span>
                    <span className="muted small">
                      {fmt(s.olderRate)} → {fmt(s.recentRate)}{" "}{t("par partie")}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Evolution />
        </>
      )}

      <NotesCard />
    </div>
  );
}

function shuffle<T>(l: T[]): T[] {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function WeakCard({
  s,
  rank,
  compact,
  exercises,
  onTrain,
  onNavigate,
}: {
  s: WeakStat;
  rank?: number;
  compact?: boolean;
  exercises: ErrorRec[];
  onTrain: () => void;
  onNavigate: (m: Mode) => void;
}) {
  const [open, setOpen] = useState(!compact);
  const extra = insight(s);
  const lessons = s.def.lessons.map((id) => ALL_LESSONS.find((l) => l.id === id)).filter((l) => !!l);
  return (
    <div className={`card weak ${compact ? 'compact' : ''}`}>
      <div className="weak-head" onClick={() => setOpen(!open)} role="button">
        <span className="weak-icon">{s.def.icon}</span>
        <div className="weak-title">
          <strong>
            {rank && <span className="weak-rank">#{rank}</span>} {s.def.title}
          </strong>
          <span className="muted small">
            {s.def.id === 'time'
              ? tn(s.count, '{n} défaite au temps', '{n} défaites au temps')
              : t('{n} fois · {rate} par partie récemment', { n: s.count, rate: fmt(s.recentRate) })}
            {s.olderRate !== s.recentRate && s.trend !== 'stable' ? t(' (avant : {rate})', { rate: fmt(s.olderRate) }) : ''}
          </span>
        </div>
        <span className={`trend ${TREND[s.trend].cls}`}>{TREND[s.trend].label}</span>
        <span className="weak-chevron">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="weak-body">
          <p>{s.def.what}</p>
          {extra && <p className="weak-insight">👉 {extra}</p>}
          <ul className="tips">
            {s.def.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {s.errors.length > 0 && (
            <div className="weak-examples small">
              <span className="tc-label">{t("Exemples récents")}</span>
              {s.errors.slice(0, 3).map((e) => (
                <span key={e.id} className="muted">{t('Coup {n} : tu as joué {played}, il fallait {best}.', { n: e.moveNo, played: e.playedSan, best: e.bestSan })}
                </span>
              ))}
            </div>
          )}
          <div className="weak-actions">
            {exercises.length > 0 && (
              <button className="btn primary" onClick={onTrain}>{t('🏋️ Retravailler mes positions ({n})', { n: exercises.length })}
              </button>
            )}
            {s.def.themes.slice(0, 2).map((th) => (
              <button
                key={th}
                className="btn"
                onClick={() => {
                  save('bettermove.puzzleTheme', th);
                  onNavigate('puzzles');
                }}
              >{t("🧩 Problèmes :")}{" "}{THEMES[th]?.label ?? th}
              </button>
            ))}
            {lessons.slice(0, 2).map((l) => (
              <button
                key={l!.id}
                className="btn ghost"
                onClick={() => {
                  openLessonNext(l!.id);
                  onNavigate('lessons');
                }}
              >
                🎓 {l!.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Evolution() {
  const snaps = listSnapshots();
  if (snaps.length < 2) return null;
  return (
    <>
      <h3 className="coach-h">{t("Évolution de tes points faibles")}</h3>
      <div className="card evolution">
        {snaps
          .slice()
          .reverse()
          .slice(0, 8)
          .map((s, i) => (
            <div key={s.at} className={`evo-row ${i === 0 ? 'current' : ''}`}>
              <span className="muted small">{i === 0 ? t("Maintenant") : new Date(s.at).toLocaleDateString('fr-FR')}</span>
              <span>
                {s.top.map((t) => (
                  <span key={t.id} className="evo-chip" title={WEAKNESSES[t.id as WeakId].title}>
                    {WEAKNESSES[t.id as WeakId].icon} {WEAKNESSES[t.id as WeakId].title}
                  </span>
                ))}
              </span>
            </div>
          ))}
      </div>
    </>
  );
}

function NotesCard() {
  const [notes, setNotes] = useState(loadNotes);
  const [saved, setSaved] = useState(true);
  const timer = useRef<number | null>(null);
  const change = (text: string) => {
    setNotes({ text });
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveNotes({ text, updatedAt: new Date().toISOString() });
      setSaved(true);
    }, 600);
  };
  return (
    <div className="card notes">
      <div className="notes-head">
        <h3>{t("📝 Mes notes")}</h3>
        <span className="muted small">{saved ? (notes.updatedAt ? t('Enregistré le {date}', { date: new Date(notes.updatedAt).toLocaleString(locale()) }) : '') : t("Enregistrement…")}</span>
      </div>
      <textarea
        className="notes-input"
        placeholder={t("Tes objectifs, ce que tu as compris, tes ouvertures à revoir…\nEx. : « Toujours vérifier les fourchettes de cavalier avant de jouer »")}
        value={notes.text}
        onChange={(e) => change(e.target.value)}
      />
    </div>
  );
}

/* ---------------- Exercices ---------------- */

function Trainer({
  title,
  errors,
  games,
  player,
  onExit,
}: {
  title: string;
  errors: ErrorRec[];
  games: SavedGame[];
  player: PlayerProfile;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const list = errors.filter((e) => e.prevFen && e.prevUci);
  const rewarded = useRef(false);

  // Fin de seance : bonus si au moins une position a ete trouvee
  useEffect(() => {
    if (index < list.length || rewarded.current || score === 0) return;
    rewarded.current = true;
    player.grantXp(COACH_XP.session);
    earn(EARN.coachSession, t('Séance du suivi terminée'));
    track('coach-session');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (index >= list.length)
    return (
      <div className="lesson-solo">
        <div className="card lesson-result">
          <h2>{t("Séance terminée")}</h2>
          <div className="xp-gain">
            {score} / {list.length}
          </div>
          <p className="muted">{t("Les positions trouvées du premier coup sont marquées comme maîtrisées. Les autres reviendront dans tes prochaines séances.")}</p>
          {score > 0 && (
            <div className="xp-gain">
              +{score * COACH_XP.position + COACH_XP.session} XP · +{score * EARN.coachPosition + EARN.coachSession} 🪙
            </div>
          )}
          <button className="btn primary wide" onClick={onExit}>{t("Retour au suivi")}</button>
        </div>
      </div>
    );

  const e = list[index];
  const g = games.find((x) => x.id === e.gameId);
  const opp = g ? (g.userColor === 'w' ? g.black : g.white).replace(/\s*\(\d+\)$/, '') : null;
  const puzzle: Puzzle = { id: e.id, fen: e.prevFen!, moves: [e.prevUci!, e.best], rating: 0, themes: [] };
  return (
    <PuzzleSolver
      key={e.id}
      puzzle={puzzle}
      onResult={() => undefined}
      onFinish={(f) => {
        if (f.solved && f.firstTry && !f.usedHint && !f.revealed) {
          setScore((x) => x + 1);
          markMastered(e.id);
          // Position maitrisee : XP et pieces
          player.grantXp(COACH_XP.position);
          earn(EARN.coachPosition, t('Position du suivi maîtrisée'), true);
        }
      }}
      onNext={() => setIndex(index + 1)}
      nextLabel={index + 1 >= list.length ? t("Terminer") : t("Position suivante")}
      allowSkip
      guidance={opp ? t('Dans ta partie contre {opp}, au coup {n}, tu as joué {san}. Trouve mieux.', { opp, n: e.moveNo, san: e.playedSan }) : t('Dans ta partie, au coup {n}, tu as joué {san}. Trouve mieux.', { n: e.moveNo, san: e.playedSan })}
      sideTop={
        <div className="card lesson-progress-card">
          <div className="tc-label">{title}</div>
          <div className="status">{t('Position {i} / {total}', { i: index + 1, total: list.length })} · {tn(score, '{n} trouvée', '{n} trouvées')}
          </div>
          <div className="type-tags">
            {e.types
              .filter((t) => t !== 'positional')
              .map((t) => (
                <span key={t} className="evo-chip">
                  {WEAKNESSES[t].icon} {WEAKNESSES[t].title}
                </span>
              ))}
          </div>
          <button className="btn ghost" onClick={onExit}>{t("← Retour au suivi")}</button>
        </div>
      }
    />
  );
}

/* ---------------- Coups manques et pieges subis ---------------- */

function tallyBy<T>(list: T[], key: (x: T) => string | undefined) {
  const m = new Map<string, number>();
  for (const x of list) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function MissedCard({ analyses, onNavigate }: { analyses: GameAnalysis[]; onNavigate: (m: Mode) => void }) {
  const errors = analyses.flatMap((a) => a.errors);
  const missed = tallyBy(errors, (e) =>
    e.types.includes('missedMate') ? 'mate' : e.types.includes('missedTactic') && e.detail && MOTIF_NAME[e.detail] ? e.detail : undefined,
  );
  const fell = tallyBy(errors, (e) => (e.oppMotif && MOTIF_NAME[e.oppMotif] ? e.oppMotif : undefined));
  if (!missed.length && !fell.length) return null;
  const label = (k: string) => (k === 'mate' ? 'Mat' : MOTIF_NAME[k].charAt(0).toUpperCase() + MOTIF_NAME[k].slice(1));
  const theme: Record<string, string> = { fork: 'fork', pin: 'pin', skewer: 'skewer', discoveredAttack: 'discoveredAttack', doubleCheck: 'doubleCheck', mate: 'mateIn2', sacrifice: 'sacrifice', promotion: 'promotion' };
  return (
    <>
      <h3 className="coach-h">{t("Coups manqués et pièges subis")}</h3>
      <div className="stat-cols">
        <div className="card">
          <div className="tc-label">{t("Tu n’as pas vu…")}</div>
          {missed.length === 0 && <p className="muted small">{t("Aucune tactique manquée sur cette période.")}</p>}
          {missed.map(([k, n]) => (
            <div key={k} className="motif-line">
              <span>{label(k)}</span>
              <b>×{n}</b>
              <button
                className="btn small-btn"
                onClick={() => {
                  save('bettermove.puzzleTheme', theme[k] ?? '');
                  onNavigate('puzzles');
                }}
              >{t("🧩 S’entraîner")}</button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="tc-label">{t("L’adversaire t’a eu avec…")}</div>
          {fell.length === 0 && <p className="muted small">{t("Aucun piège tactique subi sur cette période.")}</p>}
          {fell.map(([k, n]) => (
            <div key={k} className="motif-line">
              <span>{label(k)}</span>
              <b>×{n}</b>
              <span className="muted small">{t('pense à vérifier les menaces de type « {motif} » avant de jouer', { motif: MOTIF_NAME[k] })}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- Ouvertures ---------------- */

function OpeningsCard({ analyses, onNavigate }: { analyses: GameAnalysis[]; onNavigate: (m: Mode) => void }) {
  const groups = new Map<string, { name: string; side: 'w' | 'b'; raw?: string; games: number; errors: number; losses: number }>();
  for (const a of analyses) {
    const name = openingFr(a.opening) ?? t('Hors théorie');
    const k = `${a.userColor}|${name}`;
    const g = groups.get(k) ?? { name, side: a.userColor, raw: a.opening, games: 0, errors: 0, losses: 0 };
    g.games++;
    g.errors += a.errors.filter((e) => e.types.includes('opening')).length;
    if (a.result === 'loss') g.losses++;
    groups.set(k, g);
  }
  const list = [...groups.values()].filter((g) => g.errors > 0).sort((a, b) => b.errors / b.games - a.errors / a.games || b.games - a.games).slice(0, 4);
  if (!list.length) return null;
  return (
    <>
      <h3 className="coach-h">{t("Ouvertures à travailler")}</h3>
      <div className="card openings-coach">
        {list.map((g) => {
          const lessons = lessonsForOpening(g.raw, g.side)
            .map((id) => ALL_LESSONS.find((l) => l.id === id))
            .filter((l) => !!l)
            .slice(0, 2);
          return (
            <div key={`${g.side}${g.name}`} className="opening-coach-row">
              <div>
                <strong>
                  <span className={`h-color ${g.side}`} /> {g.name}
                </strong>
                <span className="muted small">
                  {' '}{g.side === 'w' ? t('avec les Blancs') : t('avec les Noirs')} · {tn(g.games, '{n} partie', '{n} parties')} · {tn(g.errors, '{n} erreur d’ouverture', '{n} erreurs d’ouverture')} · {tn(g.losses, '{n} défaite', '{n} défaites')}
                </span>
              </div>
              <div className="gc-actions">
                {lessons.map((l) => (
                  <button
                    key={l!.id}
                    className="btn ghost small-btn"
                    onClick={() => {
                      openLessonNext(l!.id);
                      onNavigate('lessons');
                    }}
                  >
                    🎓 {l!.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
