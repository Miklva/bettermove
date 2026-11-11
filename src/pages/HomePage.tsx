// Accueil : salutation, probleme du jour (le meme pour tous), reprise rapide et anecdotes d'echecs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { dailyPuzzle, DAILY_TARGET, todayKey, type Puzzle } from '../puzzles/db';
import { PuzzleSolver } from '../puzzles/PuzzleSolver';
import { TIPS, pickForDay } from '../home/facts';
import { load, save } from '../lib/storage';
import { levelFromXp } from '../rating/xp';
import type { PlayerProfile } from '../rating/profile';
import { getBot } from '../bots/roster';
import { orderedChapters, openLessonNext } from './LessonsPage';
import { buildReport, listAnalyses } from '../coach/report';
import { earn } from '../shop/store';
import { useSync } from '../sync/AccountModal';
import { apiCall } from '../sync/client';
import { BotPortrait } from '../bots/portraits';
import { DailyBoard, timeLabel, triesLabel } from '../home/DailyBoard';
import { srsStats } from '../review/store';
import { openRevisionsNext } from './PuzzlePage';
import { repSummary } from '../repertoire/store';
import { track } from '../achievements/events';
import { QuestsCard } from '../home/QuestsCard';
import { EventPromo } from '../home/EventPromo';

import { locale, t, tn } from '../i18n';
type Mode = 'bots' | 'lessons' | 'coach' | 'community' | 'puzzles' | 'achievements' | 'shop' | 'rush' | 'repertoire' | 'world' | 'teacher' | 'review' | 'events' | 'levels' | 'local';

interface Props {
  player: PlayerProfile;
  onNavigate: (m: Mode) => void;
  socialBadge: number;
}

const DAILY_KEY = 'bettermove.daily.v1';
const DAILY_COINS = 10;
const DAILY_XP = 15;

interface DailyState {
  /** Resultat par jour */
  days: Record<string, { solved: boolean; firstTry: boolean; seconds?: number; mistakes?: number; hints?: number }>;
}

interface DailyStats {
  players: number;
  solved: number;
  firstTry: number;
  medianSeconds: number | null;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Europe/Paris' }).format(new Date()));
  if (h < 5) return t('Bonne nuit');
  if (h < 12) return t('Bonjour');
  if (h < 18) return t('Bon après-midi');
  return t('Bonsoir');
}

/** Jours consecutifs avec le probleme du jour reussi (jusqu'a aujourd'hui ou hier) */
function streakOf(days: DailyState['days'], today: string) {
  let n = 0;
  const d = new Date(`${today}T12:00:00`);
  if (!days[today]?.solved) d.setDate(d.getDate() - 1);
  for (;;) {
    const k = todayKey(d);
    if (!days[k]?.solved) return n;
    n++;
    d.setDate(d.getDate() - 1);
  }
}

const STARS = ['★★★★★', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★☆☆', '★★★★☆', '★★★★☆'];

export function HomePage({ player, onNavigate, socialBadge }: Props) {
  const { profile } = player;
  const sync = useSync();
  const srs = useMemo(srsStats, []);
  const rep = useMemo(() => repSummary(), []);
  const today = todayKey();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyState>(() => load<DailyState>(DAILY_KEY, { days: {} }));
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [replay, setReplay] = useState(false);
  // Probleme du jour replie : l'echiquier ne s'affiche (et le chrono ne demarre) qu'a l'ouverture
  const [dailyOpen, setDailyOpen] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const hints = useRef(0);
  const started = useRef(false);
  const done = daily.days[today];
  const online = sync.status !== 'offline' && sync.status !== 'checking';

  useEffect(() => {
    dailyPuzzle(today)
      .then(setPuzzle)
      .catch(() => setPuzzleError(t('Les problèmes ne sont pas disponibles pour le moment.')));
  }, [today]);

  const refreshStats = () => {
    if (!online) return;
    apiCall<DailyStats>(`/daily/${today}`)
      .then(setStats)
      .catch(() => setStats(null));
  };
  useEffect(refreshStats, [online, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tentative du jour : le chrono demarre cote serveur (recharger la page ne le remet pas a zero)
  const logged = online && !!sync.user;
  useEffect(() => {
    if (!logged || !puzzle || done || !dailyOpen || started.current) return;
    started.current = true;
    apiCall<{ done: boolean; solved: boolean; mistakes: number; hints: number; seconds: number | null }>(`/daily/${today}/start`, {
      method: 'POST',
      body: JSON.stringify({ puzzleId: puzzle.id }),
    })
      .then((r) => {
        // Deja fait sur un autre appareil : on affiche le resultat
        if (r.done) {
          const next = {
            days: {
              ...daily.days,
              [today]: { solved: r.solved, firstTry: r.solved && r.mistakes + r.hints === 0, seconds: r.seconds ?? 0, mistakes: r.mistakes, hints: r.hints },
            },
          };
          setDaily(next);
          save(DAILY_KEY, next);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged, puzzle, done, dailyOpen]);
  const event = (type: 'mistake' | 'hint') => {
    if (!logged || done) return;
    apiCall(`/daily/${today}/event`, { method: 'POST', body: JSON.stringify({ type }) }).catch(() => undefined);
  };

  const record = (solved: boolean, mistakes: number, hints: number, seconds: number) => {
    if (daily.days[today]) return;
    const firstTry = solved && mistakes === 0 && hints === 0;
    const next = { days: { ...daily.days, [today]: { solved, firstTry, seconds, mistakes, hints } } };
    setDaily(next);
    save(DAILY_KEY, next);
    if (solved) track('daily-puzzle');
    if (solved && firstTry) {
      earn(DAILY_COINS, t('Problème du jour réussi'));
      player.grantXp(DAILY_XP);
    }
    if (online && sync.user && puzzle)
      apiCall<{ result: { seconds: number; mistakes: number; hints: number } | null }>(`/daily/${today}`, {
        method: 'POST',
        body: JSON.stringify({ puzzleId: puzzle.id, solved, firstTry, seconds, mistakes, hints }),
      })
        .then((r) => {
          // Le temps officiel est celui mesure par le serveur
          if (r.result) {
            const { seconds: sec, mistakes: m, hints: h } = r.result;
            const fixed = {
              days: { ...next.days, [today]: { solved, firstTry: solved && m + h === 0, seconds: sec, mistakes: m, hints: h } },
            };
            setDaily(fixed);
            save(DAILY_KEY, fixed);
          }
          refreshStats();
          setBoardKey((k) => k + 1);
        })
        .catch(() => undefined);
  };

  const streak = streakOf(daily.days, today);
  const lv = levelFromXp(profile.xp);
  const weekday = new Date(`${today}T12:00:00`).getDay();
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  // Reprise rapide : prochaine lecon, dernier bot, priorite du suivi
  const nextLesson = useMemo(() => {
    for (const ch of orderedChapters(profile)) {
      const l = ch.lessons.find((x) => (profile.lessons[x.id]?.stars ?? 0) < 3);
      if (l) return { chapter: ch, lesson: l, started: !!profile.lessons[l.id] };
    }
    return null;
  }, [profile]);
  const lastBot = getBot(load('bettermove.lastBot', 'pip'));
  const priority = useMemo(() => {
    const r = buildReport(Object.values(listAnalyses()), []);
    return r.stats.find((s) => s.trend !== 'resolved' && s.def.id !== 'positional') ?? null;
  }, []);
  // 3e raccourci : ce qui attend le plus le joueur
  const third: { icon: string; label: string; title: string; text: string; hot?: boolean; go: () => void } =
    srs.due > 0
      ? {
          icon: '🧠',
          label: t('Révisions'),
          title: tn(srs.due, '{n} position à revoir', '{n} positions à revoir'),
          text: t('Tes erreurs reviennent au bon moment pour s’ancrer.'),
          hot: true,
          go: () => {
            openRevisionsNext();
            onNavigate('puzzles');
          },
        }
      : rep.total > 0 && rep.due > 0
        ? {
            icon: '📖',
            label: t('Répertoire'),
            title: tn(rep.due, '{n} ligne à revoir', '{n} lignes à revoir'),
            text: t('{a}/{b} lignes apprises.', { a: rep.learned, b: rep.total }),
            hot: true,
            go: () => onNavigate('repertoire'),
          }
        : socialBadge > 0
          ? {
              icon: '💬',
              label: t('Communauté'),
              title: tn(socialBadge, '{n} nouveauté t’attend', '{n} nouveautés t’attendent'),
              text: t('Messages, demandes d’amis ou défis.'),
              hot: true,
              go: () => onNavigate('community'),
            }
          : {
              icon: priority ? priority.def.icon : '🎯',
              label: t('Suivi personnalisé'),
              title: priority ? t('Priorité : {name}', { name: t(priority.def.title) }) : t('Découvre tes points faibles'),
              text: priority ? t('Des exercices tirés de tes propres parties.') : t('Joue quelques parties pour lancer l’analyse.'),
              go: () => onNavigate('coach'),
            };

  return (
    <div className="home home-v2">
      <section className="home-top">
        <div className="home-hello">
          <h1>
            {greeting()}
            {sync.user ? `, ${sync.user}` : ''}
          </h1>
          <p className="muted">{t(pickForDay(TIPS, today, 13))}</p>
        </div>
        <div className="home-stats-row">
          <button className="home-stat" onClick={() => onNavigate('bots')} title={t("Ton Elo contre les bots")}>
            <span>{t("Elo bots")}</span>
            <b>{Math.round(profile.bots.rating)}</b>
          </button>
          <button className="home-stat" onClick={() => onNavigate('puzzles')} title={t("Ton Elo en problèmes")}>
            <span>{t("Elo problèmes")}</span>
            <b>{Math.round(profile.puzzles.rating)}</b>
          </button>
          <button className="home-stat" onClick={() => onNavigate('levels')} title={t("Récompenses de niveau")}>
            <span>{t("Niv. {n}", { n: lv.level })}</span>
            <i>
              <span style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            </i>
          </button>
          <span className="home-stat" title={t("Problèmes du jour réussis d’affilée")}>
            <span>{t("Série")}</span>
            <b>🔥 {streak}</b>
          </span>
        </div>
      </section>

      <EventPromo onOpen={() => onNavigate('events')} />

      <section className="home-board" data-tour="home-next">
        <div className="card home-play">
          <h2>{t("Jouer une partie")}</h2>
          <div className="home-play-bot">
            <BotPortrait id={lastBot.id} size={72} />
            <div>
              <strong>{lastBot.name}</strong>
              <span className="muted">
                {t(lastBot.style)} · {lastBot.rating} {t("Elo")}
              </span>
            </div>
          </div>
          <div className="home-play-actions">
            <button className="btn primary big" onClick={() => onNavigate('bots')}>
              {t("Une partie contre {name}", { name: lastBot.name })}
            </button>
            <button className="btn" onClick={() => onNavigate('world')}>{t("🌍 Contre le monde")}</button>
            <button className="btn" onClick={() => onNavigate('local')}>{t("👥 1v1 sur cet écran")}</button>
          </div>
        </div>

        <div className="card home-daily-card">
          <h2>{t("Problème du jour")}</h2>
          <p className="muted small home-daily-date">{dateLabel}</p>
          <strong className="daily-diff">
            {t("Difficulté")} <span className="stars">{STARS[weekday]}</span>{' '}
            <small className="muted">{t("(environ {elo} Elo)", { elo: DAILY_TARGET[weekday] })}</small>
          </strong>
          <p className="muted small">
            {t("Le même pour tous les joueurs. Réussi du premier coup : +{coins} 🪙 et +{xp} XP.", { coins: DAILY_COINS, xp: DAILY_XP })}
            {stats && stats.players > 0 && (
              <>
                {' '}
                {tn(stats.players, "{n} joueur l’a tenté, {pct} % du premier coup.", "{n} joueurs l’ont tenté, {pct} % du premier coup.", { pct: Math.round((stats.firstTry / stats.players) * 100) })}
              </>
            )}
          </p>
          {done && !replay ? (
            <>
              <span className={`daily-badge ${done.solved && done.firstTry ? 'win' : ''}`}>
                {done.solved && done.firstTry
                  ? done.seconds
                    ? t('✅ Trouvé en {time}', { time: timeLabel(done.seconds) })
                    : t('✅ Trouvé')
                  : done.solved
                    ? t('✔ Résolu en {tries}', { tries: triesLabel({ mistakes: done.mistakes ?? 1 }) })
                    : t("💡 Solution affichée")}
              </span>
              <div className="row daily-after">
                <button className="btn" onClick={() => setReplay(true)}>{t("Revoir le problème")}</button>
                <button className="btn ghost" onClick={() => onNavigate('puzzles')}>{t("🧩 D’autres problèmes")}</button>
              </div>
            </>
          ) : (
            !dailyOpen && (
              <button className="btn primary big" onClick={() => setDailyOpen(true)}>{t("Résoudre")}</button>
            )
          )}
        </div>

        {(dailyOpen || replay) && !(done && !replay) && (
          <section className="home-daily home-span">
            <div className="daily-board">
              <PuzzleSolver
                puzzle={puzzle}
                error={puzzleError}
                allowSkip={false}
                talk
                onResult={() => undefined}
                onMistake={() => event('mistake')}
                onHint={() => {
                  hints.current++;
                  event('hint');
                }}
                onFinish={(f) => record(f.solved && !f.revealed, f.mistakes, hints.current, f.seconds)}
                onNext={() => setReplay(false)}
                nextLabel={t("Terminé")}
              />
            </div>
          </section>
        )}
        {online && (done || dailyOpen) && (
          <div className="card daily-rank-card home-span">
            <div className="tc-label">{t("🏆 Classement du jour")}</div>
            <DailyBoard day={today} limit={10} refreshKey={boardKey} compact />
            {!sync.user && <p className="muted tiny">{t("Connecte-toi pour apparaître dans le classement.")}</p>}
          </div>
        )}

        <div className="home-quests">
          <QuestsCard
            hasAccount={!!sync.user}
            onGo={(page) => {
              if (page === 'home') {
                setDailyOpen(true);
                document.querySelector('.home-daily-card')?.scrollIntoView({ behavior: 'smooth' });
              } else onNavigate(page as Parameters<typeof onNavigate>[0]);
            }}
          />
        </div>

        {nextLesson ? (
          <button
            className="card home-card main"
            onClick={() => {
              openLessonNext(nextLesson.lesson.id);
              onNavigate('lessons');
            }}
          >
            <span className="tc-label">{nextLesson.started ? t("Améliorer") : t("Ta prochaine leçon")}</span>
            <span className="muted small">{nextLesson.chapter.title}</span>
            <strong className="home-card-title">
              <span aria-hidden>{nextLesson.lesson.icon}</span> {nextLesson.lesson.title}
            </strong>
            <span className="muted small">{nextLesson.lesson.summary}</span>
          </button>
        ) : (
          <button className="card home-card" onClick={() => onNavigate('lessons')}>
            <span className="tc-label">{t("Cours")}</span>
            <strong className="home-card-title">{t("Tous les cours sont finis à 3 étoiles !")}</strong>
          </button>
        )}

        <button className={`card home-card ${third.hot ? 'hot' : ''}`} onClick={third.go}>
          <span className="tc-label">{third.label}</span>
          <strong className="home-card-title">
            <span aria-hidden>{third.icon}</span> {third.title}
          </strong>
          <span className="muted small">{third.text}</span>
        </button>
      </section>
    </div>
  );
}
