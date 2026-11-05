// Probleme du jour : statistiques communes (combien l'ont tente, reussi du premier coup...)
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { requireUser, JWT_SECRET } from './auth.js';

export const dailyRouter = Router();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function viewer(req) {
  try {
    return jwt.verify(req.cookies?.bm_session ?? '', JWT_SECRET).uid;
  } catch {
    return null;
  }
}

dailyRouter.get('/:day', async (req, res) => {
  if (!DAY.test(req.params.day)) return res.status(400).json({ error: 'Date invalide' });
  const { rows } = await pool.query(
    `SELECT count(*) AS players, count(*) FILTER (WHERE solved) AS solved, count(*) FILTER (WHERE first_try) AS first_try,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds) FILTER (WHERE first_try) AS median
     FROM daily_results WHERE day = $1 AND done`,
    [req.params.day],
  );
  const me = viewer(req);
  let mine = null;
  if (me) {
    const r = await pool.query('SELECT solved, first_try, seconds FROM daily_results WHERE day = $1 AND user_id = $2', [req.params.day, me]);
    mine = r.rows[0] ?? null;
  }
  const r = rows[0];
  res.json({
    players: Number(r.players),
    solved: Number(r.solved),
    firstTry: Number(r.first_try),
    medianSeconds: r.median === null ? null : Math.round(r.median),
    mine,
  });
});

/**
 * Deroulement d'une tentative (une seule par jour et par joueur) :
 *  - /start a l'affichage du probleme : le chrono demarre cote serveur ;
 *  - /event a chaque faute ou indice ;
 *  - POST /:day a la fin (resolu ou solution affichee).
 * Recharger la page ne remet donc ni le chrono ni les fautes a zero.
 */
dailyRouter.post('/:day/start', requireUser, async (req, res) => {
  if (!DAY.test(req.params.day)) return res.status(400).json({ error: 'Date invalide' });
  await pool.query(
    `INSERT INTO daily_results (day, user_id, puzzle_id, solved, first_try, seconds, mistakes, hints, started_at, done)
     VALUES ($1, $2, $3, false, false, NULL, 0, 0, now(), false) ON CONFLICT (day, user_id) DO NOTHING`,
    [req.params.day, req.user.id, String(req.body?.puzzleId ?? '').slice(0, 40)],
  );
  const { rows } = await pool.query(
    'SELECT done, solved, mistakes, hints, seconds FROM daily_results WHERE day = $1 AND user_id = $2',
    [req.params.day, req.user.id],
  );
  res.json(rows[0]);
});

dailyRouter.post('/:day/event', requireUser, async (req, res) => {
  const col = req.body?.type === 'hint' ? 'hints' : req.body?.type === 'mistake' ? 'mistakes' : null;
  if (!DAY.test(req.params.day) || !col) return res.status(400).json({ error: 'Requête invalide' });
  await pool.query(`UPDATE daily_results SET ${col} = ${col} + 1 WHERE day = $1 AND user_id = $2 AND NOT done`, [
    req.params.day,
    req.user.id,
  ]);
  res.json({ ok: true });
});

/** Fin de la tentative. Sans /start (ancien client), on garde le resultat envoye. */
dailyRouter.post('/:day', requireUser, async (req, res) => {
  if (!DAY.test(req.params.day)) return res.status(400).json({ error: 'Date invalide' });
  const b = req.body ?? {};
  const solved = !!b.solved;
  const upd = await pool.query(
    `UPDATE daily_results SET done = true, solved = $3,
       seconds = LEAST(86400, GREATEST(0, round(extract(epoch FROM now() - started_at))))::int,
       first_try = ($3 AND mistakes = 0 AND hints = 0)
     WHERE day = $1 AND user_id = $2 AND NOT done RETURNING mistakes, hints, seconds`,
    [req.params.day, req.user.id, solved],
  );
  if (!upd.rowCount)
    await pool.query(
      `INSERT INTO daily_results (day, user_id, puzzle_id, solved, first_try, seconds, mistakes, hints, done)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) ON CONFLICT (day, user_id) DO NOTHING`,
      [
        req.params.day,
        req.user.id,
        String(b.puzzleId ?? '').slice(0, 40),
        solved,
        !!b.firstTry,
        Math.max(0, Math.min(3600, Number(b.seconds) || 0)),
        Math.max(0, Number(b.mistakes) || 0),
        Math.max(0, Number(b.hints) || 0),
      ],
    );
  res.json({ ok: true, result: upd.rows[0] ?? null });
});

/** Classement du jour : resolu d'abord, puis le moins de fautes (un indice compte comme une faute), puis le temps */
dailyRouter.get('/:day/leaderboard', async (req, res) => {
  if (!DAY.test(req.params.day)) return res.status(400).json({ error: 'Date invalide' });
  const { rows } = await pool.query(
    `SELECT u.username, r.mistakes, r.hints, r.seconds,
       row_number() OVER (ORDER BY r.mistakes + r.hints, r.seconds NULLS LAST, r.created_at) AS rank
     FROM daily_results r JOIN users u ON u.id = r.user_id
     WHERE r.day = $1 AND r.done AND r.solved ORDER BY rank`,
    [req.params.day],
  );
  const failed = await pool.query('SELECT count(*) AS n FROM daily_results WHERE day = $1 AND done AND NOT solved', [
    req.params.day,
  ]);
  const me = viewerName(req);
  const list = rows.map((r) => ({
    rank: Number(r.rank),
    username: r.username,
    mistakes: Number(r.mistakes),
    hints: Number(r.hints),
    seconds: r.seconds === null ? null : Number(r.seconds),
  }));
  res.json({
    top: list.slice(0, 50),
    solved: list.length,
    failed: Number(failed.rows[0].n),
    me: me ? (list.find((x) => x.username.toLowerCase() === me.toLowerCase()) ?? null) : null,
  });
});

function viewerName(req) {
  try {
    return jwt.verify(req.cookies?.bm_session ?? '', JWT_SECRET).name;
  } catch {
    return null;
  }
}
