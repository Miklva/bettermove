import { earn } from '../shop/store';
import { EARN } from '../shop/items';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { loadIndex, markSeen, nextPuzzle, puzzleByRef, type Puzzle } from '../puzzles/db';
import { navigate, pathOf, segmentsOf, useSegments } from '../router';
import { PuzzleSolver, type SolveResult } from '../puzzles/PuzzleSolver';
import { THEMES, THEME_FILTERS } from '../puzzles/themes';
import { isPuzzleProvisional, puzzleGames, type PlayerProfile } from '../rating/profile';
import { PROVISIONAL_HELP, signed, stakes } from '../rating/elo';
import { load, save } from '../lib/storage';
import {
  addFailedPuzzle,
  daysUntil,
  nextMistake,
  recordMistakeAttempt,
  srsStats,
  SRS_DAYS,
  SRS_MAX,
  type MistakeCard,
} from '../review/store';
import { track } from '../achievements/events';
import { isAdmin } from '../sync/client';

// Ouverture directe en mode Revisions (depuis l'accueil)
let pendingSource: 'mistakes' | null = null;
export function openRevisionsNext() {
  pendingSource = 'mistakes';
}

const whenText = (day: string | null) => {
  if (!day) return '';
  const n = daysUntil(day);
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`;
};

interface Props {
  notify: (msg: string) => void;
  player: PlayerProfile;
}

type Difficulty = 'easier' | 'normal' | 'harder';
const OFFSET: Record<Difficulty, number> = { easier: -250, normal: 0, harder: 250 };

/** Bonus de rapidite : plus tu trouves vite, plus tu gagnes d'Elo */
function speedFactor(seconds: number): number {
  if (seconds <= 10) return 1.3;
  if (seconds <= 30) return 1.15;
  if (seconds <= 60) return 1;
  if (seconds <= 120) return 0.85;
  return 0.7;
}

export function PuzzlePage({ notify, player }: Props) {
  const { profile, recordPuzzle } = player;
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<{ delta: number; factor: number; usedHint: boolean } | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => load('bettermove.puzzleDifficulty', 'normal'));
  const [theme, setTheme] = useState<string>(() => load('bettermove.puzzleTheme', ''));
  const [available, setAvailable] = useState<{ total: number; themes: string[] } | null>(null);
  const [showImport, setShowImport] = useState(false);
  /** Source des problemes : la base, ou les erreurs de tes propres parties */
  const [source, setSource] = useState<'db' | 'mistakes'>(() => {
    const s = pendingSource ?? (segmentsOf(window.location.pathname)[2] === 'revisions' ? 'mistakes' : 'db');
    pendingSource = null;
    return s;
  });
  const [srs, setSrs] = useState(srsStats);
  const [early, setEarly] = useState(false);
  const [lastBox, setLastBox] = useState<{ box: number | null; due: string | null } | null>(null);

  const rating = Math.round(profile.puzzles.rating);

  useEffect(() => {
    loadIndex()
      .then((idx) => setAvailable({ total: idx.total, themes: idx.themes }))
      .catch(() => setAvailable({ total: 0, themes: [] }));
  }, []);

  const start = useCallback(
    async (targetTheme = theme, diff = difficulty, src = source, ahead = early) => {
      setPuzzle(null);
      setError(null);
      setRecorded(null);
      setLastBox(null);
      const st = srsStats();
      setSrs(st);
      if (src === 'mistakes') {
        const card = nextMistake(puzzle?.id, ahead);
        if (card) setPuzzle(card);
        else if (st.total === 0)
          setError(
            'Aucune position à réviser. Les erreurs de tes parties analysées et les problèmes ratés arrivent ici automatiquement.',
          );
        else
          setError(
            `Rien à réviser aujourd’hui 🎉 Prochaine révision ${whenText(st.next)}. Tu peux aussi réviser en avance (sans faire monter les cartes).`,
          );
        return;
      }
      try {
        const p = await nextPuzzle(Math.round(profile.puzzles.rating) + OFFSET[diff], targetTheme || undefined);
        markSeen(p.id);
        setPuzzle(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, difficulty, profile.puzzles.rating, source, puzzle?.id],
  );

  // Liens : /apprendre/problemes/revisions, /apprendre/problemes/<tranche-fichier-id> (probleme precis)
  const seg = useSegments()[2];
  const openRef = useCallback(async (ref: string) => {
    setPuzzle(null);
    setError(null);
    setRecorded(null);
    setLastBox(null);
    try {
      setPuzzle(await puzzleByRef(ref));
    } catch (e) {
      setError(e instanceof Error ? `${e.message[0].toUpperCase()}${e.message.slice(1)}` : 'Erreur de chargement');
    }
  }, []);
  useEffect(() => {
    if (source === 'db' && seg && seg !== 'revisions') void openRef(seg);
    else start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // URL -> etat (bouton Precedent, lien colle pendant que la page est ouverte)
  const firstSeg = useRef(true);
  useEffect(() => {
    if (firstSeg.current) {
      firstSeg.current = false;
      return;
    }
    if (seg === 'revisions' && source !== 'mistakes') {
      setSource('mistakes');
      start(theme, difficulty, 'mistakes');
    } else if (seg && seg !== 'revisions' && seg !== puzzle?.ref) {
      setSource('db');
      void openRef(seg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg]);
  // Etat -> URL
  useEffect(() => {
    const target = source === 'mistakes' ? 'revisions' : puzzle?.ref;
    if (target && segmentsOf(window.location.pathname)[2] !== target) navigate(pathOf(['apprendre', 'problemes', target]), true);
  }, [source, puzzle?.ref]);

  const onResult = (r: SolveResult) => {
    if (!puzzle || source === 'mistakes') return;
    // Indice utilise : reussite sans aucun point. Solution affichee : compte comme un echec.
    const outcome = r.win ? (r.usedHint ? 'assisted' : 'win') : 'fail';
    const factor = outcome === 'win' ? speedFactor(r.seconds) : 1;
    const { before, after } = recordPuzzle(puzzle, outcome, factor, r.seconds);
    if (outcome === 'win') {
      earn(EARN.puzzle, 'Problème réussi', true);
      track('puzzle-win');
    }
    // Probleme rate : il rejoindra les revisions
    if (outcome === 'fail') {
      const n = addFailedPuzzle(puzzle, `Problème raté (${puzzle.rating} Elo)`);
      if (n) notify('Problème ajouté à tes révisions');
      setSrs(srsStats());
    }
    setRecorded({ delta: Math.round(after) - Math.round(before), factor, usedHint: r.usedHint });
  };

  const history = profile.puzzleHistory.slice(0, 12);

  const ratingCard = (
    <div className="card puzzle-rating">
      <div>
        <div className="tc-label">Classement problèmes</div>
        <div className="big-rating">
          {rating}
          {isPuzzleProvisional(profile) && <span title={PROVISIONAL_HELP}>?</span>}
          {recorded && (
            <em className={recorded.delta >= 0 ? 'up' : 'down'}>
              {recorded.delta >= 0 ? '+' : ''}
              {recorded.delta}
            </em>
          )}
        </div>
      </div>
      <div className="streak" title="Série en cours">
        <span>🔥 {profile.puzzleStats.streak}</span>
        <small className="muted">record {profile.puzzleStats.bestStreak}</small>
      </div>
      {puzzle && !recorded && source === 'db' && (() => {
        const st = stakes(profile.puzzles.rating, puzzle.rating, puzzleGames(profile));
        return (
          <div className="stakes full" title="Elo en jeu sur ce problème. Résolu en moins de 30 s : bonus de rapidité ; avec un indice : 0 point.">
            <span className="muted">Ce problème ({puzzle.rating})</span>
            <span className="up">Réussi {signed(st.win)}</span>
            <span className="down">Raté {signed(st.loss)}</span>
          </div>
        );
      })()}
      {isPuzzleProvisional(profile) && (
        <p className="muted tiny provisional-note">
          ? : classement provisoire, définitif après 5 problèmes ({5 - puzzleGames(profile)} restant{5 - puzzleGames(profile) > 1 ? 's' : ''}). D’ici là, les gains et
          pertes sont plus forts.
        </p>
      )}
      {history.length > 0 && (
        <div className="history-dots">
          {[...history].reverse().map((h, i) => (
            <span
              key={i}
              className={h.assisted ? 'assisted' : h.win ? 'win' : 'loss'}
              title={h.assisted ? `${h.rating} Elo · avec indice, 0 point` : `${h.rating} Elo · ${h.delta >= 0 ? '+' : ''}${h.delta}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  const sourceChips = (
    <>
      <span className="label">Source</span>
      <div className="chips">
        <button
          className={`chip ${source === 'db' ? 'selected' : ''}`}
          onClick={() => {
            setSource('db');
            start(theme, difficulty, 'db');
          }}
        >
          Base de problèmes
        </button>
        <button
          className={`chip ${source === 'mistakes' ? 'selected' : ''}`}
          onClick={() => {
            setSource('mistakes');
            start(theme, difficulty, 'mistakes');
          }}
        >
          🧠 Révisions{srs.due > 0 ? ` (${srs.due} à revoir)` : ''}
        </button>
      </div>
      {source === 'mistakes' && srs.total > 0 && (
        <button
          className={`chip ${early ? 'selected' : ''}`}
          onClick={() => {
            setEarly(!early);
            start(theme, difficulty, 'mistakes', !early);
          }}
          title="Revoir toutes les cartes, même celles prévues plus tard"
        >
          {early ? '✓ ' : ''}Réviser en avance
        </button>
      )}
    </>
  );

  const mistakeCard =
    source === 'mistakes' && puzzle ? (
      <div className="card lesson-progress-card srs-card">
        <div className="tc-label">
          🧠 Révisions · {srs.due} à revoir aujourd’hui · {srs.total} au total
        </div>
        <div className="status">{(puzzle as MistakeCard).origin ?? 'Une de tes parties'}</div>
        <div className="srs-boxes" title="Niveau de mémorisation">
          {Array.from({ length: SRS_MAX }, (_, i) => {
            const box = lastBox ? (lastBox.box ?? SRS_MAX) : ((puzzle as MistakeCard).box ?? 0);
            return <i key={i} className={i < box ? 'on' : ''} />;
          })}
          <span className="muted tiny">
            {lastBox
              ? lastBox.box === null
                ? 'Mémorisée ! Elle sort de tes révisions.'
                : lastBox.box === 0
                  ? 'Ratée : elle revient demain.'
                  : `Réussie : prochaine révision ${whenText(lastBox.due)}.`
              : `Mémorisation ${(puzzle as MistakeCard).box ?? 0}/${SRS_MAX}`}
          </span>
        </div>
        <p className="muted small">
          Trouvée du premier coup, la position revient de plus en plus tard ({SRS_DAYS.map((d) => `J+${d}`).join(', ')}). Ratée, elle
          revient demain. Pas d’Elo en jeu.
          {srs.mastered > 0 && ` ${srs.mastered} position${srs.mastered > 1 ? 's' : ''} mémorisée${srs.mastered > 1 ? 's' : ''} pour de bon.`}
        </p>
      </div>
    ) : null;

  const options = (
    <div className="card puzzle-options">
      {sourceChips}
      {source === 'db' && (
        <>
      <span className="label">Difficulté</span>
      <div className="chips">
        {(
          [
            ['easier', 'Plus facile'],
            ['normal', 'Normale'],
            ['harder', 'Plus dur'],
          ] as [Difficulty, string][]
        ).map(([d, label]) => (
          <button
            key={d}
            className={`chip ${difficulty === d ? 'selected' : ''}`}
            onClick={() => {
              setDifficulty(d);
              save('bettermove.puzzleDifficulty', d);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {available && available.themes.length > 0 && (
        <>
          <span className="label">Thème</span>
          <select
            className="select"
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value);
              save('bettermove.puzzleTheme', e.target.value);
              start(e.target.value, difficulty);
            }}
          >
            <option value="">Tous les thèmes</option>
            {THEME_FILTERS.filter((t) => available.themes.includes(t)).map((t) => (
              <option key={t} value={t}>
                {THEMES[t]?.label ?? t}
              </option>
            ))}
          </select>
        </>
      )}
        </>
      )}
      {available && source === 'db' && (
        <p className="muted small db-info">
          {available.total.toLocaleString('fr-FR')} problèmes disponibles.{' '}
          {/* Import de la base : manipulation serveur, reservee a l'administrateur */}
          {isAdmin() && (
            <button className="link inline" onClick={() => setShowImport(true)}>
              {available.total > 100000 ? 'Mettre à jour la base' : 'Importer la base complète (6 millions)'}
            </button>
          )}
        </p>
      )}
    </div>
  );

  const meta = !recorded ? null : recorded.usedHint ? (
    <>· indice utilisé, pas de points</>
  ) : recorded.factor !== 1 ? (
    <>
      · {recorded.factor > 1 ? 'bonus rapidité' : 'résolu lentement'} ×{recorded.factor.toFixed(2)}
    </>
  ) : null;

  return (
    <>
      <PuzzleSolver
        puzzle={puzzle}
        error={error}
        onResult={onResult}
        onFinish={(f) => {
          if (source === 'mistakes' && puzzle) {
            setLastBox(recordMistakeAttempt(puzzle.id, f.solved && f.firstTry && !f.usedHint));
            setSrs(srsStats());
          }
        }}
        onNext={() => start()}
        sideTop={source === 'mistakes' ? mistakeCard : ratingCard}
        sideBottom={options}
        doneMeta={meta}
        onRetryLoad={() => {
          setTheme('');
          start('', difficulty);
        }}
      />

      {showImport && (
        <Modal title="Importer la base Lichess" onClose={() => setShowImport(false)}>
          <ol className="steps">
            <li>
              Télécharge{' '}
              <a href="https://database.lichess.org/lichess_db_puzzle.csv.zst" target="_blank" rel="noreferrer">
                lichess_db_puzzle.csv.zst
              </a>{' '}
              (environ 270 Mo, licence CC0).
            </li>
            <li>
              Dans le dossier du projet, lance :
              <pre>npm run puzzles:import -- chemin/vers/lichess_db_puzzle.csv.zst</pre>
            </li>
            <li>Recharge la page : plus de 6 millions de problèmes, avec les thèmes officiels de Lichess.</li>
          </ol>
          <p className="muted small">
            La base complète pèse environ 600 Mo une fois découpée. Pour une version plus légère, ajoute{' '}
            <code>--max-per-band 20000</code> (environ 1 million de problèmes).
          </p>
          <button
            className="btn ghost wide"
            onClick={() => {
              navigator.clipboard?.writeText('npm run puzzles:import -- lichess_db_puzzle.csv.zst');
              notify('Commande copiée');
            }}
          >
            Copier la commande
          </button>
        </Modal>
      )}
    </>
  );
}
