// Detail d'une statistique du profil : periode au choix, repartition sur 100 % et graphe
import { useMemo, useRef, useState } from 'react';
import type { ProfileData } from './stats';
import type { Res, Timeline } from './timeline';
import { ACHIEVEMENTS } from '../achievements/list';
import { CHAPTERS } from '../lessons/courses';

import { locale, t, tmap } from '../i18n';
export const PERIODS = [
  ['1j', '1 jour'],
  ['1s', '1 semaine'],
  ['1m', '1 mois'],
  ['1a', '1 an'],
  ['3a', '3 ans'],
  ['tout', 'Depuis le début'],
] as const;
export type Period = (typeof PERIODS)[number][0];

export const STATS = tmap({
  'en-ligne': { icon: '🌍', title: 'Elo en ligne' },
  bots: { icon: '🤖', title: 'Elo contre les bots' },
  problemes: { icon: '🧩', title: 'Elo problèmes' },
  parties: { icon: '♟️', title: 'Parties enregistrées' },
  rush: { icon: '⚡', title: 'Puzzle Rush' },
  'probleme-du-jour': { icon: '📅', title: 'Problème du jour' },
  cours: { icon: '📚', title: 'Cours' },
  succes: { icon: '🏆', title: 'Succès' },
} as const);
export type StatId = keyof typeof STATS;

const DAY = 86400_000;
const HOUR = 3600_000;

interface Bucket {
  t0: number;
  t1: number;
  label: string;
  long: string;
}

const fmt = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString(locale(), o);
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const startOfMonth = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
};
const addMonths = (t: number, n: number) => {
  const d = new Date(t);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
};

function dayBuckets(from: number, count: number): Bucket[] {
  return Array.from({ length: count }, (_, i) => {
    const t0 = new Date(from).setDate(new Date(from).getDate() + i);
    const t1 = new Date(from).setDate(new Date(from).getDate() + i + 1);
    return { t0, t1, label: fmt(t0, count <= 7 ? { weekday: 'short' } : { day: 'numeric' }), long: fmt(t0, { weekday: 'long', day: 'numeric', month: 'long' }) };
  });
}
function monthBuckets(from: number, count: number, withYear: boolean): Bucket[] {
  return Array.from({ length: count }, (_, i) => {
    const t0 = addMonths(from, i);
    return {
      t0,
      t1: addMonths(from, i + 1),
      label: fmt(t0, withYear ? { month: 'short', year: '2-digit' } : { month: 'short' }),
      long: fmt(t0, { month: 'long', year: 'numeric' }),
    };
  });
}

/** Debut de la periode et decoupage en colonnes du graphe */
export function periodRange(period: Period, first: number | null, now = Date.now()): { start: number; buckets: Bucket[] } {
  switch (period) {
    case '1j': {
      const start = Math.floor((now - 23 * HOUR) / HOUR) * HOUR;
      return {
        start,
        buckets: Array.from({ length: 24 }, (_, i) => {
          const t0 = start + i * HOUR;
          const h = new Date(t0).getHours();
          return { t0, t1: t0 + HOUR, label: `${h}h`, long: t('{day} de {a}h à {b}h', { day: fmt(t0, { weekday: 'long' }), a: h, b: h + 1 }) };
        }),
      };
    }
    case '1s':
    case '1m': {
      const n = period === '1s' ? 7 : 30;
      const start = startOfDay(now) - (n - 1) * DAY;
      return { start, buckets: dayBuckets(start, n) };
    }
    case '1a':
    case '3a': {
      const n = period === '1a' ? 12 : 36;
      const start = addMonths(startOfMonth(now), -(n - 1));
      return { start, buckets: monthBuckets(start, n, period === '3a') };
    }
    case 'tout': {
      const f = first ?? now - 29 * DAY;
      const days = Math.ceil((startOfDay(now) - startOfDay(f)) / DAY) + 1;
      if (days <= 45) {
        const start = startOfDay(now) - (Math.max(days, 7) - 1) * DAY;
        return { start, buckets: dayBuckets(start, Math.max(days, 7)) };
      }
      const s = startOfMonth(f);
      const months = (new Date(now).getFullYear() - new Date(s).getFullYear()) * 12 + new Date(now).getMonth() - new Date(s).getMonth() + 1;
      if (months <= 48) return { start: s, buckets: monthBuckets(s, months, true) };
      // Tres long : une colonne par annee
      const y0 = new Date(s).getFullYear();
      const y1 = new Date(now).getFullYear();
      return {
        start: s,
        buckets: Array.from({ length: y1 - y0 + 1 }, (_, i) => {
          const t0 = new Date(y0 + i, 0, 1).getTime();
          return { t0, t1: new Date(y0 + i + 1, 0, 1).getTime(), label: String(y0 + i), long: String(y0 + i) };
        }),
      };
    }
  }
}

/* ---------------- Calcul d'une stat sur une periode ---------------- */

type Seg = { key: string; label: string; value: number; cls: string };
interface Computed {
  numbers: { label: string; value: string; cls?: string }[];
  /** Barres sur 100 % */
  shares: { label: string; segs: Seg[] }[];
  chart:
    | { kind: 'line'; points: { t: number; v: number }[]; unit: string; byIndex?: boolean }
    | { kind: 'bars'; series: { key: string; label: string; cls: string }[]; values: Record<string, number>[]; unit: string }
    | null;
  empty: string | null;
}

/** Textes du calcul traduits pour l'affichage */
function translated(c: Computed): Computed {
  const seg = <T extends { label: string }>(x: T): T => ({ ...x, label: t(x.label) });
  return {
    numbers: c.numbers.map(seg),
    shares: c.shares.map((s) => ({ label: t(s.label), segs: s.segs.map(seg) })),
    chart: !c.chart ? null : c.chart.kind === 'line' ? { ...c.chart, unit: t(c.chart.unit) } : { ...c.chart, unit: t(c.chart.unit), series: c.chart.series.map(seg) },
    empty: c.empty && t(c.empty),
  };
}

const WDL_SERIES = [
  { key: 'win', label: 'Victoires', cls: 'c-win' },
  { key: 'draw', label: 'Nulles', cls: 'c-draw' },
  { key: 'loss', label: 'Défaites', cls: 'c-loss' },
];
const wdlSegs = (rows: { r: Res }[]): Seg[] =>
  WDL_SERIES.map((s) => ({ key: s.key, label: s.label, cls: s.cls, value: rows.filter((x) => x.r === s.key).length }));

function bucketize<T extends { t: number }>(rows: T[], buckets: Bucket[], series: string[], keyOf: (r: T) => string | null, amount: (r: T) => number = () => 1) {
  const out = buckets.map(() => Object.fromEntries(series.map((s) => [s, 0])) as Record<string, number>);
  for (const r of rows) {
    const i = buckets.findIndex((b) => r.t >= b.t0 && r.t < b.t1);
    const k = keyOf(r);
    if (i >= 0 && k && k in out[i]) out[i][k] += amount(r);
  }
  return out;
}

/** Points d'une courbe d'Elo sur la periode, avec la valeur de depart (derniere connue avant la periode) */
function ratingPoints(series: { t: number; v: number }[], start: number) {
  const before = series.filter((p) => p.t < start);
  const inside = series.filter((p) => p.t >= start);
  const base = before.length ? [{ t: start, v: before[before.length - 1].v }] : [];
  return [...base, ...inside];
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const pctOf = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : '–');

function compute(stat: StatId, tl: Timeline, data: ProfileData, period: Period, start: number, buckets: Bucket[], rushMode: string): Computed {
  const all = period === 'tout';
  const inP = (t: number | null) => (t === null ? all : t >= start);

  if (stat === 'en-ligne' || stat === 'bots') {
    const src =
      stat === 'en-ligne'
        ? tl.online.map(([t, r, v]) => ({ t, r, v }))
        : tl.bots.map(([t, r, v]) => ({ t, r, v: v as number | null }));
    const rows = src.filter((x) => inP(x.t));
    const rated = src.filter((x) => x.v !== null).map((x) => ({ t: x.t, v: x.v! }));
    const pts = ratingPoints(rated, all ? -Infinity : start);
    const current = stat === 'en-ligne' ? (data.onlineElo?.rating ?? null) : data.profile ? Math.round(data.profile.bots.rating) : null;
    const change = pts.length >= 2 ? pts[pts.length - 1].v - pts[0].v : 0;
    const segs = wdlSegs(rows);
    return {
      numbers: [
        { label: 'Elo actuel', value: current !== null ? String(current) : '–' },
        { label: 'Évolution', value: pts.length >= 2 ? signed(change) : '–', cls: change > 0 ? 'up' : change < 0 ? 'down' : '' },
        { label: 'Parties', value: String(rows.length) },
        { label: 'Meilleur Elo', value: pts.length ? String(Math.max(...pts.map((p) => p.v))) : '–' },
      ],
      shares: [{ label: 'Résultats', segs }],
      chart: { kind: 'line', points: pts, unit: 'Elo' },
      empty: rows.length || pts.length > 1 ? null : 'Aucune partie sur cette période.',
    };
  }

  if (stat === 'problemes') {
    const dated = tl.puzzles.some(([t]) => t === null);
    const rows = tl.puzzles.map(([t, ok, v]) => ({ t, ok, v })).filter((x) => inP(x.t));
    const solved = rows.filter((x) => x.ok).length;
    let points: { t: number; v: number }[];
    let byIndex = false;
    if (all && dated) {
      // Anciens problemes sans date : courbe par probleme
      points = rows.map((x, i) => ({ t: i, v: x.v }));
      byIndex = true;
    } else {
      points = ratingPoints(
        tl.puzzles.filter(([t]) => t !== null).map(([t, , v]) => ({ t: t!, v })),
        all ? -Infinity : start,
      );
    }
    const change = points.length >= 2 ? points[points.length - 1].v - points[0].v : 0;
    return {
      numbers: [
        { label: 'Elo actuel', value: data.profile ? String(Math.round(data.profile.puzzles.rating)) : '–' },
        { label: 'Évolution', value: points.length >= 2 ? signed(change) : '–', cls: change > 0 ? 'up' : change < 0 ? 'down' : '' },
        { label: 'Problèmes', value: String(rows.length) },
        { label: 'Réussite', value: pctOf(solved, rows.length) },
      ],
      shares: [
        {
          label: 'Réussite',
          segs: [
            { key: 'ok', label: 'Réussis', value: solved, cls: 'c-win' },
            { key: 'ko', label: 'Ratés', value: rows.length - solved, cls: 'c-loss' },
          ],
        },
      ],
      chart: { kind: 'line', points, unit: 'Elo', byIndex },
      empty: rows.length ? null : 'Aucun problème sur cette période.',
    };
  }

  if (stat === 'parties') {
    const rows = tl.games.map(([t, r, src, c]) => ({ t, r, src, c })).filter((x) => inP(x.t));
    const bySrc: Record<string, number> = {};
    rows.forEach((x) => (bySrc[x.src] = (bySrc[x.src] ?? 0) + 1));
    const SRC: Record<string, [string, string]> = {
      bot: ['Bots', 'c-1'],
      online: ['En ligne', 'c-2'],
      local: ['Sur écran', 'c-3'],
      'chess.com': ['chess.com', 'c-4'],
      lichess: ['Lichess', 'c-5'],
      pgn: ['PGN', 'c-6'],
    };
    const segs = wdlSegs(rows);
    return {
      numbers: [
        { label: 'Parties', value: String(rows.length) },
        { label: 'Victoires', value: pctOf(segs[0].value, rows.length) },
        { label: 'Avec les Blancs', value: String(rows.filter((x) => x.c === 'w').length) },
        { label: 'Avec les Noirs', value: String(rows.filter((x) => x.c === 'b').length) },
      ],
      shares: [
        { label: 'Toutes', segs },
        { label: 'Avec les Blancs', segs: wdlSegs(rows.filter((x) => x.c === 'w')) },
        { label: 'Avec les Noirs', segs: wdlSegs(rows.filter((x) => x.c === 'b')) },
        {
          label: 'Origine',
          segs: Object.entries(bySrc)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => ({ key: k, label: SRC[k]?.[0] ?? 'Autre', value: v, cls: SRC[k]?.[1] ?? 'c-6' })),
        },
      ],
      chart: { kind: 'bars', series: WDL_SERIES, values: bucketize(rows, buckets, ['win', 'draw', 'loss'], (x) => x.r), unit: 'parties' },
      empty: rows.length ? null : 'Aucune partie enregistrée sur cette période.',
    };
  }

  if (stat === 'rush') {
    const runs = tl.rush.map(([t, mode, score]) => ({ t, mode, score })).filter((x) => x.mode === rushMode);
    const rows = runs.filter((x) => inP(x.t));
    const best = rows.length ? Math.max(...rows.map((x) => x.score)) : 0;
    const record = data.rush[rushMode]?.best ?? (runs.length ? Math.max(...runs.map((x) => x.score)) : 0);
    const avg = rows.length ? Math.round(rows.reduce((s, x) => s + x.score, 0) / rows.length) : 0;
    const max = bucketize(rows, buckets, ['best'], () => 'best');
    rows.forEach((x) => {
      const i = buckets.findIndex((b) => x.t >= b.t0 && x.t < b.t1);
      if (i >= 0) max[i].best = Math.max(max[i].best, x.score);
    });
    return {
      numbers: [
        { label: 'Meilleur score', value: rows.length ? String(best) : '–' },
        { label: 'Score moyen', value: rows.length ? String(avg) : '–' },
        { label: 'Sessions', value: String(rows.length) },
        { label: 'Record absolu', value: record ? String(record) : '–' },
      ],
      shares: [
        {
          label: 'Meilleur score de la période par rapport au record',
          segs: [
            { key: 'best', label: 'Meilleur score', value: best, cls: 'c-win' },
            { key: 'gap', label: 'Écart au record', value: Math.max(0, record - best), cls: 'c-none' },
          ],
        },
      ],
      chart: { kind: 'bars', series: [{ key: 'best', label: 'Meilleur score', cls: 'c-win' }], values: max, unit: 'points' },
      empty: rows.length ? null : 'Aucune session dans ce mode sur cette période.',
    };
  }

  if (stat === 'probleme-du-jour') {
    const rows = tl.daily.map(([t, ok, first]) => ({ t, ok, first })).filter((x) => inP(x.t));
    const ok = rows.filter((x) => x.ok).length;
    const first = rows.filter((x) => x.first).length;
    return {
      numbers: [
        { label: 'Jours joués', value: String(rows.length) },
        { label: 'Réussis', value: String(ok) },
        { label: 'Du premier coup', value: String(first) },
        { label: 'Réussite', value: pctOf(ok, rows.length) },
      ],
      shares: [
        {
          label: 'Résultats',
          segs: [
            { key: 'first', label: 'Du premier coup', value: first, cls: 'c-win' },
            { key: 'ok', label: 'Après une erreur', value: ok - first, cls: 'c-draw' },
            { key: 'ko', label: 'Ratés', value: rows.length - ok, cls: 'c-loss' },
          ],
        },
      ],
      chart: {
        kind: 'bars',
        series: [
          { key: 'ok', label: 'Réussis', cls: 'c-win' },
          { key: 'ko', label: 'Ratés', cls: 'c-loss' },
        ],
        values: bucketize(rows, buckets, ['ok', 'ko'], (x) => (x.ok ? 'ok' : 'ko')),
        unit: 'jours',
      },
      empty: rows.length ? null : 'Aucun problème du jour sur cette période.',
    };
  }

  if (stat === 'cours') {
    const total = CHAPTERS.flatMap((c) => [...c.lessons, ...(c.advanced ?? [])]).length;
    const rows = tl.lessons.map(([t, stars]) => ({ t, stars })).filter((x) => inP(x.t));
    const stars = rows.reduce((s, x) => s + x.stars, 0);
    const doneAll = data.profile ? Object.keys(data.profile.lessons).length : tl.lessons.length;
    return {
      numbers: [
        { label: 'Leçons terminées', value: String(rows.length) },
        { label: 'Étoiles', value: `${stars} ⭐` },
        { label: 'Au total', value: `${doneAll}/${total}` },
        { label: 'Parcours', value: pctOf(doneAll, total) },
      ],
      shares: [
        {
          label: 'Leçons du parcours',
          segs: [
            { key: 'p', label: 'Terminées sur la période', value: rows.length, cls: 'c-win' },
            { key: 'b', label: 'Terminées avant', value: Math.max(0, doneAll - rows.length), cls: 'c-draw' },
            { key: 'r', label: 'À faire', value: Math.max(0, total - doneAll), cls: 'c-none' },
          ],
        },
      ],
      chart: {
        kind: 'bars',
        series: [{ key: 'n', label: 'Leçons terminées', cls: 'c-win' }],
        values: bucketize(rows, buckets, ['n'], () => 'n'),
        unit: 'leçons',
      },
      empty: rows.length ? null : 'Aucune leçon terminée sur cette période.',
    };
  }

  // Succes
  const total = ACHIEVEMENTS.length;
  const rows = tl.achievements
    .map(([t, id]) => ({ t, tier: ACHIEVEMENTS.find((a) => a.id === id)?.tier ?? 1 }))
    .filter((x) => inP(x.t));
  const doneAll = Object.keys(data.achievements).length;
  const TIER_SERIES = [
    { key: '3', label: 'Or', cls: 'c-gold' },
    { key: '2', label: 'Argent', cls: 'c-silver' },
    { key: '1', label: 'Bronze', cls: 'c-bronze' },
  ];
  return {
    numbers: [
      { label: 'Débloqués', value: String(rows.length) },
      { label: 'Or', value: String(rows.filter((x) => x.tier === 3).length) },
      { label: 'Au total', value: `${doneAll}/${total}` },
      { label: 'Collection', value: pctOf(doneAll, total) },
    ],
    shares: [
      {
        label: 'Collection',
        segs: [
          { key: 'p', label: 'Débloqués sur la période', value: rows.length, cls: 'c-win' },
          { key: 'b', label: 'Débloqués avant', value: Math.max(0, doneAll - rows.length), cls: 'c-draw' },
          { key: 'r', label: 'À débloquer', value: Math.max(0, total - doneAll), cls: 'c-none' },
        ],
      },
    ],
    chart: { kind: 'bars', series: TIER_SERIES, values: bucketize(rows, buckets, ['1', '2', '3'], (x) => String(x.tier)), unit: 'succès' },
    empty: rows.length ? null : 'Aucun succès débloqué sur cette période.',
  };
}

/* ---------------- Affichage ---------------- */

interface Props {
  stat: StatId;
  period: Period;
  data: ProfileData;
  onPeriod: (p: Period) => void;
  onStat: (s: StatId) => void;
  onBack: () => void;
}

export function StatDetail({ stat, period, data, onPeriod, onStat, onBack }: Props) {
  const tl = data.timeline;
  const [rushMode, setRushMode] = useState('3');
  const firstT = useMemo(() => {
    if (!tl) return null;
    const ts = (Object.values(tl) as (number | null)[][][]).flatMap((rows) => rows.map((r) => r[0])).filter((t): t is number => t !== null);
    return ts.length ? Math.min(...ts) : null;
  }, [tl]);
  const { start, buckets } = periodRange(period, firstT);
  const c = tl ? translated(compute(stat, tl, data, period, start, buckets, rushMode)) : null;
  const info = STATS[stat];

  return (
    <div className="stat-detail">
      <div className="stat-top">
        <button className="btn ghost" onClick={onBack}>{t('← Profil de {name}', { name: data.username })}
        </button>
        <div className="chips stat-switch">
          {(Object.keys(STATS) as StatId[]).map((s) => (
            <button key={s} className={`chip ${s === stat ? 'selected' : ''}`} onClick={() => onStat(s)} title={STATS[s].title}>
              {STATS[s].icon} <span className="stat-switch-label">{STATS[s].title}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="card">
        <div className="stat-head">
          <h2>
            {info.icon} {info.title}
          </h2>
          <div className="chips" role="tablist" aria-label={t("Période")}>
            {PERIODS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={id === period} className={`chip ${id === period ? 'selected' : ''}`} onClick={() => onPeriod(id)}>
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        {stat === 'rush' && (
          <div className="chips stat-sub">
            {[
              ['3', t("3 min")],
              ['5', t("5 min")],
              ['survival', t("Survie")],
            ].map(([m, l]) => (
              <button key={m} className={`chip ${m === rushMode ? 'selected' : ''}`} onClick={() => setRushMode(m)}>
                {l}
              </button>
            ))}
          </div>
        )}

        {!c ? (
          <p className="muted">{t("Le détail des stats sera disponible après la mise à jour du serveur.")}</p>
        ) : (
          <>
            <div className="stat-numbers">
              {c.numbers.map((n) => (
                <div key={n.label}>
                  <b className={n.cls}>{n.value}</b>
                  <span className="muted tiny">{n.label}</span>
                </div>
              ))}
            </div>

            <div className="stat-shares">
              {c.shares.map((s) => (
                <ShareBar key={s.label} label={s.label} segs={s.segs} />
              ))}
            </div>

            {c.chart && !(c.empty && c.chart.kind === 'bars') && (
              <div className="stat-chart">
                {c.chart.kind === 'line' ? (
                  <LineChart points={c.chart.points} start={start} byIndex={c.chart.byIndex} unit={c.chart.unit} />
                ) : (
                  <BarChart buckets={buckets} series={c.chart.series} values={c.chart.values} unit={c.chart.unit} />
                )}
              </div>
            )}
            {c.empty && <p className="muted small center">{c.empty}</p>}
          </>
        )}
      </section>
    </div>
  );
}

function ShareBar({ label, segs }: { label: string; segs: Seg[] }) {
  const total = segs.reduce((s, x) => s + x.value, 0);
  const shown = segs.filter((x) => x.value > 0);
  return (
    <div className="share">
      <div className="share-head">
        <span className="small">{label}</span>
        <span className="muted tiny">{total ? t('{n} au total', { n: total }) : t("rien sur la période")}</span>
      </div>
      <div className="share-bar" role="img" aria-label={segs.map((x) => `${x.label} ${x.value}`).join(', ')}>
        {total === 0 ? (
          <i className="c-none" style={{ flex: 1 }} />
        ) : (
          shown.map((x) => <i key={x.key} className={x.cls} style={{ flex: x.value }} title={`${x.label} : ${x.value} (${Math.round((x.value / total) * 100)} %)`} />)
        )}
      </div>
      <div className="share-legend">
        {segs.map((x) => (
          <span key={x.key}>
            <i className={x.cls} />
            {x.label} <b>{total ? Math.round((x.value / total) * 100) : 0} %</b> <span className="muted">({x.value})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const W = 900;
const H = 260;
const PAD = { l: 44, r: 12, t: 12, b: 28 };

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const left = Math.min(Math.max((x / W) * 100, 12), 88);
  return (
    <div className="chart-tip" style={{ left: `${left}%`, top: `${(y / H) * 100}%` }}>
      {children}
    </div>
  );
}

function LineChart({ points, start, byIndex, unit }: { points: { t: number; v: number }[]; start: number; byIndex?: boolean; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (points.length < 2) return <p className="muted small center">{t("Pas assez de points pour tracer une courbe sur cette période.")}</p>;
  const now = Date.now();
  const x0 = byIndex ? 0 : Math.min(start, points[0].t);
  const x1 = byIndex ? points.length - 1 : now;
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  const padV = Math.max(10, (hi - lo) * 0.1);
  lo -= padV;
  hi += padV;
  const X = (t: number) => PAD.l + ((t - x0) / Math.max(1, x1 - x0)) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const xy = points.map((p, i) => [X(byIndex ? i : p.t), Y(p.v)] as const);
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${xy[xy.length - 1][0].toFixed(1)},${H - PAD.b} L${xy[0][0].toFixed(1)},${H - PAD.b} Z`;
  const ticks = niceTicks(lo, hi);
  const xLabels = byIndex
    ? [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => ({ x: X(i), label: `n° ${i + 1}` }))
    : [x0, (x0 + x1) / 2, x1].map((t) => ({ x: X(t), label: x1 - x0 < 2 * DAY ? new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : fmt(t, { day: 'numeric', month: 'short', year: x1 - x0 > 300 * DAY ? '2-digit' : undefined }) }));

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    xy.forEach(([x], i) => {
      if (Math.abs(x - mx) < Math.abs(xy[best][0] - mx)) best = i;
    });
    setHover(best);
  };
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="chart line" role="img" aria-label={t('Courbe {unit} de {a} à {b}', { unit, a: vs[0], b: vs[vs.length - 1] })} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} className="grid" />
            <text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" className="axis">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="axis">
            {l.label}
          </text>
        ))}
        <path d={area} className="area" />
        <path d={path} className="stroke" />
        {hover !== null && (
          <>
            <line x1={xy[hover][0]} x2={xy[hover][0]} y1={PAD.t} y2={H - PAD.b} className="cross" />
            <circle cx={xy[hover][0]} cy={xy[hover][1]} r={5} className="dot" />
          </>
        )}
      </svg>
      {h && hover !== null && (
        <Tip x={xy[hover][0]} y={xy[hover][1]}>
          <b>
            {h.v} {unit}
          </b>
          <span>{byIndex ? t('Problème n° {n}', { n: hover + 1 }) : new Date(h.t).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </Tip>
      )}
    </div>
  );
}

function BarChart({
  buckets,
  series,
  values,
  unit,
}: {
  buckets: Bucket[];
  series: { key: string; label: string; cls: string }[];
  values: Record<string, number>[];
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = values.map((v) => series.reduce((s, x) => s + (v[x.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const ticks = niceTicks(0, max, 3).filter((v) => Number.isInteger(v));
  const n = buckets.length;
  const slot = (W - PAD.l - PAD.r) / n;
  const bw = Math.max(3, Math.min(28, slot * 0.7));
  const Y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const every = Math.ceil(n / 12);
  const GAP = 2;
  return (
    <div className="chart-wrap">
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.key}>
              <i className={s.cls} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart bars" role="img" aria-label={t('Histogramme {unit}', { unit })} onPointerLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} className="grid" />
            <text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          let acc = 0;
          const segs = series
            .map((s) => ({ s, v: values[i][s.key] ?? 0 }))
            .filter((x) => x.v > 0);
          return (
            <g key={b.t0} onPointerEnter={() => setHover(i)}>
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} className={`hit ${hover === i ? 'on' : ''}`} />
              {segs.map(({ s, v }, k) => {
                const y0 = Y(acc);
                acc += v;
                const y1 = Y(acc);
                const top = k === segs.length - 1;
                const hgt = Math.max(1, y0 - y1 - (k > 0 ? GAP : 0));
                const y = y1;
                return top ? (
                  <path
                    key={s.key}
                    className={`bar ${s.cls}`}
                    d={`M${cx - bw / 2},${y + hgt} V${y + Math.min(4, hgt)} Q${cx - bw / 2},${y} ${cx - bw / 2 + Math.min(4, bw / 2)},${y} H${cx + bw / 2 - Math.min(4, bw / 2)} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + Math.min(4, hgt)} V${y + hgt} Z`}
                  />
                ) : (
                  <rect key={s.key} className={`bar ${s.cls}`} x={cx - bw / 2} y={y} width={bw} height={hgt} />
                );
              })}
              {i % every === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" className="axis">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={PAD.l + slot * hover + slot / 2} y={Y(totals[hover])}>
          <b>{buckets[hover].long}</b>
          {series.map((s) => (
            <span key={s.key} className="tip-row">
              <i className={s.cls} /> {s.label} : {values[hover][s.key] ?? 0}
            </span>
          ))}
          {series.length > 1 && (
            <span className="muted">{t("Total :")}{" "}{totals[hover]}</span>
          )}
        </Tip>
      )}
    </div>
  );
}
