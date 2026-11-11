// "Problemes sur ce cours" : 5 paliers de problemes du theme de la lecon, de plus en plus durs.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Chapter, Lesson } from './courses';
import { completeTier, lessonTheme, masteryOf, PASS, PER_TIER, TIER_NAMES, tierTarget, TIERS, useMastery } from './mastery';
import { markSeen, nextPuzzle, type Puzzle } from '../puzzles/db';
import { PuzzleSolver, type SolveFinish, type SolveResult } from '../puzzles/PuzzleSolver';
import { THEMES } from '../puzzles/themes';
import type { PlayerProfile } from '../rating/profile';
import { earn } from '../shop/store';
import { sounds } from '../lib/sounds';
import { t } from '../i18n';

/** Recompenses d'un palier valide pour la premiere fois */
const tierXp = (tier: number) => 15 + tier * 10;
const tierCoins = (tier: number) => tier * 5;

/** Couronne / paliers sous forme de petits crans (carte du parcours, fin de lecon) */
export function MasteryPips({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`mastery-pips ${value >= TIERS ? 'crowned' : ''} ${className}`} title={t('Maîtrise : {n}/{max} paliers', { n: value, max: TIERS })}>
      {value >= TIERS ? (
        <b>👑</b>
      ) : (
        Array.from({ length: TIERS }, (_, i) => <i key={i} className={i < value ? 'on' : ''} />)
      )}
    </span>
  );
}

interface Props {
  chapter: Chapter;
  lesson: Lesson;
  player: PlayerProfile;
  onExit: () => void;
}

type Mark = 'ok' | 'ko';

export function MasteryRun({ lesson, player, onExit }: Props) {
  const theme = lessonTheme(lesson);
  const all = useMastery();
  const reached = all[lesson.id] ?? 0;
  const [tier, setTier] = useState(() => Math.min(TIERS, masteryOf(lesson.id) + 1));
  const [marks, setMarks] = useState<Mark[]>([]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ passed: boolean; ok: number; first: boolean } | null>(null);
  const finished = useRef<Mark | null>(null);
  // Elo vise fige au debut du palier (le classement bouge pendant la serie)
  const target = useRef(tierTarget(tier, player.profile.puzzles.rating));

  useEffect(() => {
    document.body.classList.add('in-lesson');
    return () => document.body.classList.remove('in-lesson');
  }, []);

  const load = async () => {
    setPuzzle(null);
    setError(null);
    if (!theme) return setError(t('Pas de problème disponible pour ce thème.'));
    try {
      const p = await nextPuzzle(target.current, theme);
      markSeen(p.id);
      setPuzzle(p);
    } catch {
      setError(t('Pas de problème disponible pour ce thème.'));
    }
  };

  const startTier = (n: number) => {
    target.current = tierTarget(n, player.profile.puzzles.rating);
    setTier(n);
    setMarks([]);
    setResult(null);
    finished.current = null;
    void load();
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResult = (r: SolveResult) => {
    if (puzzle) player.recordPuzzle(puzzle, r.win ? (r.usedHint ? 'assisted' : 'win') : 'fail', 1, r.seconds);
  };
  const onFinish = (f: SolveFinish) => {
    finished.current = f.solved && f.firstTry && !f.usedHint ? 'ok' : 'ko';
  };
  const next = () => {
    const m = [...marks, finished.current ?? 'ko'];
    finished.current = null;
    setMarks(m);
    if (m.length < PER_TIER) return void load();
    const ok = m.filter((x) => x === 'ok').length;
    const passed = ok >= PASS;
    const first = passed && masteryOf(lesson.id) < tier;
    if (passed) {
      completeTier(lesson.id, tier);
      if (first) {
        player.grantXp(tierXp(tier));
        earn(tierCoins(tier), t('Maîtrise : {title}, palier {n}', { title: lesson.title, n: tier }));
      }
      sounds.gameEnd();
    }
    setResult({ passed, ok, first });
  };

  const header = (
    <div className="lesson-header">
      <button className="icon-btn" onClick={onExit} title={t('Retour au parcours')} aria-label={t('Quitter')}>
        ✕
      </button>
      <div className="lesson-title">
        <span>🎯</span> {t('Problèmes sur ce cours')} · {lesson.title}
      </div>
      <MasteryPips value={reached} />
    </div>
  );

  if (result) {
    const crowned = result.passed && tier >= TIERS;
    return (
      <div className="lesson-solo">
        {header}
        <div className="card lesson-result mastery-result">
          <div className="mastery-big">{crowned ? '👑' : result.passed ? '🎯' : '💪'}</div>
          <h2>
            {crowned
              ? t('Leçon maîtrisée !')
              : result.passed
                ? t('Palier {n} validé : {name}', { n: tier, name: t(TIER_NAMES[tier - 1]) })
                : t('Pas encore : {ok}/{total}', { ok: result.ok, total: PER_TIER })}
          </h2>
          <p className="muted">
            {result.passed
              ? t('{ok}/{total} réussis du premier coup.', { ok: result.ok, total: PER_TIER })
              : t('Il faut {need} problèmes sur {total} réussis du premier coup, sans indice. Les problèmes changent à chaque essai.', { need: PASS, total: PER_TIER })}
          </p>
          {result.first && (
            <div className="xp-gain">
              +{tierXp(tier)} {t('XP')} · +{tierCoins(tier)} 🪙
            </div>
          )}
          <MasteryPips value={masteryOf(lesson.id)} className="big" />
          <div className="row">
            {result.passed && tier < TIERS && (
              <button className="btn primary" onClick={() => startTier(tier + 1)}>
                {t('Palier suivant : {name}', { name: t(TIER_NAMES[tier]) })}
              </button>
            )}
            {!result.passed && (
              <button className="btn primary" onClick={() => startTier(tier)}>
                {t('Réessayer le palier')}
              </button>
            )}
            {crowned && (
              <button className="btn" onClick={() => startTier(TIERS)}>
                {t('Encore des problèmes')}
              </button>
            )}
          </div>
          <button className="btn ghost wide" onClick={onExit}>
            {t('Retour au parcours')}
          </button>
        </div>
      </div>
    );
  }

  const info = theme ? THEMES[theme] : null;
  const side: ReactNode = (
    <div className="card lesson-progress-card mastery-card">
      <div className="tc-label">
        {t('Palier {n}/{max}', { n: tier, max: TIERS })} · {t(TIER_NAMES[tier - 1])}
      </div>
      <div className="status">
        {t('Problème {n}/{total}', { n: Math.min(marks.length + 1, PER_TIER), total: PER_TIER })}
        <span className="muted small"> · ~{target.current} {t('Elo')}</span>
      </div>
      <div className="mastery-marks">
        {Array.from({ length: PER_TIER }, (_, i) => (
          <span key={i} className={marks[i] ?? (i === marks.length ? 'current' : '')}>
            {marks[i] === 'ok' ? '✓' : marks[i] === 'ko' ? '✗' : ''}
          </span>
        ))}
      </div>
      <p className="muted small">{t('Objectif : {need}/{total} du premier coup, sans indice.', { need: PASS, total: PER_TIER })}</p>
      {info?.tip && <p className="muted small">💡 {info.tip}</p>}
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
        nextLabel={marks.length + 1 >= PER_TIER ? t('Voir le résultat') : t('Problème suivant')}
        allowSkip={false}
        sideTop={side}
        talk
        onRetryLoad={onExit}
      />
    </>
  );
}
