// "Contre le monde" : file d'attente par cadence, appariement automatique entre joueurs connectes.
// File en memoire : suffisant pour une seule instance de l'API.
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';
import { activeGameOf, createGame } from './online.js';
import { onlineRating, PROVISIONAL_GAMES } from './rating.js';

export const matchRouter = Router();
matchRouter.use(requireUser);

// Cadences proposees : id -> [temps initial en ms, increment en ms]
const TCS = { '3+2': [180_000, 2000], '5+0': [300_000, 0], '10+0': [600_000, 0], '15+10': [900_000, 10_000] };
const STALE_MS = 10_000;

/** userId -> { userId, username, tc, rating, since, lastPoll } */
const queue = new Map();
/** userId -> gameId (appariement trouve, en attente de lecture par le joueur) */
const matched = new Map();

function purge() {
  const now = Date.now();
  for (const [id, e] of queue) if (now - e.lastPoll > STALE_MS) queue.delete(id);
}

export function queueSnapshot() {
  purge();
  const by = {};
  for (const e of queue.values()) by[e.tc] = (by[e.tc] ?? 0) + 1;
  return { total: queue.size, byTc: by };
}

async function ratingOf(userId) {
  return (await onlineRating(pool, userId)).rating;
}

async function mine(userId) {
  const r = await onlineRating(pool, userId);
  return { rating: Math.round(r.rating), games: r.games, provisional: r.games < PROVISIONAL_GAMES };
}

async function onlineCount() {
  const { rows } = await pool.query("SELECT count(*) AS n FROM users WHERE last_seen > now() - interval '3 minutes'");
  return Number(rows[0].n);
}

function touch(userId) {
  pool.query('UPDATE users SET last_seen = now() WHERE id = $1', [userId]).catch(() => undefined);
}

async function status(req) {
  purge();
  const snap = queueSnapshot();
  return { online: await onlineCount(), searching: snap.total, byTc: snap.byTc, me: await mine(req.user.id) };
}

matchRouter.post('/join', async (req, res) => {
  const tc = String(req.body?.tc ?? '');
  if (!TCS[tc]) return res.status(400).json({ error: 'Cadence inconnue' });
  purge();
  touch(req.user.id);
  matched.delete(req.user.id);
  // Une seule partie en ligne a la fois : on renvoie celle en cours
  const current = await activeGameOf(req.user.id);
  if (current) {
    queue.delete(req.user.id);
    return res.json({ gameId: current.id, opponent: current.opponent, existing: true });
  }
  const rating = await ratingOf(req.user.id);
  const now = Date.now();

  // Adversaire dans la meme cadence : le plus proche en Elo
  let best = null;
  for (const e of queue.values()) {
    if (e.userId === req.user.id || e.tc !== tc) continue;
    if (!best || Math.abs(e.rating - rating) < Math.abs(best.rating - rating)) best = e;
  }
  if (!best) {
    queue.set(req.user.id, { userId: req.user.id, username: req.user.username, tc, rating, since: now, lastPoll: now });
    return res.json({ waiting: true, ...(await status(req)) });
  }
  // On retire les deux joueurs avant toute attente (pas de double appariement)
  queue.delete(best.userId);
  queue.delete(req.user.id);
  // L'adversaire a pu lancer une partie ailleurs entre-temps (defi d'un ami)
  if (await activeGameOf(best.userId)) {
    queue.set(req.user.id, { userId: req.user.id, username: req.user.username, tc, rating, since: now, lastPoll: now });
    return res.json({ waiting: true, ...(await status(req)) });
  }
  const [initial, increment] = TCS[tc];
  const meWhite = Math.random() < 0.5;
  const client = await pool.connect();
  try {
    const gameId = await createGame(client, {
      white: meWhite ? req.user.id : best.userId,
      black: meWhite ? best.userId : req.user.id,
      initial,
      increment,
      rated: true,
    });
    matched.set(best.userId, gameId);
    res.json({ gameId, opponent: best.username });
  } catch (e) {
    // Echec : l'adversaire retourne dans la file
    queue.set(best.userId, best);
    throw e;
  } finally {
    client.release();
  }
});

matchRouter.get('/status', async (req, res) => {
  touch(req.user.id);
  const g = matched.get(req.user.id);
  if (g) {
    matched.delete(req.user.id);
    return res.json({ gameId: g });
  }
  const e = queue.get(req.user.id);
  if (e) e.lastPoll = Date.now();
  res.json({ waiting: !!e, ...(await status(req)) });
});

matchRouter.post('/leave', async (req, res) => {
  queue.delete(req.user.id);
  const g = matched.get(req.user.id);
  // Appariement arrive pendant qu'on partait : on le renvoie quand meme
  if (g) {
    matched.delete(req.user.id);
    return res.json({ gameId: g });
  }
  res.json({ ok: true });
});
