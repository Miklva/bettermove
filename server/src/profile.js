// Profil public d'un joueur : progression, classements, parties, activite
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { JWT_SECRET } from './auth.js';

export const profileRouter = Router();

const KEYS = ['bettermove.profile.v1', 'bettermove.achievements.v1', 'bettermove.repertoire.v1', 'bettermove.shop.v1', 'bettermove.settings.v1'];

function viewer(req) {
  try {
    return jwt.verify(req.cookies?.bm_session ?? '', JWT_SECRET).uid;
  } catch {
    return null;
  }
}

/** Resume des parties enregistrees (meme calcul que le client, voir src/profile/stats.ts) */
export function summarizeGames(list) {
  const out = {
    total: 0,
    bySource: {},
    results: { win: 0, draw: 0, loss: 0 },
    asWhite: { win: 0, draw: 0, loss: 0 },
    asBlack: { win: 0, draw: 0, loss: 0 },
    openings: {},
    recent: [],
  };
  const sorted = list
    .filter((g) => g && !g.observer && g.coachSide !== 'none')
    .sort((a, b) => String(b.playedAt ?? b.date ?? '').localeCompare(String(a.playedAt ?? a.date ?? '')));
  for (const g of sorted) {
    const me = g.userColor === 'b' ? 'b' : 'w';
    const r = g.result === '1/2-1/2' ? 'draw' : g.result === (me === 'w' ? '1-0' : '0-1') ? 'win' : g.result === '*' || !g.result ? null : 'loss';
    out.total++;
    out.bySource[g.source ?? 'autre'] = (out.bySource[g.source ?? 'autre'] ?? 0) + 1;
    if (!r) continue;
    out.results[r]++;
    out[me === 'w' ? 'asWhite' : 'asBlack'][r]++;
    if (g.opening) {
      const o = (out.openings[g.opening] ??= { win: 0, draw: 0, loss: 0, n: 0 });
      o[r]++;
      o.n++;
    }
    if (out.recent.length < 20) out.recent.push(r);
  }
  out.openings = Object.entries(out.openings)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6)
    .map(([name, o]) => ({ name, ...o }));
  return out;
}

const ms = (v) => {
  const t = v instanceof Date ? v.getTime() : Date.parse(v ?? '');
  return Number.isFinite(t) ? t : null;
};
const resOf = (g) => {
  const me = g.userColor === 'b' ? 'b' : 'w';
  if (g.result === '1/2-1/2') return 'draw';
  if (g.result === (me === 'w' ? '1-0' : '0-1')) return 'win';
  if (!g.result || g.result === '*') return null;
  return 'loss';
};

/** Historique date pour le detail des stats (meme format que src/profile/timeline.ts) */
function timeline({ p, games, achievements, online, userId, daily, rush }) {
  const t = { games: [], online: [], bots: [], puzzles: [], daily: [], rush: [], lessons: [], achievements: [] };
  for (const g of games) {
    if (!g || g.observer || g.coachSide === 'none') continue;
    const r = resOf(g);
    const at = ms(g.playedAt ?? g.date);
    if (r && at) t.games.push([at, r, g.source ?? 'autre', g.userColor === 'b' ? 'b' : 'w']);
  }
  for (const g of online) {
    const meWhite = g.white_id === userId;
    const r = g.result === '1/2-1/2' ? 'draw' : g.result === (meWhite ? '1-0' : '0-1') ? 'win' : 'loss';
    const before = meWhite ? g.white_rating : g.black_rating;
    const delta = meWhite ? g.white_delta : g.black_delta;
    t.online.push([ms(g.updated_at), r, g.rated && before != null && delta != null ? before + delta : null]);
  }
  if (p) {
    for (const h of p.history ?? []) {
      const at = ms(h.date);
      if (at) t.bots.push([at, h.score === 1 ? 'win' : h.score === 0.5 ? 'draw' : 'loss', Math.round(h.after)]);
    }
    let r = Math.round(Number(p.puzzles?.rating ?? 0));
    const pz = [];
    for (const h of p.puzzleHistory ?? []) {
      pz.push([ms(h.at), !!h.win && !h.assisted, r]);
      r -= Number(h.delta ?? 0);
    }
    t.puzzles = pz.reverse();
    for (const l of Object.values(p.lessons ?? {})) {
      const at = ms(l?.at);
      if (at) t.lessons.push([at, Number(l.stars ?? 0)]);
    }
  }
  for (const d of daily) {
    const at = ms(`${d.day}T12:00:00Z`);
    if (at) t.daily.push([at, !!d.solved, !!d.first_try]);
  }
  for (const r of rush) t.rush.push([ms(r.created_at), r.mode, Number(r.score)]);
  for (const [id, iso] of Object.entries(achievements ?? {})) {
    const at = ms(iso);
    if (at) t.achievements.push([at, id]);
  }
  for (const k of Object.keys(t)) t[k].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
  return t;
}

/** Series de jours consecutifs a partir d'une liste de dates AAAA-MM-JJ triees */
function streaks(days) {
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const d of days) {
    const t = Date.parse(`${d}T12:00:00Z`);
    cur = prev !== null && t - prev === 86400_000 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return { best, last: days[days.length - 1] ?? null, current: cur };
}

async function rankOf(sql, params) {
  const { rows } = await pool.query(sql, params).catch(() => ({ rows: [] }));
  return rows[0]?.rank ? Number(rows[0].rank) : null;
}

/** Skins portes : pieces et sons de la boutique, plateau des parametres (seulement s'ils sont possedes) */
function equippedOf(shop, settings) {
  const owned = new Set(Array.isArray(shop?.owned) ? shop.owned : []);
  const pick = (id, fallback) => (typeof id === 'string' && (owned.has(id) || id === fallback) ? id : fallback);
  const board = typeof settings?.boardTheme === 'string' ? settings.boardTheme : 'bois';
  return {
    pieces: pick(shop?.equipped?.pieces, 'pieces-classic'),
    sounds: pick(shop?.equipped?.sounds, 'sounds-classic'),
    board,
    // Plateau de la boutique : compte seulement s'il a ete achete (le client retombe sinon sur le plateau de base)
    boardOwned: owned.has(`board-${board}`),
  };
}

profileRouter.get('/:name', async (req, res) => {
  const { rows: users } = await pool.query(
    `SELECT id, username, created_at, last_seen, avatar IS NOT NULL AS has_avatar, online_rating, online_games
     FROM users WHERE lower(username) = lower($1)`,
    [req.params.name],
  );
  const u = users[0];
  if (!u) return res.status(404).json({ error: 'Joueur introuvable' });

  const [data, games, online, recentOnline, daily, rush, onlineAll, rushAll] = await Promise.all([
    pool.query('SELECT key, value FROM user_data WHERE user_id = $1 AND key = ANY($2)', [u.id, KEYS]),
    pool.query('SELECT data FROM games WHERE user_id = $1 AND NOT deleted ORDER BY played_at DESC NULLS LAST LIMIT 5000', [u.id]),
    pool.query(
      `SELECT count(*) FILTER (WHERE (white_id = $1 AND result = '1-0') OR (black_id = $1 AND result = '0-1')) AS win,
              count(*) FILTER (WHERE result = '1/2-1/2') AS draw,
              count(*) FILTER (WHERE (white_id = $1 AND result = '0-1') OR (black_id = $1 AND result = '1-0')) AS loss
       FROM online_games WHERE (white_id = $1 OR black_id = $1) AND status = 'over' AND result <> '*'`,
      [u.id],
    ),
    pool.query(
      `SELECT g.result, g.rated, g.updated_at, g.white_id, g.white_delta, g.black_delta, uw.username AS white, ub.username AS black
       FROM online_games g JOIN users uw ON uw.id = g.white_id JOIN users ub ON ub.id = g.black_id
       WHERE (g.white_id = $1 OR g.black_id = $1) AND g.status = 'over' AND g.result <> '*' ORDER BY g.updated_at DESC LIMIT 8`,
      [u.id],
    ),
    pool.query('SELECT day, solved, first_try FROM daily_results WHERE user_id = $1 AND done ORDER BY day', [u.id]).catch(() => ({ rows: [] })),
    pool.query('SELECT mode, max(score) AS best, count(*) AS runs FROM rush_scores WHERE user_id = $1 GROUP BY mode', [u.id]).catch(() => ({
      rows: [],
    })),
    pool.query(
      `SELECT result, rated, updated_at, white_id, white_rating, black_rating, white_delta, black_delta FROM online_games
       WHERE (white_id = $1 OR black_id = $1) AND status = 'over' AND result <> '*' ORDER BY updated_at DESC LIMIT 2000`,
      [u.id],
    ),
    pool.query('SELECT mode, score, created_at FROM rush_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 2000', [u.id]).catch(() => ({
      rows: [],
    })),
  ]);
  const kv = Object.fromEntries(data.rows.map((r) => [r.key, r.value]));
  const p = kv['bettermove.profile.v1'] ?? null;
  const solvedDays = daily.rows.filter((r) => r.solved).map((r) => r.day);

  const [rOnline, rBots, rPuzzles] = await Promise.all([
    u.online_rating !== null
      ? rankOf('SELECT count(*) + 1 AS rank FROM users WHERE online_games > 0 AND online_rating > $1', [u.online_rating])
      : null,
    p ? rankOf(
      `SELECT count(*) + 1 AS rank FROM user_data WHERE key = 'bettermove.profile.v1' AND (value->'bots'->>'rating')::float > $1`,
      [Number(p.bots?.rating ?? 0)],
    ) : null,
    p ? rankOf(
      `SELECT count(*) + 1 AS rank FROM user_data WHERE key = 'bettermove.profile.v1' AND (value->'puzzles'->>'rating')::float > $1`,
      [Number(p.puzzles?.rating ?? 0)],
    ) : null,
  ]);

  const o = online.rows[0] ?? {};
  const shop = kv['bettermove.shop.v1'];
  res.json({
    username: u.username,
    self: viewer(req) === u.id,
    createdAt: u.created_at,
    lastSeen: u.last_seen,
    online: !!u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 3 * 60_000,
    hasAvatar: u.has_avatar,
    profile: p
      ? {
          bots: p.bots,
          puzzles: p.puzzles,
          puzzleStats: p.puzzleStats,
          xp: p.xp ?? 0,
          lessons: p.lessons ?? {},
          beaten: p.beaten ?? [],
          // Courbe d'Elo bots : seulement les valeurs, 60 dernieres parties
          botCurve: (p.history ?? []).slice(0, 60).reverse().map((g) => Math.round(g.after)),
          puzzleCurve: (p.puzzleHistory ?? []).slice(0, 60).reverse().map((h) => h.rating),
        }
      : null,
    achievements: kv['bettermove.achievements.v1'] ?? {},
    repertoire: kv['bettermove.repertoire.v1']?.chosen ?? [],
    owned: Array.isArray(shop?.owned) ? shop.owned.length : 0,
    equipped: equippedOf(shop, kv['bettermove.settings.v1']),
    // Pas encore de partie classee : meme Elo de depart que sur la page Contre le monde (Elo bots borne, sinon 1200)
    onlineElo:
      u.online_rating !== null
        ? { rating: Math.round(u.online_rating), games: u.online_games }
        : { rating: Math.round(Number(p?.bots?.rating) ? Math.max(600, Math.min(2200, Number(p.bots.rating))) : 1200), games: 0 },
    onlineRecord: { win: Number(o.win ?? 0), draw: Number(o.draw ?? 0), loss: Number(o.loss ?? 0) },
    recentOnline: recentOnline.rows.map((g) => {
      const meWhite = g.white_id === u.id;
      const r = g.result === '1/2-1/2' ? 'draw' : g.result === (meWhite ? '1-0' : '0-1') ? 'win' : 'loss';
      return {
        opponent: meWhite ? g.black : g.white,
        result: r,
        delta: g.rated ? (meWhite ? g.white_delta : g.black_delta) : null,
        at: g.updated_at,
      };
    }),
    games: summarizeGames(games.rows.map((r) => r.data)),
    daily: {
      attempts: daily.rows.length,
      solved: solvedDays.length,
      firstTry: daily.rows.filter((r) => r.first_try).length,
      bestStreak: streaks(solvedDays).best,
    },
    rush: Object.fromEntries(rush.rows.map((r) => [r.mode, { best: Number(r.best), runs: Number(r.runs) }])),
    ranks: { online: rOnline, bots: rBots, puzzles: rPuzzles },
    timeline: timeline({
      p,
      games: games.rows.map((r) => r.data),
      achievements: kv['bettermove.achievements.v1'],
      online: onlineAll.rows,
      userId: u.id,
      daily: daily.rows,
      rush: rushAll.rows,
    }),
  });
});
