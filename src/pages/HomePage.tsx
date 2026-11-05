// Accueil : salutation, probleme du jour (le meme pour tous), reprise rapide et anecdotes d'echecs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { dailyPuzzle, DAILY_TARGET, todayKey, type Puzzle } from '../puzzles/db';
import { PuzzleSolver } from '../puzzles/PuzzleSolver';
import { FACTS, TIPS, pickForDay } from '../home/facts';
import { load, save } from '../lib/storage';
import { levelFromXp } from '../rating/xp';
import type { PlayerProfile } from '../rating/profile';
import { getBot } from '../bots/roster';
import { orderedChapters, openLessonNext } from './LessonsPage';
import { buildReport, listAnalyses } from '../coach/report';
import { ACHIEVEMENTS } from '../achievements/list';
import { useShop, earn } from '../shop/store';
import { useSync } from '../sync/AccountModal';
import { apiCall } from '../sync/client';
import { BotPortrait } from '../bots/portraits';
import { MyAvatar } from '../profile/avatar';
import { DailyBoard, timeLabel, triesLabel } from '../home/DailyBoard';
import { daysUntil, srsStats } from '../review/store';
import { openRevisionsNext } from './PuzzlePage';
import { loadRush } from '../rush/store';
import { repSummary } from '../repertoire/store';
import { track } from '../achievements/events';
import { QuestsCard } from '../home/QuestsCard';
import { EventPromo } from '../home/EventPromo';

type Mode = 'bots' | 'lessons' | 'coach' | 'community' | 'puzzles' | 'achievements' | 'shop' | 'rush' | 'repertoire' | 'world' | 'teacher' | 'review' | 'events';

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
  if (h < 5) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
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
  const rush = useMemo(loadRush, []);
  const rep = useMemo(() => repSummary(), []);
  const shop = useShop();
  const today = todayKey();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyState>(() => load<DailyState>(DAILY_KEY, { days: {} }));
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [replay, setReplay] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const hints = useRef(0);
  const started = useRef(false);
  const done = daily.days[today];
  const online = sync.status !== 'offline' && sync.status !== 'checking';

  useEffect(() => {
    dailyPuzzle(today)
      .then(setPuzzle)
      .catch(() => setPuzzleError('Les problèmes ne sont pas disponibles pour le moment.'));
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
    if (!logged || !puzzle || done || started.current) return;
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
  }, [logged, puzzle, done]);
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
      earn(DAILY_COINS, 'Problème du jour réussi');
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
  const fact = pickForDay(FACTS, today, 7);
  const tip = pickForDay(TIPS, today, 13);
  const lv = levelFromXp(profile.xp);
  const weekday = new Date(`${today}T12:00:00`).getDay();
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

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
  const unlocked = Object.keys(load<Record<string, string>>('bettermove.achievements.v1', {})).length;

  return (
    <div className="home">
      <section className="card home-hero">
        <div className="home-hello">
          <h1>
            <MyAvatar size={52} />
            {greeting()}
            {sync.user ? ` ${sync.user}` : ''} 👋
          </h1>
          <p className="muted">
            {done?.solved
              ? 'Problème du jour réussi. Une partie, une leçon ? Tout est à portée de clic.'
              : 'Un nouveau problème t’attend aujourd’hui, le même pour tous les joueurs BetterMove.'}
          </p>
        </div>
        <div className="home-chips">
          <span className="home-chip">
            <b>Niv. {lv.level}</b>
            <i>
              <span style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            </i>
          </span>
          <span className="home-chip" title="Problèmes du jour réussis d’affilée">
            🔥 <b>{streak}</b> jour{streak > 1 ? 's' : ''}
          </span>
          <button className="home-chip" onClick={() => onNavigate('shop')}>
            🪙 <b>{shop.coins}</b>
          </button>
        </div>
      </section>

      <EventPromo onOpen={() => onNavigate('events')} />

      <QuestsCard
        hasAccount={!!sync.user}
        onGo={(page) => {
          if (page === 'home') document.querySelector('.home-daily')?.scrollIntoView({ behavior: 'smooth' });
          else onNavigate(page as Parameters<typeof onNavigate>[0]);
        }}
      />

      <section className="home-daily">
        <div className="card daily-head">
          <div>
            <div className="tc-label">🧩 Problème du jour · {dateLabel}</div>
            <strong className="daily-diff">
              Difficulté <span className="stars">{STARS[weekday]}</span> <small className="muted">(environ {DAILY_TARGET[weekday]} Elo)</small>
            </strong>
            <p className="muted small">
              Facile le lundi, coriace le dimanche. Réussi du premier coup : +{DAILY_COINS} 🪙 et +{DAILY_XP} XP.
            </p>
          </div>
          <div className="daily-stats">
            {stats && stats.players > 0 ? (
              <>
                <span>
                  <b>{stats.players}</b> joueur{stats.players > 1 ? 's l’ont' : ' l’a'} tenté
                </span>
                <span>
                  <b>{Math.round((stats.firstTry / stats.players) * 100)} %</b> du premier coup
                </span>
                {stats.medianSeconds !== null && (
                  <span>
                    temps médian <b>{stats.medianSeconds} s</b>
                  </span>
                )}
              </>
            ) : (
              <span className="muted small">{online ? 'Sois le premier à le résoudre aujourd’hui !' : 'Connecte-toi au serveur pour comparer ton résultat.'}</span>
            )}
          </div>
        </div>

        {done && !replay ? (
          <div className={`card daily-done ${done.solved && done.firstTry ? 'win' : ''}`}>
            <div className="big-check">{done.solved && done.firstTry ? '✅' : '💡'}</div>
            <div>
              <strong>
                {done.solved && done.firstTry
                  ? `Bravo, trouvé du premier coup${done.seconds ? ` en ${timeLabel(done.seconds)}` : ''} !`
                  : done.solved
                    ? `Résolu en ${triesLabel({ mistakes: done.mistakes ?? 1 })}${done.hints ? ` avec ${done.hints} indice${done.hints > 1 ? 's' : ''}` : ''}${done.seconds ? `, en ${timeLabel(done.seconds)}` : ''}.`
                    : 'Pas trouvé cette fois : tu as affiché la solution.'}
              </strong>
              <p className="muted small">Un nouveau problème arrive demain à minuit. Garde ta série 🔥 en revenant chaque jour.</p>
            </div>
            <div className="row">
              <button className="btn" onClick={() => setReplay(true)}>
                Revoir le problème
              </button>
              <button className="btn primary" onClick={() => onNavigate('puzzles')}>
                🧩 D’autres problèmes
              </button>
            </div>
          </div>
        ) : (
          <div className="daily-board">
            <PuzzleSolver
              puzzle={puzzle}
              error={puzzleError}
              allowSkip={false}
              onResult={() => undefined}
              onMistake={() => event('mistake')}
              onHint={() => {
                hints.current++;
                event('hint');
              }}
              onFinish={(f) => record(f.solved && !f.revealed, f.mistakes, hints.current, f.seconds)}
              onNext={() => setReplay(false)}
              nextLabel="Terminé"
            />
          </div>
        )}
        {online && (
          <div className="card daily-rank-card">
            <div className="tc-label">🏆 Classement du jour</div>
            <DailyBoard day={today} limit={10} refreshKey={boardKey} compact />
            {!sync.user && <p className="muted tiny">Connecte-toi pour apparaître dans le classement.</p>}
          </div>
        )}
      </section>

      <section className="home-grid">
        <button className="card home-card" onClick={() => onNavigate('bots')}>
          <span className="home-card-icon">
            <BotPortrait id={lastBot.id} size={48} />
          </span>
          <span className="tc-label">Jouer</span>
          <strong>Une partie contre {lastBot.name}</strong>
          <span className="muted small">
            {lastBot.rating} Elo · ton classement : {Math.round(profile.bots.rating)}
          </span>
        </button>
        {nextLesson && (
          <button
            className="card home-card"
            onClick={() => {
              openLessonNext(nextLesson.lesson.id);
              onNavigate('lessons');
            }}
          >
            <span className="home-card-icon">{nextLesson.lesson.icon}</span>
            <span className="tc-label">{nextLesson.started ? 'Améliorer' : 'Continuer'} · {nextLesson.chapter.title}</span>
            <strong>{nextLesson.lesson.title}</strong>
            <span className="muted small">{nextLesson.lesson.summary}</span>
          </button>
        )}
        <button className="card home-card" onClick={() => onNavigate('coach')}>
          <span className="home-card-icon">{priority ? priority.def.icon : '🎯'}</span>
          <span className="tc-label">Suivi personnalisé</span>
          <strong>{priority ? `Priorité : ${priority.def.title}` : 'Découvre tes points faibles'}</strong>
          <span className="muted small">
            {priority ? 'Des exercices tirés de tes propres parties.' : 'Joue ou importe quelques parties pour lancer l’analyse.'}
          </span>
        </button>
        <button className="card home-card" onClick={() => onNavigate('community')}>
          <span className="home-card-icon">💬</span>
          <span className="tc-label">Communauté</span>
          <strong>{socialBadge > 0 ? `${socialBadge} nouveauté${socialBadge > 1 ? 's' : ''} t’attend${socialBadge > 1 ? 'ent' : ''}` : 'Le salon des joueurs'}</strong>
          <span className="muted small">Discute, ajoute des amis et défie-les en 1v1.</span>
        </button>
      </section>

      <section className="home-grid three">
        <button
          className={`card home-card ${srs.due > 0 ? 'hot' : ''}`}
          onClick={() => {
            openRevisionsNext();
            onNavigate('puzzles');
          }}
        >
          <span className="home-card-icon">🧠</span>
          <span className="tc-label">Révisions</span>
          <strong>
            {srs.due > 0
              ? `${srs.due} position${srs.due > 1 ? 's' : ''} à revoir`
              : srs.total > 0
                ? 'À jour !'
                : 'Tes erreurs, à retravailler'}
          </strong>
          <span className="muted small">
            {srs.due > 0
              ? 'Tes erreurs reviennent au bon moment pour s’ancrer.'
              : srs.next
                ? `Prochaine révision ${daysUntil(srs.next) <= 1 ? 'demain' : `dans ${daysUntil(srs.next)} jours`}.`
                : 'Les problèmes ratés et les erreurs de tes parties arrivent ici.'}
          </span>
        </button>
        <button className="card home-card" onClick={() => onNavigate('rush')}>
          <span className="home-card-icon">⚡</span>
          <span className="tc-label">Puzzle Rush</span>
          <strong>{rush.best['3'] ? `Record 3 min : ${rush.best['3']}` : 'Bats ton record'}</strong>
          <span className="muted small">Un maximum de problèmes en 3 minutes, 3 erreurs et c’est fini.</span>
        </button>
        <button className={`card home-card ${rep.due > 0 && rep.total > 0 ? 'hot' : ''}`} onClick={() => onNavigate('repertoire')}>
          <span className="home-card-icon">📖</span>
          <span className="tc-label">Répertoire</span>
          <strong>
            {rep.total === 0 ? 'Choisis tes ouvertures' : rep.due > 0 ? `${rep.due} ligne${rep.due > 1 ? 's' : ''} à revoir` : 'Répertoire à jour'}
          </strong>
          <span className="muted small">
            {rep.total === 0 ? 'Apprends-les coup par coup, l’app joue l’adversaire.' : `${rep.learned}/${rep.total} lignes apprises.`}
          </span>
        </button>
      </section>

      <section className="home-grid two">
        <div className="card home-fact">
          <div className="tc-label">💡 Le saviez-vous ?</div>
          <p>{fact}</p>
        </div>
        <div className="card home-fact">
          <div className="tc-label">🎓 Conseil du jour</div>
          <p>{tip}</p>
        </div>
      </section>

      <section className="card home-stats">
        <button onClick={() => onNavigate('bots')}>
          <span className="tc-label">Elo bots</span>
          <b>{Math.round(profile.bots.rating)}</b>
        </button>
        <button onClick={() => onNavigate('puzzles')}>
          <span className="tc-label">Elo problèmes</span>
          <b>{Math.round(profile.puzzles.rating)}</b>
        </button>
        <button onClick={() => onNavigate('lessons')}>
          <span className="tc-label">Étoiles de cours</span>
          <b>{Object.values(profile.lessons).reduce((s, l) => s + l.stars, 0)}</b>
        </button>
        <button onClick={() => onNavigate('achievements')}>
          <span className="tc-label">Succès</span>
          <b>
            {unlocked}/{ACHIEVEMENTS.length}
          </b>
        </button>
      </section>
    </div>
  );
}
