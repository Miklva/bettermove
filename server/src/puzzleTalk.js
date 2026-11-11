// Discussions sous les problemes : un joueur qui ne comprend pas la solution pose sa question,
// n'importe quel compte peut repondre. L'auteur de la question recoit la reponse en pop-up
// (via /api/social/notifications), l'admin voit tout dans son panneau.
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';
import { censor, isAdmin } from './moderation.js';

export const puzzleTalkRouter = Router();

const MAX_LEN = 600;
const PUZZLE_ID = /^[A-Za-z0-9]{3,12}$/;
const REF = /^\d+-\d+-[A-Za-z0-9]{3,12}$/;
const lastPost = new Map();

const row = (r) => ({
  id: Number(r.id),
  parent: r.parent_id ? Number(r.parent_id) : null,
  user: r.username,
  text: r.deleted ? null : r.text,
  deleted: r.deleted,
  at: r.created_at,
});

/** Nombre de messages par probleme (pour le bouton) */
puzzleTalkRouter.get('/count/:pid', async (req, res) => {
  const pid = String(req.params.pid);
  if (!PUZZLE_ID.test(pid)) return res.status(400).json({ error: 'Problème inconnu' });
  const { rows } = await pool.query('SELECT count(*) FROM puzzle_comments WHERE puzzle_id = $1 AND NOT deleted', [pid]);
  res.json({ count: Number(rows[0].count) });
});

/** Fil complet d'un probleme : questions avec leurs reponses */
puzzleTalkRouter.get('/:pid', async (req, res) => {
  const pid = String(req.params.pid);
  if (!PUZZLE_ID.test(pid)) return res.status(400).json({ error: 'Problème inconnu' });
  const { rows } = await pool.query('SELECT * FROM puzzle_comments WHERE puzzle_id = $1 ORDER BY id ASC LIMIT 500', [pid]);
  const all = rows.map(row);
  const questions = all
    .filter((m) => m.parent === null)
    .map((q) => ({ ...q, replies: all.filter((m) => m.parent === q.id) }))
    // Question supprimee sans reponse : on ne l'affiche plus
    .filter((q) => !q.deleted || q.replies.some((r) => !r.deleted));
  res.json({ questions });
});

/** Nouvelle question (sans parent) ou reponse (parent = id de la question) */
puzzleTalkRouter.post('/:pid', requireUser, async (req, res) => {
  const pid = String(req.params.pid);
  if (!PUZZLE_ID.test(pid)) return res.status(400).json({ error: 'Problème inconnu' });
  const uid = req.user.id;
  const now = Date.now();
  if (now - (lastPost.get(uid) ?? 0) < 8000) return res.status(429).json({ error: 'Doucement : un message toutes les 8 secondes.' });
  const raw = typeof req.body?.text === 'string' ? req.body.text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (raw.length < 3) return res.status(400).json({ error: 'Message trop court' });
  if (raw.length > MAX_LEN) return res.status(400).json({ error: `${MAX_LEN} caractères maximum` });
  const ref = typeof req.body?.ref === 'string' && REF.test(req.body.ref) ? req.body.ref : null;

  let parent = null;
  if (req.body?.parent != null) {
    parent = Number(req.body.parent);
    const { rows } = await pool.query('SELECT id FROM puzzle_comments WHERE id = $1 AND puzzle_id = $2 AND parent_id IS NULL', [parent, pid]);
    if (!rows[0]) return res.status(404).json({ error: 'Question introuvable' });
  }
  const { text, hits } = censor(raw);
  const { rows } = await pool.query(
    `INSERT INTO puzzle_comments (puzzle_id, puzzle_ref, parent_id, user_id, username, text, censored)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [pid, ref, parent, uid, req.user.username, text, hits > 0],
  );
  lastPost.set(uid, now);
  res.status(201).json({ message: row(rows[0]) });
});

/** Suppression : l'auteur ou un admin */
puzzleTalkRouter.delete('/message/:id', requireUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Message inconnu' });
  const admin = isAdmin(req.user.username);
  const { rowCount } = await pool.query(
    `UPDATE puzzle_comments SET deleted = true WHERE id = $1 AND ($2 OR user_id = $3)`,
    [id, admin, req.user.id],
  );
  if (!rowCount) return res.status(404).json({ error: 'Message introuvable' });
  res.json({ ok: true });
});

/** Reponses vues : la pop-up ne revient plus */
puzzleTalkRouter.post('/notices/read', requireUser, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger).slice(0, 100);
  if (ids.length)
    await pool.query(
      `UPDATE puzzle_comments r SET asker_read = true FROM puzzle_comments q
       WHERE r.id = ANY($1) AND q.id = r.parent_id AND q.user_id = $2`,
      [ids, req.user.id],
    );
  res.json({ ok: true });
});

/** Reponses non lues aux questions du joueur (utilise par /social/notifications) */
export async function unreadPuzzleReplies(uid) {
  const { rows } = await pool.query(
    `SELECT r.id, r.username, r.text, r.created_at, q.puzzle_id, q.puzzle_ref, q.text AS question
     FROM puzzle_comments r JOIN puzzle_comments q ON q.id = r.parent_id
     WHERE q.user_id = $1 AND r.user_id IS DISTINCT FROM $1 AND NOT r.asker_read AND NOT r.deleted
     ORDER BY r.id ASC LIMIT 10`,
    [uid],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    from: r.username,
    text: r.text,
    question: r.question,
    puzzleId: r.puzzle_id,
    ref: r.puzzle_ref,
    at: r.created_at,
  }));
}
