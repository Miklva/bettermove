import { useMemo, useState } from 'react';
import { ACHIEVEMENTS, CATEGORIES, TIER_XP, type Category, type Ctx } from '../achievements/list';
import { progressOf, type Unlocked } from '../achievements/store';
import type { EndReason, GameFact } from '../achievements/facts';
import { openingFr } from '../history/names';
import { useRouteSync } from '../router';

interface Props {
  ctx: Ctx;
  unlocked: Unlocked;
}

const TIER_NAME = { 1: 'Bronze', 2: 'Argent', 3: 'Or' } as const;

const REASON_LABEL: Partial<Record<EndReason, string>> = {
  mate: 'Mat',
  time: 'Temps',
  resign: 'Abandon',
  stalemate: 'Pat',
  repetition: 'Répétition',
  fifty: '50 coups',
  insufficient: 'Matériel insuffisant',
  agreement: 'Accord',
};

const PIECE_LABEL: Record<string, string> = {
  p: 'Pion',
  n: 'Cavalier',
  b: 'Fou',
  r: 'Tour',
  q: 'Dame',
  k: 'Roi',
  castle: 'Roque',
};

function tally<T extends string>(list: GameFact[], key: (g: GameFact) => T | undefined) {
  const out = new Map<T, number>();
  for (const g of list) {
    const k = key(g);
    if (k) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

export function AchievementsPage({ ctx, unlocked }: Props) {
  const [cat, setCat] = useState<Category | 'all'>('all');
  useRouteSync<Category | 'all'>(2, cat, setCat, (c) => (c === 'all' ? 'tous' : c), (s) => (s === 'tous' ? 'all' : CATEGORIES.find((c) => c.id === s)?.id));
  // Filtre d'etat, cumulable avec la categorie
  const [status, setStatus] = useState<'all' | 'done' | 'todo'>('all');

  const rows = useMemo(
    () => ACHIEVEMENTS.map((a) => ({ a, p: progressOf(a, ctx), at: unlocked[a.id] })),
    [ctx, unlocked],
  );
  const done = rows.filter((r) => r.at);
  const xp = done.reduce((s, r) => s + TIER_XP[r.a.tier], 0);
  const recent = [...done].sort((x, y) => (y.at! > x.at! ? 1 : -1)).slice(0, 4);
  const shown = rows
    .filter((r) => cat === 'all' || r.a.cat === cat)
    .filter((r) => status === 'all' || (status === 'done' ? !!r.at : !r.at))
    // Bronze puis Argent puis Or ; a rang egal, debloques d'abord puis les plus avances
    .sort(
      (x, y) =>
        x.a.tier - y.a.tier ||
        Number(!!y.at) - Number(!!x.at) ||
        y.p.value / y.p.target - x.p.value / x.p.target,
    );

  const g = ctx.games;
  const wins = g.filter((x) => x.result === 'win');
  const losses = g.filter((x) => x.result === 'loss');
  const winHow = tally(wins, (x) => REASON_LABEL[x.reason]);
  const lossHow = tally(losses, (x) => REASON_LABEL[x.reason]);
  const mateBy = tally(wins, (x) => (x.mate ? PIECE_LABEL[x.mate.piece] : undefined));
  const fav = tally([...g, ...ctx.local], (x) => openingFr(x.opening)).slice(0, 4);

  return (
    <div className="ach-page">
      <div className="card ach-hero">
        <div className="ach-trophy">🏆</div>
        <div className="ach-hero-main">
          <div className="tc-label">Succès</div>
          <h2>
            {done.length} <small className="muted">/ {ACHIEVEMENTS.length} débloqués</small>
          </h2>
          <div className="xp-bar">
            <span style={{ width: `${(done.length / ACHIEVEMENTS.length) * 100}%` }} />
          </div>
          <p className="muted small">
            {xp} XP gagnés grâce aux succès · Bronze {TIER_XP[1]} XP, Argent {TIER_XP[2]} XP, Or {TIER_XP[3]} XP
          </p>
        </div>
        {recent.length > 0 && (
          <div className="ach-recent">
            <span className="tc-label">Derniers</span>
            <div>
              {recent.map((r) => (
                <span key={r.a.id} className={`ach-mini t${r.a.tier}`} title={r.a.title}>
                  {r.a.icon}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card ach-stats">
        <Stat title="Victoires" total={wins.length} items={winHow} />
        <Stat title="Défaites" total={losses.length} items={lossHow} />
        <Stat title="Mats donnés avec" total={mateBy.reduce((s, x) => s + x[1], 0)} items={mateBy} />
        <Stat title="Ouvertures favorites" total={null} items={fav} />
      </div>

      <div className="ach-tabs">
        <button
          className={`chip status-chip ${status === 'all' ? 'selected' : ''}`}
          onClick={() => {
            setStatus('all');
            setCat('all');
          }}
          title="Afficher tous les succès"
        >
          Tout <small className="muted">{ACHIEVEMENTS.length}</small>
        </button>
        {(
          [
            ['done', '✔ Obtenus'],
            ['todo', '○ Non obtenus'],
          ] as const
        ).map(([k, label]) => {
          const pool = rows.filter((r) => cat === 'all' || r.a.cat === cat);
          const n = pool.filter((r) => (k === 'done' ? !!r.at : !r.at)).length;
          return (
            <button
              key={k}
              className={`chip status-chip ${status === k ? 'selected' : ''}`}
              onClick={() => setStatus(k)}
            >
              {label} <small className="muted">{n}</small>
            </button>
          );
        })}
        <span className="ach-sep" />
        {CATEGORIES.map((c) => {
          const list = rows.filter((r) => r.a.cat === c.id);
          return (
            <button
              key={c.id}
              className={`chip ${cat === c.id ? 'selected' : ''}`}
              onClick={() => setCat(cat === c.id ? 'all' : c.id)}
              title={cat === c.id ? 'Clique à nouveau pour voir toutes les sections' : undefined}
            >
              {c.icon} {c.label}{' '}
              <small className="muted">
                {list.filter((r) => r.at).length}/{list.length}
              </small>
            </button>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="muted center">
          {status === 'done' ? 'Aucun succès obtenu ici pour l’instant. À toi de jouer !' : 'Tout est débloqué ici, bravo !'}
        </p>
      )}
      <div className="ach-grid">
        {shown.map(({ a, p, at }) => {
          const hidden = a.secret && !at;
          return (
            <div key={a.id} className={`ach-card t${a.tier} ${at ? 'done' : 'locked'}`}>
              <div className="ach-icon">{hidden ? '❓' : a.icon}</div>
              <div className="ach-body">
                <div className="ach-title">
                  <strong>{hidden ? 'Succès secret' : a.title}</strong>
                  <span className={`ach-tier t${a.tier}`}>{TIER_NAME[a.tier]}</span>
                </div>
                <p className="muted small">{hidden ? 'Continue à jouer pour le découvrir…' : a.desc}</p>
                {at ? (
                  <span className="ach-date small">✔ Débloqué le {new Date(at).toLocaleDateString('fr-FR')}</span>
                ) : (
                  !hidden &&
                  p.target > 1 && (
                    <div className="ach-progress">
                      <div className="bar">
                        <span style={{ width: `${(p.value / p.target) * 100}%` }} />
                      </div>
                      <small className="muted">
                        {p.value}/{p.target}
                      </small>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ title, total, items }: { title: string; total: number | null; items: [string, number][] }) {
  return (
    <div className="ach-stat">
      <div className="tc-label">
        {title}
        {total !== null && <b> {total}</b>}
      </div>
      {items.length === 0 ? (
        <p className="muted small">Pas encore de données</p>
      ) : (
        <ul>
          {items.slice(0, 4).map(([k, n]) => (
            <li key={k}>
              <span>{k}</span>
              <b>{n}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
