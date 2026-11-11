import { useCallback, useEffect, useMemo, useState } from 'react';
import { advancedUnlocked, CHAPTERS as ALL_CHAPTERS, type Chapter, type Lesson } from '../lessons/courses';
import { wantsInitiation } from '../onboarding/level';
import { earn } from '../shop/store';
import { EARN } from '../shop/items';
import type { Profile } from '../rating/profile';

const CHAPTERS = ALL_CHAPTERS;
/** Initiation en tete pour les debutants, en fin de parcours pour les autres */
export function orderedChapters(p: Profile): Chapter[] {
  if (wantsInitiation(p)) return ALL_CHAPTERS;
  return [...ALL_CHAPTERS.filter((c) => c.id !== 'initiation'), ...ALL_CHAPTERS.filter((c) => c.id === 'initiation')];
}
import { ChoiceStep, CollectStep, GoalStep, PuzzleSetStep, QuizStep, TheoryStep, type StepOutcome } from '../lessons/steps';
import { levelFromXp, XP } from '../rating/xp';
import type { PlayerProfile } from '../rating/profile';
import { sounds } from '../lib/sounds';
import { useRouteSync } from '../router';
import { track } from '../achievements/events';
import { load, save } from '../lib/storage';

import { t, tn } from '../i18n';
interface Props {
  player: PlayerProfile;
}

const starsFor = (errors: number) => (errors === 0 ? 3 : errors <= 2 ? 2 : 1);

/** Lecon a ouvrir directement (lien depuis le suivi personnalise) */
let pendingLesson: string | null = null;
export function openLessonNext(id: string) {
  pendingLesson = id;
}

function findLesson(id: string): { chapter: Chapter; lesson: Lesson } | null {
  for (const chapter of CHAPTERS) {
    const lesson = [...chapter.lessons, ...(chapter.advanced ?? [])].find((l) => l.id === id);
    if (lesson) return { chapter, lesson };
  }
  return null;
}

export function LessonsPage({ player }: Props) {
  const [active, setActive] = useState<{ chapter: Chapter; lesson: Lesson } | null>(() => {
    const id = pendingLesson;
    pendingLesson = null;
    return id ? findLesson(id) : null;
  });
  // Lien direct vers une lecon : /apprendre/cours/<id>
  useRouteSync(2, active, setActive, (a) => a?.lesson.id ?? null, (s) => findLesson(s) ?? undefined, true, { value: null });

  if (active)
    return (
      <LessonPlayer
        key={active.lesson.id}
        chapter={active.chapter}
        lesson={active.lesson}
        player={player}
        onExit={() => setActive(null)}
        onNext={(next) => setActive(next)}
      />
    );

  return <CourseMap player={player} onOpen={(chapter, lesson) => setActive({ chapter, lesson })} />;
}

/* ---------------- Carte du parcours ---------------- */

function CourseMap({ player, onOpen }: { player: PlayerProfile; onOpen: (c: Chapter, l: Lesson) => void }) {
  const { profile } = player;
  const CHAPTERS = orderedChapters(profile);
  const lv = levelFromXp(profile.xp);
  const totalStars = Object.values(profile.lessons).reduce((s, l) => s + l.stars, 0);
  const visible = (c: Chapter) =>
    c.advanced && advancedUnlocked(c, profile.lessons) ? [...c.lessons, ...c.advanced] : c.lessons;
  // Total de toutes les etoiles, approfondissements compris (meme compte que le profil)
  const maxStars = CHAPTERS.reduce((s, c) => s + (c.lessons.length + (c.advanced?.length ?? 0)) * 3, 0);
  // Page affichee par chapitre : 0 = leçons de base, 1 = approfondissement
  const [page, setPage] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const c of CHAPTERS)
      if (c.advanced && advancedUnlocked(c, profile.lessons) && c.advanced.some((l) => profile.lessons[l.id])) o[c.id] = 1;
    return o;
  });
  // Chapitres replies par le joueur (choix garde d'une visite a l'autre)
  const [folded, setFolded] = useState<Record<string, boolean>>(() => load(FOLD_KEY, {}));
  const setFold = (id: string, v: boolean) =>
    setFolded((o) => {
      const n = { ...o };
      if (v) n[id] = true;
      else delete n[id];
      save(FOLD_KEY, n);
      return n;
    });

  // Prochaine lecon a faire sur tout le parcours (base d'abord, puis approfondissement)
  const target = useMemo(() => {
    for (const c of CHAPTERS) {
      const firstTodo = (list: Lesson[]) => list.find((l, i) => !profile.lessons[l.id] && (i === 0 || !!profile.lessons[list[i - 1].id]));
      const base = firstTodo(c.lessons);
      if (base) return { chapter: c.id, lesson: base.id, page: 0 };
      if (c.advanced && advancedUnlocked(c, profile.lessons)) {
        const adv = firstTodo(c.advanced);
        if (adv) return { chapter: c.id, lesson: adv.id, page: 1 };
      }
    }
    return null;
  }, [CHAPTERS, profile.lessons]);
  const nextDir = useNextDirection(target, folded, page);
  // Cote garde pendant la disparition (pas de saut haut/bas en s'effacant)
  const [arrowSide, setArrowSide] = useState<'up' | 'down'>('down');
  useEffect(() => {
    if (nextDir) setArrowSide(nextDir);
  }, [nextDir]);
  const goNext = () => {
    if (!target) return;
    const wasHidden = !!folded[target.chapter] || (page[target.chapter] ?? 0) !== target.page;
    if (folded[target.chapter]) setFold(target.chapter, false);
    if ((page[target.chapter] ?? 0) !== target.page) setPage((o) => ({ ...o, [target.chapter]: target.page }));
    // On laisse le chapitre se deplier / la page glisser avant de faire defiler
    window.setTimeout(() => {
      document.querySelector(`[data-lesson="${target.lesson}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, wasHidden ? 420 : 0);
  };

  const renderPath = (ch: Chapter, list: Lesson[], firstUnlocked: boolean, level2 = false) => (
    <div className={`path ${level2 ? 'path-adv' : ''}`}>
      {list.map((l, i) => {
        const stars = profile.lessons[l.id]?.stars ?? 0;
        const unlocked = i === 0 ? firstUnlocked : !!profile.lessons[list[i - 1].id];
        const isNext = unlocked && !stars;
        return (
          <div key={l.id} data-lesson={l.id} className={`path-node ${i % 2 ? 'right' : 'left'}`}>
            <button
              className={`node ${level2 ? 'adv' : ''} ${stars ? 'done' : ''} ${isNext ? 'next' : ''} ${unlocked ? '' : 'locked'}`}
              disabled={!unlocked}
              onClick={() => onOpen(ch, l)}
              title={unlocked ? l.summary : t("Termine la leçon précédente")}
            >
              <span className="node-icon">{unlocked ? l.icon : '🔒'}</span>
            </button>
            <div className="node-info">
              <strong>{l.title}</strong>
              <span className="muted small">{l.summary}</span>
              <span className="node-stars">
                {[1, 2, 3].map((n) => (
                  <i key={n} className={n <= stars ? 'on' : ''}>
                    ★
                  </i>
                ))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="course-map">
      <div className="card course-hero">
        <div className="level-badge">
          <span>{t("Niv.")}</span>
          <strong>{lv.level}</strong>
        </div>
        <div className="course-hero-main">
          <div className="tc-label">{t("Ta progression")}</div>
          <div className="xp-bar">
            <span style={{ width: `${Math.round(lv.progress * 100)}%` }} />
          </div>
          <p className="muted small">
            {t('{into} / {needed} XP avant le niveau {next} · {total} XP au total', { into: lv.into, needed: lv.needed, next: lv.level + 1, total: profile.xp })}</p>
        </div>
        <div className="course-stars">
          ⭐ {totalStars}
          <small className="muted">/ {maxStars}</small>
        </div>
      </div>

      {CHAPTERS.map((ch) => {
        const adv = ch.advanced ?? [];
        const unlockedAdv = adv.length > 0 && advancedUnlocked(ch, profile.lessons);
        const shown = visible(ch);
        const stars = shown.reduce((n, l) => n + (profile.lessons[l.id]?.stars ?? 0), 0);
        const threeStars = ch.lessons.filter((l) => (profile.lessons[l.id]?.stars ?? 0) >= 3).length;
        const pg = unlockedAdv ? (page[ch.id] ?? 0) : 0;
        const go = (n: number) => setPage((o) => ({ ...o, [ch.id]: n }));
        const isFolded = !!folded[ch.id];
        return (
          <section
            key={ch.id}
            data-chapter={ch.id}
            className={`chapter ${isFolded ? 'folded' : ''}`}
            data-tour={`chapter-${ch.id}`}
            style={{ '--chapter': ch.color } as React.CSSProperties}
          >
            <header className="chapter-head">
              <button
                className="fold-btn"
                onClick={() => setFold(ch.id, !isFolded)}
                aria-expanded={!isFolded}
                aria-controls={`chapter-body-${ch.id}`}
                title={isFolded ? t('Déplier le chapitre') : t('Replier le chapitre')}
                aria-label={isFolded ? t('Déplier le chapitre') : t('Replier le chapitre')}
              >
                <span aria-hidden>▾</span>
              </button>
              <span className="chapter-icon">{ch.icon}</span>
              <div>
                <h2>
                  {ch.title}
                  {pg === 1 && <span className="adv-tag">{t("Niv. 2")}</span>}
                </h2>
                <p className="muted small">{ch.description}</p>
              </div>
              <span className="chapter-count" title={t("Étoiles obtenues sur les leçons débloquées")}>
                ★ {stars}/{shown.length * 3}
              </span>
              {adv.length > 0 && (
                <div className="page-nav">
                  <button
                    className="page-btn"
                    disabled={pg === 0}
                    onClick={() => go(0)}
                    title={t("Leçons de base")}
                    aria-label={t("Page précédente")}
                  >
                    ‹
                  </button>
                  <button
                    className={`page-btn ${unlockedAdv && pg === 0 ? 'ready' : ''}`}
                    disabled={!unlockedAdv || pg === 1}
                    onClick={() => go(1)}
                    title={
                      unlockedAdv
                        ? t('{n} leçons d’approfondissement', { n: adv.length })
                        : t('3 étoiles sur chaque leçon pour débloquer la suite ({done}/{total})', { done: threeStars, total: ch.lessons.length })
                    }
                    aria-label={t("Page suivante")}
                  >
                    {unlockedAdv ? '›' : '🔒'}
                  </button>
                </div>
              )}
            </header>
            <div className="chapter-body" id={`chapter-body-${ch.id}`} inert={isFolded}>
            <div className="pages">
              <div className="pages-track" style={{ transform: `translateX(-${pg * 100}%)` }}>
                <div className={`page ${pg === 0 ? 'active' : ''}`} aria-hidden={pg !== 0}>
                  {renderPath(ch, ch.lessons, true)}
                  {adv.length > 0 && !unlockedAdv && (
                    <p className="adv-hint muted small">{t('🔒 Suite : {n} leçons de plus avec 3 étoiles partout ({done}/{total}).', { n: adv.length, done: threeStars, total: ch.lessons.length })}
                    </p>
                  )}
                </div>
                {unlockedAdv && (
                  <div className={`page ${pg === 1 ? 'active' : ''}`} aria-hidden={pg !== 1}>
                    {renderPath(ch, adv, true, true)}
                  </div>
                )}
              </div>
            </div>
            </div>
          </section>
        );
      })}
      {target && (
        <button
          className={`next-lesson-arrow ${arrowSide} ${nextDir ? 'show' : ''}`}
          aria-hidden={!nextDir}
          tabIndex={nextDir ? 0 : -1}
          onClick={goNext}
          title={t('Aller à la prochaine leçon')}
        >
          <span className="nla-icon" aria-hidden>
            {arrowSide === 'up' ? '↑' : '↓'}
          </span>
          {t('Prochaine leçon')}
        </button>
      )}
    </div>
  );
}

const FOLD_KEY = 'bettermove.lessonsFolded.v1';

/** Sens de la fleche vers la prochaine lecon, ou null si elle est deja visible a l'ecran */
function useNextDirection(
  target: { chapter: string; lesson: string; page: number } | null,
  folded: Record<string, boolean>,
  page: Record<string, number>,
): 'up' | 'down' | null {
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const measure = useCallback(() => {
    if (!target) return setDir(null);
    const hidden = !!folded[target.chapter] || (page[target.chapter] ?? 0) !== target.page;
    // Lecon cachee (chapitre replie ou autre page) : on vise le chapitre
    const el = hidden
      ? document.querySelector(`[data-chapter="${target.chapter}"]`)
      : document.querySelector(`[data-lesson="${target.lesson}"]`);
    if (!el) return setDir(null);
    const r = el.getBoundingClientRect();
    // Bas de l'en-tete reel (plus haut sur mobile : deux lignes)
    const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 56;
    document.documentElement.style.setProperty('--nla-top', `${Math.round(top) + 12}px`);
    if (r.bottom < top + 8) setDir('up');
    else if (r.top > window.innerHeight - 8) setDir('down');
    else setDir(hidden ? 'down' : null);
  }, [target, folded, page]);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    on();
    // Apres les animations (depliage, glissement de page)
    const late = window.setTimeout(on, 500);
    window.addEventListener('scroll', on, { capture: true, passive: true });
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      window.removeEventListener('scroll', on, { capture: true });
      window.removeEventListener('resize', on);
    };
  }, [measure]);
  return dir;
}

/* ---------------- Deroulement d'une lecon ---------------- */

interface PlayerProps {
  chapter: Chapter;
  lesson: Lesson;
  player: PlayerProfile;
  onExit: () => void;
  onNext: (next: { chapter: Chapter; lesson: Lesson }) => void;
}

function LessonPlayer({ chapter, lesson, player, onExit, onNext }: PlayerProps) {
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [xp, setXp] = useState(0);
  const [result, setResult] = useState<{ stars: number; xp: number; levelUp: boolean; coins: number } | null>(null);

  const step = lesson.steps[index];

  // Telephone : lecon en plein ecran (sans barres du site), tout tient sans defiler
  useEffect(() => {
    document.body.classList.add('in-lesson');
    return () => document.body.classList.remove('in-lesson');
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [index, result]);

  const done = (o: StepOutcome) => {
    const e = errors + o.errors;
    const x = xp + o.xp;
    setErrors(e);
    setXp(x);
    if (index + 1 < lesson.steps.length) {
      setIndex(index + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    // Fin de lecon
    const stars = starsFor(e);
    const total = x + stars * XP.lessonStar;
    const before = levelFromXp(player.profile.xp).level;
    const after = levelFromXp(player.profile.xp + total).level;
    // Pieces : 5 par nouvelle etoile, plus un bonus la premiere fois
    const prevStars = player.profile.lessons[lesson.id]?.stars ?? 0;
    const coins = Math.max(0, stars - prevStars) * EARN.lessonStar + (prevStars === 0 ? EARN.lessonFirst : 0);
    player.completeLesson(lesson.id, stars, total);
    track('lesson-done');
    if (coins) earn(coins, t('Leçon : {title}', { title: lesson.title }));
    setResult({ stars, xp: total, levelUp: after > before, coins });
    sounds.gameEnd();
  };

  const nextLesson = (() => {
    const CHAPTERS = orderedChapters(player.profile);
    const lessons = player.profile.lessons;
    const seq = (c: Chapter) => [...c.lessons, ...(c.advanced && advancedUnlocked(c, lessons) ? c.advanced : [])];
    const cur = seq(chapter);
    const i = cur.indexOf(lesson);
    if (i >= 0 && i + 1 < cur.length) return { chapter, lesson: cur[i + 1] };
    const ci = CHAPTERS.indexOf(chapter);
    if (ci + 1 < CHAPTERS.length) return { chapter: CHAPTERS[ci + 1], lesson: CHAPTERS[ci + 1].lessons[0] };
    return null;
  })();

  const header = (
    <div className="lesson-header">
      <button className="icon-btn" onClick={onExit} title={t("Quitter la leçon")} aria-label={t("Quitter")}>
        ✕
      </button>
      <div className="lesson-title">
        <span>{lesson.icon}</span> {lesson.title}
      </div>
      <div className="lesson-progress">
        {lesson.steps.map((_, i) => (
          <span key={i} className={i < index || result ? 'done' : i === index ? 'current' : ''} />
        ))}
      </div>
    </div>
  );

  if (result) {
    const lv = levelFromXp(player.profile.xp);
    return (
      <div className="lesson-solo">
        {header}
        <div className="card lesson-result">
          <div className="big-stars">
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= result.stars ? 'on' : ''} style={{ animationDelay: `${n * 0.15}s` }}>
                ★
              </span>
            ))}
          </div>
          <h2>{result.stars === 3 ? t("Parfait !") : result.stars === 2 ? t("Bien joué !") : t("Leçon terminée")}</h2>
          <p className="muted">
            {errors === 0 ? t("Aucune erreur.") : tn(errors, '{n} erreur.', '{n} erreurs.')}{' '}
            {result.stars < 3 && t("Refais la leçon pour décrocher 3 étoiles.")}
          </p>
          <div className="xp-gain">
            +{result.xp}{" "}{t("XP")}{result.coins ? ` · +${result.coins} 🪙` : ''}
          </div>
          {result.levelUp && <div className="unlock">{t('🎉 Niveau {n} atteint !', { n: lv.level })}</div>}
          <div className="xp-bar">
            <span style={{ width: `${Math.round(lv.progress * 100)}%` }} />
          </div>
          <p className="muted small">{t('Niveau {n} · {into} / {needed} XP', { n: lv.level, into: lv.into, needed: lv.needed })}</p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setIndex(0);
                setErrors(0);
                setXp(0);
                setResult(null);
              }}
            >{t("Recommencer")}</button>
            {nextLesson ? (
              <button className="btn primary" onClick={() => onNext(nextLesson)}>{t("Leçon suivante")}</button>
            ) : (
              <button className="btn primary" onClick={onExit}>{t("Retour au parcours")}</button>
            )}
          </div>
          <button className="btn ghost wide" onClick={onExit}>{t("Retour au parcours")}</button>
        </div>
      </div>
    );
  }

  const key = `${lesson.id}-${index}`;
  switch (step.type) {
    case 'theory':
      return <TheoryStep key={key} step={step} onDone={done} header={header} />;
    case 'quiz':
      return <QuizStep key={key} step={step} onDone={done} header={header} />;
    case 'puzzles':
      return <PuzzleSetStep key={key} step={step} onDone={done} header={header} player={player} />;
    case 'goal':
      return <GoalStep key={key} step={step} onDone={done} header={header} />;
    case 'collect':
      return <CollectStep key={key} step={step} onDone={done} header={header} />;
    case 'choice':
      return <ChoiceStep key={key} step={step} onDone={done} header={header} />;
  }
}
