// Communaute : salon de discussion general (lecture par sondage, ecriture reservee aux comptes)
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';
import { censor, isAdmin } from './moderation.js';

export const chatRouter = Router();

const MAX_LEN = 400;
// Un salon par langue de l'app
const ROOMS = ['fr', 'en', 'es', 'pt', 'de', 'ru'];
const roomOf = (v) => (ROOMS.includes(String(v)) ? String(v) : 'fr');

// Anti-spam et sanctions en memoire : 1 message toutes les 2 s, mute de 10 min apres 3 avertissements
const lastPost = new Map();
const strikes = new Map();
const mutedUntil = new Map();

const row = (r) => ({
  id: Number(r.id),
  user: r.username,
  text: r.deleted ? null : r.text,
  censored: r.censored,
  deleted: r.deleted,
  at: r.created_at,
});

/** Derniers messages, ou ceux apres `after` (id) pour le rafraichissement */
chatRouter.get('/', async (req, res) => {
  const after = Number(req.query.after ?? 0) || 0;
  const room = roomOf(req.query.room);
  const { rows } = after
    ? await pool.query('SELECT * FROM chat_messages WHERE room = $2 AND id > $1 ORDER BY id ASC LIMIT 200', [after, room])
    : await pool.query('SELECT * FROM (SELECT * FROM chat_messages WHERE room = $1 ORDER BY id DESC LIMIT 100) t ORDER BY id ASC', [room]);
  // Messages supprimes depuis : on renvoie les ids pour les retirer cote client
  const { rows: del } = await pool.query(
    "SELECT id FROM chat_messages WHERE deleted AND created_at > now() - interval '1 day' ORDER BY id DESC LIMIT 200",
  );
  res.json({ messages: rows.map(row), deleted: del.map((d) => Number(d.id)) });
});

chatRouter.post('/', requireUser, async (req, res) => {
  const uid = req.user.id;
  const now = Date.now();
  if ((mutedUntil.get(uid) ?? 0) > now) {
    const min = Math.ceil((mutedUntil.get(uid) - now) / 60000);
    return res.status(403).json({ error: `Tu es en sourdine encore ${min} min pour langage inapproprié.` });
  }
  if (now - (lastPost.get(uid) ?? 0) < 2000) return res.status(429).json({ error: 'Doucement : un message toutes les 2 secondes.' });
  const raw = typeof req.body?.text === 'string' ? req.body.text.replace(/\s+/g, ' ').trim() : '';
  if (!raw) return res.status(400).json({ error: 'Message vide' });
  if (raw.length > MAX_LEN) return res.status(400).json({ error: `${MAX_LEN} caractères maximum` });

  const { text, hits } = censor(raw);
  let warning = null;
  if (hits) {
    const list = (strikes.get(uid) ?? []).filter((t) => now - t < 30 * 60 * 1000);
    list.push(now);
    strikes.set(uid, list);
    if (list.length >= 3) {
      mutedUntil.set(uid, now + 10 * 60 * 1000);
      strikes.set(uid, []);
      warning = 'Langage inapproprié : tu es en sourdine pendant 10 minutes.';
    } else warning = `Langage inapproprié masqué. Avertissement ${list.length}/3 avant une sourdine de 10 minutes.`;
  }
  lastPost.set(uid, now);
  const { rows } = await pool.query(
    'INSERT INTO chat_messages (user_id, username, text, censored, room) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [uid, req.user.username, text, hits > 0, roomOf(req.body?.room)],
  );
  res.status(201).json({ message: row(rows[0]), warning });
});

chatRouter.delete('/:id', requireUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Message introuvable' });
  // Chacun peut supprimer ses messages, les administrateurs tous les messages
  const { rowCount } = isAdmin(req.user.username)
    ? await pool.query('UPDATE chat_messages SET deleted = true WHERE id = $1', [id])
    : await pool.query('UPDATE chat_messages SET deleted = true WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!rowCount) return res.status(404).json({ error: 'Message introuvable' });
  res.json({ ok: true });
});
