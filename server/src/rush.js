// Puzzle Rush : enregistrement des scores et classements (tous temps et du jour)
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';

export const rushRouter = Router();
const MODES = new Set(['3', '5', 'survival']);

rushRouter.get('/top', async (req, res) => {
  const mode = String(req.query.mode ?? '3');
  if (!MODES.has(mode)) return res.status(400).json({ error: 'Mode inconnu' });
  const best = (where) =>
    pool.query(
      `SELECT u.username, max(r.score) AS score FROM rush_scores r JOIN users u ON u.id = r.user_id
       WHERE r.mode = $1 ${where} GROUP BY u.username ORDER BY score DESC, u.username LIMIT 10`,
      [mode],
    );
  const [all, today] = await Promise.all([
    best(''),
    best(`AND (r.created_at AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date`),
  ]);
  const fmt = (rows) => rows.map((r) => ({ username: r.username, score: Number(r.score) }));
  res.json({ all: fmt(all.rows), today: fmt(today.rows) });
});

rushRouter.post('/', requireUser, async (req, res) => {
  const { mode, score } = req.body ?? {};
  if (!MODES.has(mode) || !Number.isInteger(score) || score < 0 || score > 300)
    return res.status(400).json({ error: 'Score invalide' });
  const prev = await pool.query('SELECT max(score) AS best FROM rush_scores WHERE user_id = $1 AND mode = $2', [
    req.user.id,
    mode,
  ]);
  await pool.query('INSERT INTO rush_scores (user_id, mode, score) VALUES ($1, $2, $3)', [req.user.id, mode, score]);
  const rank = await pool.query(
    `SELECT count(*) + 1 AS rank FROM (SELECT user_id, max(score) AS s FROM rush_scores WHERE mode = $1 GROUP BY user_id) t
     WHERE t.s > $2`,
    [mode, Math.max(score, Number(prev.rows[0]?.best ?? 0))],
  );
  res.json({ ok: true, rank: Number(rank.rows[0].rank) });
});
