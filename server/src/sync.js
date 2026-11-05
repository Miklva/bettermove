// Synchronisation : donnees de l'app (cle -> JSON) et parties
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';

export const syncRouter = Router();
syncRouter.use(requireUser);

const KEY = /^bettermove\.[a-zA-Z0-9._-]{1,60}$/;
const MAX_VALUE = 2_000_000; // octets JSON par cle
const MAX_KEYS = 120; // cles par compte (l'app en utilise une soixantaine)
const MAX_GAMES = 20_000; // parties par compte

/** Tout l'etat de l'utilisateur, ou seulement ce qui a change depuis `since` */
syncRouter.get('/', async (req, res) => {
  const since = Number(req.query.since ?? 0) || 0;
  const [data, games] = await Promise.all([
    pool.query('SELECT key, value, updated_at FROM user_data WHERE user_id = $1 AND updated_at > $2', [req.user.id, since]),
    pool.query('SELECT id, data, deleted, updated_at FROM games WHERE user_id = $1 AND updated_at > $2', [req.user.id, since]),
  ]);
  res.json({
    now: Date.now(),
    data: Object.fromEntries(data.rows.map((r) => [r.key, { value: r.value, updatedAt: Number(r.updated_at) }])),
    games: games.rows.map((r) => ({ id: r.id, data: r.data, deleted: r.deleted, updatedAt: Number(r.updated_at) })),
  });
});

/** Ecrit plusieurs cles d'un coup. La version la plus recente gagne. */
syncRouter.put('/data', async (req, res) => {
  const items = req.body?.items;
  if (!items || typeof items !== 'object') return res.status(400).json({ error: 'items requis' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const known = new Set(
      (await client.query('SELECT key FROM user_data WHERE user_id = $1', [req.user.id])).rows.map((r) => r.key),
    );
    for (const [key, item] of Object.entries(items)) {
      if (!KEY.test(key) || typeof item?.updatedAt !== 'number') continue;
      if (!known.has(key) && known.size >= MAX_KEYS) continue;
      known.add(key);
      if (JSON.stringify(item.value ?? null).length > MAX_VALUE) continue;
      await client.query(
        `INSERT INTO user_data (user_id, key, value, updated_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
         WHERE user_data.updated_at < EXCLUDED.updated_at`,
        [req.user.id, key, JSON.stringify(item.value ?? null), item.updatedAt],
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** Ajoute, met a jour ou supprime des parties */
syncRouter.put('/games', async (req, res) => {
  const upsert = Array.isArray(req.body?.upsert) ? req.body.upsert : [];
  const remove = Array.isArray(req.body?.remove) ? req.body.remove : [];
  const now = Date.now();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cnt } = await client.query('SELECT count(*)::int AS n FROM games WHERE user_id = $1', [req.user.id]);
    let room = MAX_GAMES - cnt[0].n;
    for (const g of upsert.slice(0, 2000)) {
      if (typeof g?.id !== 'string' || g.id.length > 120 || typeof g.pgn !== 'string' || g.pgn.length > 100_000) continue;
      if (room <= 0) break;
      room--;
      const played = typeof g.playedAt === 'string' && !Number.isNaN(Date.parse(g.playedAt)) ? g.playedAt : null;
      await client.query(
        `INSERT INTO games (user_id, id, data, source, result, played_at, deleted, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)
         ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source,
           result = EXCLUDED.result, played_at = EXCLUDED.played_at, deleted = false, updated_at = EXCLUDED.updated_at`,
        [req.user.id, g.id, JSON.stringify(g), g.source ?? null, g.result ?? null, played, now],
      );
    }
    for (const id of remove.slice(0, 2000)) {
      if (typeof id !== 'string') continue;
      await client.query('UPDATE games SET deleted = true, updated_at = $3 WHERE user_id = $1 AND id = $2', [
        req.user.id,
        id,
        now,
      ]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, now });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
