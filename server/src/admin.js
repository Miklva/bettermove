// Statistiques du site, reservees aux administrateurs (variable ADMIN_USERS)
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';
import { isAdmin } from './moderation.js';
import { queueSnapshot } from './match.js';

export const adminRouter = Router();
adminRouter.use(requireUser, (req, res, next) => {
  if (!isAdmin(req.user.username)) return res.status(403).json({ error: 'Réservé aux administrateurs' });
  next();
});

const PROFILE = "'bettermove.profile.v1'";
const DAY = "(now() AT TIME ZONE 'Europe/Paris')::date";
// Requete tolerante : une table absente (vieille base) donne simplement un resultat vide
const q = (sql, params = []) => pool.query(sql, params).then((r) => r.rows).catch(() => []);

adminRouter.get('/stats', async (_req, res) => {
  const since30 = Date.now() - 30 * 86400_000;
  const [
    totals,
    online,
    signups,
    games,
    online30,
    elo,
    eloBuckets,
    recent,
    rush,
    daily,
    chat,
    support,
    sources,
    onlineElo,
  ] = await Promise.all([
    q(
      `SELECT
         (SELECT count(*) FROM users) AS users,
         (SELECT count(*) FROM users WHERE created_at > now() - interval '30 days') AS new30,
         (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS new7,
         (SELECT count(*) FROM users WHERE avatar IS NOT NULL) AS avatars,
         (SELECT count(DISTINCT id) FROM (
            SELECT id FROM users WHERE last_seen > now() - interval '30 days'
            UNION SELECT user_id FROM games WHERE played_at > now() - interval '30 days'
            UNION SELECT user_id FROM user_data WHERE updated_at > $1
         ) a) AS active30,
         (SELECT count(DISTINCT id) FROM (
            SELECT id FROM users WHERE last_seen > now() - interval '1 day'
            UNION SELECT user_id FROM user_data WHERE updated_at > $2
         ) a) AS active1,
         (SELECT count(*) FROM games WHERE NOT deleted) AS games,
         (SELECT count(*) FROM games WHERE NOT deleted AND played_at > now() - interval '30 days') AS games30`,
      [since30, Date.now() - 86400_000],
    ),
    q(`SELECT username FROM users WHERE last_seen > now() - interval '3 minutes' ORDER BY last_seen DESC LIMIT 50`),
    q(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(u.id) AS n
       FROM generate_series(${DAY} - 29, ${DAY}, interval '1 day') d
       LEFT JOIN users u ON (u.created_at AT TIME ZONE 'Europe/Paris')::date = d::date
       GROUP BY d ORDER BY d`,
    ),
    q(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(g.id) AS n, count(DISTINCT g.user_id) AS players
       FROM generate_series(${DAY} - 29, ${DAY}, interval '1 day') d
       LEFT JOIN games g ON (g.played_at AT TIME ZONE 'Europe/Paris')::date = d::date AND NOT g.deleted
         AND g.source IN ('bot', 'local', 'online')
       GROUP BY d ORDER BY d`,
    ),
    q(`SELECT count(*) AS n, count(*) FILTER (WHERE status = 'active') AS live FROM online_games WHERE created_at > now() - interval '30 days'`),
    q(
      `SELECT avg((value->'bots'->>'rating')::float) AS bots, avg((value->'puzzles'->>'rating')::float) AS puzzles,
              avg((value->>'xp')::float) AS xp, count(*) AS n,
              max((value->'bots'->>'rating')::float) AS best_bots, max((value->'puzzles'->>'rating')::float) AS best_puzzles
       FROM user_data WHERE key = ${PROFILE}`,
    ),
    q(
      `SELECT (floor((value->'bots'->>'rating')::float / 200) * 200)::int AS bucket, count(*) AS n
       FROM user_data WHERE key = ${PROFILE} GROUP BY 1 ORDER BY 1`,
    ),
    q(`SELECT username, created_at, last_seen FROM users ORDER BY created_at DESC LIMIT 10`),
    q(`SELECT count(*) AS runs, count(DISTINCT user_id) AS players, max(score) AS best FROM rush_scores WHERE created_at > now() - interval '30 days'`),
    q(`SELECT count(*) AS n, count(DISTINCT user_id) AS players, count(*) FILTER (WHERE first_try) AS first_try FROM daily_results WHERE day > (${DAY} - 30)`),
    q(`SELECT count(*) AS n, count(DISTINCT user_id) AS authors FROM chat_messages WHERE created_at > now() - interval '30 days'`),
    q(`SELECT count(*) AS n FROM support_messages WHERE created_at > now() - interval '30 days'`),
    q(
      `SELECT coalesce(source, 'autre') AS source, count(*) AS n FROM games
       WHERE NOT deleted AND played_at > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC`,
    ),
    q(`SELECT avg(online_rating) AS avg, count(*) AS n, max(online_rating) AS best FROM users WHERE online_games > 0`),
  ]);
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  const t = totals[0] ?? {};
  res.json({
    users: num(t.users),
    new30: num(t.new30),
    new7: num(t.new7),
    avatars: num(t.avatars),
    active30: num(t.active30),
    active1: num(t.active1),
    games: num(t.games),
    games30: num(t.games30),
    online: online.map((r) => r.username),
    queue: queueSnapshot(),
    signups: signups.map((r) => ({ day: r.day, n: num(r.n) })),
    gamesByDay: games.map((r) => ({ day: r.day, n: num(r.n), players: num(r.players) })),
    onlineGames30: num(online30[0]?.n) ?? 0,
    onlineLive: num(online30[0]?.live) ?? 0,
    elo: {
      online: num(onlineElo[0]?.avg),
      onlinePlayers: num(onlineElo[0]?.n) ?? 0,
      bestOnline: num(onlineElo[0]?.best),
      bots: num(elo[0]?.bots),
      puzzles: num(elo[0]?.puzzles),
      xp: num(elo[0]?.xp),
      profiles: num(elo[0]?.n) ?? 0,
      bestBots: num(elo[0]?.best_bots),
      bestPuzzles: num(elo[0]?.best_puzzles),
    },
    eloBuckets: eloBuckets.filter((r) => r.bucket !== null).map((r) => ({ bucket: r.bucket, n: num(r.n) })),
    recent: recent.map((r) => ({ username: r.username, createdAt: r.created_at, lastSeen: r.last_seen })),
    rush: { runs: num(rush[0]?.runs) ?? 0, players: num(rush[0]?.players) ?? 0, best: num(rush[0]?.best) },
    daily: { n: num(daily[0]?.n) ?? 0, players: num(daily[0]?.players) ?? 0, firstTry: num(daily[0]?.first_try) ?? 0 },
    chat: { n: num(chat[0]?.n) ?? 0, authors: num(chat[0]?.authors) ?? 0 },
    support: num(support[0]?.n) ?? 0,
    sources: sources.map((r) => ({ source: r.source, n: num(r.n) })),
  });
});

/* ---------------- Demandes au support (lues ici, sans passer par un mail) ---------------- */

adminRouter.get('/support', async (_req, res) => {
  const rows = await q(
    `SELECT s.id, s.name, s.email, s.category, s.subject, s.message, s.context, s.mailed, s.handled, s.created_at, u.username
     FROM support_messages s LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.handled, s.created_at DESC LIMIT 200`,
  );
  res.json({
    messages: rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      email: r.email,
      category: r.category,
      subject: r.subject,
      message: r.message,
      context: r.context,
      handled: r.handled,
      account: r.username,
      createdAt: r.created_at,
    })),
  });
});

adminRouter.put('/support/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Demande inconnue' });
  await pool.query('UPDATE support_messages SET handled = $2 WHERE id = $1', [id, !!req.body?.handled]);
  res.json({ ok: true });
});

adminRouter.delete('/support/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Demande inconnue' });
  await pool.query('DELETE FROM support_messages WHERE id = $1', [id]);
  res.json({ ok: true });
});
