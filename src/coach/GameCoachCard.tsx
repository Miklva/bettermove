// Bilan personnalise d'une partie (affiche dans la review) : erreurs rangees par famille,
// liens avec les points faibles recurrents du suivi, exercices, problemes et lecons conseilles.
import { useMemo } from 'react';
import type { GameAnalysis, WeakId } from './analyze';
import { buildReport, listAnalyses, WEAKNESSES } from './report';
import { lessonsForOpening } from './openings';
import { ALL_LESSONS } from '../lessons/courses';
import { THEMES } from '../puzzles/themes';
import { openingFr } from '../history/names';
import { save } from '../lib/storage';
import { openLessonNext } from '../pages/LessonsPage';

import { t, tmap, tn } from '../i18n';
export type NavTarget = 'puzzles' | 'lessons' | 'coach' | 'repertoire';

export const MOTIF_NAME: Record<string, string> = tmap({
  fork: 'fourchette',
  pin: 'clouage',
  skewer: 'enfilade',
  discoveredAttack: 'attaque à la découverte',
  doubleCheck: 'échec double',
  sacrifice: 'sacrifice',
  promotion: 'promotion',
});

interface Props {
  analysis: GameAnalysis;
  opening: string | null;
  trainCount: number;
  onTrain: () => void;
  onNavigate: (t: NavTarget) => void;
}

export function GameCoachCard({ analysis, opening, trainCount, onTrain, onNavigate }: Props) {
  const report = useMemo(() => buildReport(Object.values(listAnalyses()), []), [analysis]); // eslint-disable-line react-hooks/exhaustive-deps
  const errors = analysis.errors;

  // Familles presentes dans cette partie
  const families = useMemo(() => {
    const m = new Map<WeakId, number>();
    for (const e of errors) for (const t of e.types) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].filter(([id]) => id !== 'positional' || m.size === 1).sort((a, b) => b[1] - a[1]);
  }, [errors]);

  const ranked = report.stats.filter((s) => s.trend !== 'resolved' && s.def.id !== 'positional');
  // Le classement n'a de sens qu'avec un peu d'historique
  const rankOf = (id: WeakId) => (report.games >= 3 ? ranked.findIndex((s) => s.def.id === id) : -1);
  const gamesWith = (id: WeakId) =>
    Object.values(listAnalyses()).filter((a) => a.errors.some((e) => e.types.includes(id))).length;

  const missed = errors.filter((e) => e.types.includes('missedMate') || (e.types.includes('missedTactic') && e.detail));
  const fellFor = errors.filter((e) => e.oppMotif);
  const main = families[0]?.[0];
  const mainDef = main ? WEAKNESSES[main] : null;
  const lessonIds = [...(mainDef?.lessons.slice(0, 1) ?? []), ...lessonsForOpening(opening ?? undefined, analysis.userColor).slice(0, 2)];
  const lessons = [...new Set(lessonIds)].map((id) => ALL_LESSONS.find((l) => l.id === id)).filter((l) => !!l);

  const goLesson = (id: string) => {
    openLessonNext(id);
    onNavigate('lessons');
  };
  const goTheme = (t: string) => {
    save('bettermove.puzzleTheme', t);
    onNavigate('puzzles');
  };

  return (
    <div className="card game-coach">
      <div className="tc-label">{t("🎯 Bilan personnalisé")}</div>
      {errors.length === 0 ? (
        <p className="muted">{t("Aucune erreur importante dans cette partie : rien à retravailler. Ton suivi est mis à jour.")}</p>
      ) : (
        <>
          <div className="gc-families">
            {families.map(([id, n]) => {
              const r = rankOf(id);
              const g = gamesWith(id);
              return (
                <div key={id} className="gc-family">
                  <span>
                    {WEAKNESSES[id].icon} {WEAKNESSES[id].title} <b>×{n}</b>
                  </span>
                  <span className={`small ${r >= 0 && r < 3 ? 'gc-recurring' : 'muted'}`}>
                    {r >= 0 && r < 3
                      ? t('Point faible n°{n} de ton suivi', { n: r + 1 })
                      : g > 1
                        ? tn(g - 1, 'Déjà vu dans {n} autre partie', 'Déjà vu dans {n} autres parties')
                        : t("Nouveau dans tes parties")}
                  </span>
                </div>
              );
            })}
          </div>

          {(missed.length > 0 || fellFor.length > 0) && (
            <div className="gc-missed small">
              {missed.map((e) => (
                <span key={e.id}>{t("Coup")}{" "}{e.moveNo} : {e.types.includes('missedMate') ? t("mat manqué") : t('{motif} manquée', { motif: MOTIF_NAME[e.detail!] ?? t('tactique') })} ({e.bestSan})
                </span>
              ))}
              {fellFor.map((e) => (
                <span key={`f${e.id}`} className="muted">{t('Coup {n} : {san} permettait une tactique adverse ({motif})', { n: e.moveNo, san: e.playedSan, motif: MOTIF_NAME[e.oppMotif!] ?? t('tactique') })}</span>
              ))}
            </div>
          )}

          {mainDef && <p className="gc-tip">💡 {mainDef.tips[0]}</p>}

          {trainCount > 0 && (
            <button className="btn primary wide" onClick={onTrain}>{t('🏋️ Retravailler mes positions ({n})', { n: trainCount })}
            </button>
          )}
          <div className="gc-actions">
            {mainDef?.themes.slice(0, 2).map((t) => (
              <button key={t} className="btn small-btn" onClick={() => goTheme(t)}>
                🧩 {THEMES[t]?.label ?? t}
              </button>
            ))}
          </div>
        </>
      )}

      {lessons.length > 0 && (
        <div className="gc-lessons">
          <span className="small muted">
            {opening ? `Ouverture : ${openingFr(opening)}. ` : ''}{t("Leçons conseillées :")}</span>
          <div className="gc-actions">
            {lessons.map((l) => (
              <button key={l!.id} className="btn ghost small-btn" onClick={() => goLesson(l!.id)}>
                🎓 {l!.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="btn ghost wide" onClick={() => onNavigate('coach')}>{t("📈 Voir mon suivi personnalisé")}</button>
    </div>
  );
}
