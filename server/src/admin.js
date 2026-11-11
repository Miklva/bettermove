// Statistiques du site, reservees aux administrateurs (variable ADMIN_USERS)
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';
import { forbiddenUsername, isAdmin } from './moderation.js';
import { queueSnapshot } from './match.js';
import { mailer, supportReplyEmail } from './mail.js';
import { adminAudience, adminList, adminUser } from './adminDetail.js';

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
    visits,
    puzzleTalk,
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
         (SELECT count(*) FROM games WHERE NOT deleted AND played_at > now() - interval '30 days') AS games30,
         (SELECT count(*) FROM users WHERE email IS NOT NULL) AS emails,
         (SELECT count(*) FROM users WHERE email IS NOT NULL AND email_verified) AS emails_ok,
         (SELECT count(*) FROM users WHERE coalesce(last_seen, created_at) < now() - interval '30 days') AS inactive,
         (SELECT count(*) FROM referrals) AS referrals`,
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
    q(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(v.visitor) AS n, count(v.visitor) FILTER (WHERE NOT v.logged) AS anon
       FROM generate_series(${DAY} - 29, ${DAY}, interval '1 day') d
       LEFT JOIN visits v ON v.day = d::date
       GROUP BY d ORDER BY d`,
    ),
    q(`SELECT count(*) FILTER (WHERE NOT admin_seen AND NOT deleted) AS unseen FROM puzzle_comments`),
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
    emails: num(t.emails) ?? 0,
    emailsOk: num(t.emails_ok) ?? 0,
    inactive: num(t.inactive) ?? 0,
    referrals: num(t.referrals) ?? 0,
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
    puzzleTalk: num(puzzleTalk[0]?.unseen) ?? 0,
    sources: sources.map((r) => ({ source: r.source, n: num(r.n) })),
    visits: visits.map((r) => ({ day: r.day, n: num(r.n), anon: num(r.anon) })),
  });
});

/* ---------------- Detail des statistiques ---------------- */

/** Liste des comptes derriere un chiffre (ex. /admin/list?kind=active30, ?kind=signups&day=2026-11-10) */
adminRouter.get('/list', async (req, res) => {
  try {
    const r = await adminList(String(req.query.kind ?? ''), req.query);
    if (!r) return res.status(404).json({ error: 'Statistique inconnue' });
    res.json(r);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Requête invalide' });
  }
});

/** Fiche complete d'un joueur */
adminRouter.get('/user/:name', async (req, res) => {
  const r = await adminUser(String(req.params.name));
  if (!r) return res.status(404).json({ error: 'Joueur introuvable' });
  res.json(r);
});

/** Audience anonyme : appareils, pages, provenance... (who = anon, logged ou all) */
adminRouter.get('/audience', async (req, res) => {
  res.json(await adminAudience(req.query.days, String(req.query.who ?? 'all')));
});

/* ---------------- Demandes au support (lues ici, sans passer par un mail) ---------------- */

adminRouter.get('/support', async (_req, res) => {
  const rows = await q(
    `SELECT s.id, s.name, s.email, s.category, s.subject, s.message, s.context, s.mailed, s.handled, s.created_at, u.username
     FROM support_messages s LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.handled, s.created_at DESC LIMIT 200`,
  );
  const replies = await q(
    'SELECT support_id, message, mailed, created_at FROM support_replies WHERE support_id = ANY($1) ORDER BY created_at',
    [rows.map((r) => r.id)],
  );
  res.json({
    mail: !!mailer,
    messages: rows.map((r) => ({
      replies: replies
        .filter((x) => String(x.support_id) === String(r.id))
        .map((x) => ({ message: x.message, mailed: x.mailed, createdAt: x.created_at })),
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

/** Repondre au joueur : mail BetterMove (sans le contexte technique), la demande passe en traitee */
adminRouter.post('/support/:id/reply', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Demande inconnue' });
  const text = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (text.length < 2 || text.length > 5000) return res.status(400).json({ error: 'Réponse vide ou trop longue (5000 caractères maximum)' });
  if (!mailer) return res.status(503).json({ error: 'Envoi de mails non configuré (SMTP dans .env)' });
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.email, s.subject, s.message, s.lang, u.username FROM support_messages s
     LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [id],
  );
  const m = rows[0];
  if (!m) return res.status(404).json({ error: 'Demande introuvable' });
  if (!m.email) return res.status(400).json({ error: 'Le joueur n’a pas laissé d’adresse e-mail' });
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: m.email,
      // Le joueur repond au support (et pas a l'adresse d'envoi si elles different)
      replyTo: process.env.SUPPORT_TO || undefined,
      subject: `Re: [BetterMove #${m.id}] ${m.subject}`,
      ...supportReplyEmail({ id: m.id, name: m.username ?? m.name ?? 'joueur', subject: m.subject, reply: text, original: m.message, lang: m.lang ?? 'fr' }),
    });
  } catch (e) {
    console.error('Reponse support', e);
    return res.status(502).json({ error: 'Le mail n’a pas pu partir, réessaie plus tard' });
  }
  await pool.query('INSERT INTO support_replies (support_id, author, message, mailed) VALUES ($1, $2, $3, true)', [id, req.user.username, text]);
  await pool.query('UPDATE support_messages SET handled = true WHERE id = $1', [id]);
  res.json({ ok: true });
});

adminRouter.delete('/support/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Demande inconnue' });
  await pool.query('DELETE FROM support_messages WHERE id = $1', [id]);
  res.json({ ok: true });
});

/* ---------------- Discussions sous les problemes ---------------- */

adminRouter.get('/puzzle-talk', async (_req, res) => {
  const rows = await q(
    `SELECT m.id, m.puzzle_id, coalesce(m.puzzle_ref, q.puzzle_ref) AS puzzle_ref, m.parent_id, m.username, m.text, m.censored, m.deleted, m.admin_seen, m.created_at,
            q.text AS question, q.username AS asker
     FROM puzzle_comments m LEFT JOIN puzzle_comments q ON q.id = m.parent_id
     ORDER BY m.admin_seen, m.id DESC LIMIT 300`,
  );
  res.json({
    messages: rows.map((r) => ({
      id: Number(r.id),
      puzzleId: r.puzzle_id,
      ref: r.puzzle_ref,
      parent: r.parent_id ? Number(r.parent_id) : null,
      user: r.username,
      text: r.text,
      censored: r.censored,
      deleted: r.deleted,
      seen: r.admin_seen,
      question: r.question,
      asker: r.asker,
      at: r.created_at,
    })),
  });
});

/** Marque des messages (ou tout) comme vus */
adminRouter.put('/puzzle-talk/seen', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
  if (ids) await pool.query('UPDATE puzzle_comments SET admin_seen = true WHERE id = ANY($1)', [ids]);
  else await pool.query('UPDATE puzzle_comments SET admin_seen = true WHERE NOT admin_seen');
  res.json({ ok: true });
});

/* ---------------- Pseudos interdits deja crees (avant le filtre) ---------------- */

adminRouter.get('/bad-usernames', async (_req, res) => {
  const rows = await q('SELECT username, created_at, last_seen FROM users ORDER BY created_at DESC');
  res.json({
    users: rows
      .filter((r) => forbiddenUsername(r.username))
      .map((r) => ({ username: r.username, createdAt: r.created_at, lastSeen: r.last_seen })),
  });
});
