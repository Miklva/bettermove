// Social : amis, sourdines, messages prives, defis entre amis et notifications.
import { Router } from 'express';
import { pool } from './db.js';
import { requireUser } from './auth.js';
import { censor } from './moderation.js';
import { activeGameOf, createGame } from './online.js';

export const socialRouter = Router();
socialRouter.use(requireUser);

// Presence : chaque requete authentifiee met a jour "vu a" (au plus une fois par minute)
const seen = new Map();
socialRouter.use((req, _res, next) => {
  const now = Date.now();
  if (now - (seen.get(req.user.id) ?? 0) > 60_000) {
    seen.set(req.user.id, now);
    pool.query('UPDATE users SET last_seen = now() WHERE id = $1', [req.user.id]).catch(() => undefined);
  }
  next();
});

const ONLINE_SQL = "(u.last_seen > now() - interval '3 minutes')";

async function userByName(name) {
  const { rows } = await pool.query('SELECT id, username FROM users WHERE lower(username) = lower($1)', [String(name)]);
  return rows[0] ?? null;
}

async function areFriends(a, b) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM friendships WHERE status = 'accepted'
     AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
    [a, b],
  );
  return rowCount > 0;
}

async function hasMuted(userId, otherId) {
  const { rowCount } = await pool.query('SELECT 1 FROM mutes WHERE user_id = $1 AND muted_id = $2', [userId, otherId]);
  return rowCount > 0;
}

/* ---------------- Profil d'un joueur (menu du salon) ---------------- */

socialRouter.get('/users/:name', async (req, res) => {
  const u = await userByName(req.params.name);
  if (!u) return res.status(404).json({ error: 'Joueur introuvable' });
  const { rows } = await pool.query(
    `SELECT requester_id, status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [req.user.id, u.id],
  );
  const f = rows[0];
  const friend = !f ? 'none' : f.status === 'accepted' ? 'friends' : f.requester_id === req.user.id ? 'sent' : 'received';
  res.json({ username: u.username, friend, muted: await hasMuted(req.user.id, u.id), self: u.id === req.user.id });
});

/* ---------------- Amis ---------------- */

socialRouter.get('/friends', async (req, res) => {
  const me = req.user.id;
  const { rows } = await pool.query(
    `SELECT f.status, f.requester_id, u.username, ${ONLINE_SQL} AS online, u.last_seen
     FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.requester_id = $1 OR f.addressee_id = $1
     ORDER BY u.username`,
    [me],
  );
  res.json({
    friends: rows.filter((r) => r.status === 'accepted').map((r) => ({ username: r.username, online: r.online, lastSeen: r.last_seen })),
    incoming: rows.filter((r) => r.status === 'pending' && r.requester_id !== me).map((r) => r.username),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requester_id === me).map((r) => r.username),
  });
});

socialRouter.post('/friends', async (req, res) => {
  const u = await userByName(req.body?.username);
  if (!u) return res.status(404).json({ error: 'Joueur introuvable' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas t’ajouter toi-même' });
  // Demande inverse deja en attente : on accepte directement
  const back = await pool.query(
    "UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'",
    [u.id, req.user.id],
  );
  if (back.rowCount) return res.json({ status: 'friends' });
  if (await hasMuted(u.id, req.user.id)) return res.json({ status: 'sent' }); // silencieux si on est en sourdine chez lui
  // Anti-spam : 50 demandes en attente au maximum
  const { rows: out } = await pool.query("SELECT count(*)::int AS n FROM friendships WHERE requester_id = $1 AND status = 'pending'", [
    req.user.id,
  ]);
  if (out[0].n >= 50) return res.status(429).json({ error: 'Trop de demandes en attente : attends qu’elles soient acceptées.' });
  await pool.query(
    'INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.id, u.id],
  );
  res.status(201).json({ status: 'sent' });
});

socialRouter.post('/friends/:name/accept', async (req, res) => {
  const u = await userByName(req.params.name);
  if (!u) return res.status(404).json({ error: 'Joueur introuvable' });
  const r = await pool.query(
    "UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'",
    [u.id, req.user.id],
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Demande introuvable' });
  res.json({ status: 'friends' });
});

/** Refuser une demande, annuler la sienne ou retirer un ami */
socialRouter.delete('/friends/:name', async (req, res) => {
  const u = await userByName(req.params.name);
  if (!u) return res.status(404).json({ error: 'Joueur introuvable' });
  await pool.query(
    'DELETE FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)',
    [req.user.id, u.id],
  );
  res.json({ ok: true });
});

/* ---------------- Sourdine ---------------- */

socialRouter.get('/mutes', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT u.username FROM mutes m JOIN users u ON u.id = m.muted_id WHERE m.user_id = $1 ORDER BY u.username',
    [req.user.id],
  );
  res.json({ muted: rows.map((r) => r.username) });
});

socialRouter.post('/mutes', async (req, res) => {
  const u = await userByName(req.body?.username);
  if (!u || u.id === req.user.id) return res.status(400).json({ error: 'Joueur invalide' });
  await pool.query('INSERT INTO mutes (user_id, muted_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, u.id]);
  res.json({ ok: true });
});

socialRouter.delete('/mutes/:name', async (req, res) => {
  const u = await userByName(req.params.name);
  if (u) await pool.query('DELETE FROM mutes WHERE user_id = $1 AND muted_id = $2', [req.user.id, u.id]);
  res.json({ ok: true });
});

/* ---------------- Messages prives ---------------- */

socialRouter.get('/dm', async (req, res) => {
  const me = req.user.id;
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (other) other, u.username, d.text, d.created_at, d.from_id,
       (SELECT count(*) FROM direct_messages x WHERE x.from_id = other AND x.to_id = $1 AND x.read_at IS NULL) AS unread,
       ${ONLINE_SQL} AS online
     FROM (SELECT *, CASE WHEN from_id = $1 THEN to_id ELSE from_id END AS other FROM direct_messages
           WHERE from_id = $1 OR to_id = $1) d
     JOIN users u ON u.id = d.other
     WHERE d.other NOT IN (SELECT muted_id FROM mutes WHERE user_id = $1)
     ORDER BY other, d.id DESC`,
    [me],
  );
  const list = rows
    .map((r) => ({
      username: r.username,
      last: r.text,
      lastFromMe: r.from_id === me,
      at: r.created_at,
      unread: Number(r.unread),
      online: r.online,
    }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ conversations: list });
});

socialRouter.get('/dm/:name', async (req, res) => {
  const u = await userByName(req.params.name);
  if (!u) return res.status(404).json({ error: 'Joueur introuvable' });
  const after = Number(req.query.after ?? 0) || 0;
  const { rows } = await pool.query(
    `SELECT id, from_id, text, censored, created_at FROM direct_messages
     WHERE ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)) AND id > $3
     ORDER BY id DESC LIMIT 200`,
    [req.user.id, u.id, after],
  );
  await pool.query('UPDATE direct_messages SET read_at = now() WHERE from_id = $1 AND to_id = $2 AND read_at IS NULL', [
    u.id,
    req.user.id,
  ]);
  res.json({
    messages: rows.reverse().map((r) => ({ id: Number(r.id), mine: r.from_id === req.user.id, text: r.text, censored: r.censored, at: r.created_at })),
  });
});

const lastDm = new Map();
socialRouter.post('/dm/:name', async (req, res) => {
  const u = await userByName(req.params.name);
  if (!u || u.id === req.user.id) return res.status(404).json({ error: 'Joueur introuvable' });
  const now = Date.now();
  if (now - (lastDm.get(req.user.id) ?? 0) < 1000) return res.status(429).json({ error: 'Doucement : un message par seconde.' });
  const raw = typeof req.body?.text === 'string' ? req.body.text.replace(/\s+/g, ' ').trim() : '';
  if (!raw || raw.length > 1000) return res.status(400).json({ error: 'Message vide ou trop long (1000 caractères max)' });
  if (await hasMuted(u.id, req.user.id)) return res.status(403).json({ error: 'Ce joueur ne reçoit pas tes messages.' });
  // Protection contre le harcelement : sans etre amis, 3 messages au plus tant que l'autre n'a pas repondu
  if (!(await areFriends(req.user.id, u.id))) {
    const { rows: c } = await pool.query(
      `SELECT count(*) FILTER (WHERE from_id = $1)::int AS sent, count(*) FILTER (WHERE from_id = $2)::int AS got
       FROM direct_messages WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)`,
      [req.user.id, u.id],
    );
    if (c[0].got === 0 && c[0].sent >= 3)
      return res.status(403).json({ error: 'Attends sa réponse ou devenez amis pour continuer à lui écrire.' });
  }
  lastDm.set(req.user.id, now);
  const { text, hits } = censor(raw);
  const { rows } = await pool.query(
    'INSERT INTO direct_messages (from_id, to_id, text, censored) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
    [req.user.id, u.id, text, hits > 0],
  );
  res.status(201).json({ message: { id: Number(rows[0].id), mine: true, text, censored: hits > 0, at: rows[0].created_at } });
});

/* ---------------- Defis entre amis ---------------- */

socialRouter.get('/challenges', async (req, res) => {
  const me = req.user.id;
  const { rows } = await pool.query(
    `SELECT c.*, uf.username AS from_name, ut.username AS to_name FROM challenges c
     JOIN users uf ON uf.id = c.from_id JOIN users ut ON ut.id = c.to_id
     WHERE (c.from_id = $1 OR c.to_id = $1) AND c.status = 'pending' AND c.created_at > now() - interval '1 day'
     ORDER BY c.id DESC`,
    [me],
  );
  const { rows: games } = await pool.query(
    `SELECT g.id, uw.username AS white, ub.username AS black, g.white_id FROM online_games g
     JOIN users uw ON uw.id = g.white_id JOIN users ub ON ub.id = g.black_id
     WHERE (g.white_id = $1 OR g.black_id = $1) AND g.status = 'active' ORDER BY g.id DESC`,
    [me],
  );
  const view = (c) => ({
    id: Number(c.id),
    from: c.from_name,
    to: c.to_name,
    initial: c.initial_ms,
    increment: c.increment_ms,
    color: c.color,
  });
  res.json({
    incoming: rows.filter((c) => c.to_id === me).map(view),
    outgoing: rows.filter((c) => c.from_id === me).map(view),
    games: games.map((g) => ({ id: Number(g.id), opponent: g.white_id === me ? g.black : g.white, color: g.white_id === me ? 'w' : 'b' })),
  });
});

socialRouter.post('/challenges', async (req, res) => {
  const u = await userByName(req.body?.username);
  if (!u || u.id === req.user.id) return res.status(404).json({ error: 'Joueur introuvable' });
  if (await activeGameOf(req.user.id))
    return res.status(409).json({ error: 'Tu as déjà une partie en ligne en cours : termine-la avant de défier quelqu’un.' });
  if (!(await areFriends(req.user.id, u.id))) return res.status(403).json({ error: 'Vous devez être amis pour vous défier.' });
  if (await hasMuted(u.id, req.user.id)) return res.status(403).json({ error: 'Ce joueur ne reçoit pas tes défis.' });
  const initial = req.body?.initial === null ? null : Math.max(30_000, Math.min(3 * 3600_000, Number(req.body?.initial) || 600_000));
  const increment = Math.max(0, Math.min(60_000, Number(req.body?.increment) || 0));
  const color = ['w', 'b', 'random'].includes(req.body?.color) ? req.body.color : 'random';
  // Un seul defi en attente par paire
  await pool.query("UPDATE challenges SET status = 'cancelled' WHERE from_id = $1 AND to_id = $2 AND status = 'pending'", [req.user.id, u.id]);
  const { rows } = await pool.query(
    'INSERT INTO challenges (from_id, to_id, initial_ms, increment_ms, color) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [req.user.id, u.id, initial, increment, color],
  );
  res.status(201).json({ id: Number(rows[0].id) });
});

socialRouter.post('/challenges/:id/accept', async (req, res) => {
  if (!/^\d{1,12}$/.test(String(req.params.id))) return res.status(404).json({ error: 'Défi introuvable' });
  const pending = await pool.query('SELECT from_id FROM challenges WHERE id = $1', [Number(req.params.id)]);
  if (await activeGameOf(req.user.id))
    return res.status(409).json({ error: 'Tu as déjà une partie en ligne en cours : termine-la d’abord.' });
  if (pending.rows[0] && (await activeGameOf(pending.rows[0].from_id)))
    return res.status(409).json({ error: 'Ton ami est déjà en pleine partie. Réessaie quand il aura fini.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "SELECT * FROM challenges WHERE id = $1 AND to_id = $2 AND status = 'pending' FOR UPDATE",
      [Number(req.params.id), req.user.id],
    );
    const c = rows[0];
    if (!c) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Défi expiré ou annulé' });
    }
    const challengerWhite = c.color === 'w' || (c.color === 'random' && Math.random() < 0.5);
    const gameId = await createGame(client, {
      white: challengerWhite ? c.from_id : c.to_id,
      black: challengerWhite ? c.to_id : c.from_id,
      initial: c.initial_ms,
      increment: c.increment_ms,
    });
    await client.query("UPDATE challenges SET status = 'accepted', game_id = $2 WHERE id = $1", [c.id, gameId]);
    await client.query('COMMIT');
    res.json({ gameId });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** Refuser (destinataire) ou annuler (auteur) un defi */
socialRouter.delete('/challenges/:id', async (req, res) => {
  await pool.query(
    "UPDATE challenges SET status = CASE WHEN to_id = $2 THEN 'declined' ELSE 'cancelled' END WHERE id = $1 AND (from_id = $2 OR to_id = $2) AND status = 'pending'",
    [Number(req.params.id), req.user.id],
  );
  res.json({ ok: true });
});

/** Etat d'un defi envoye (pour rejoindre la partie des qu'il est accepte) */
socialRouter.get('/challenges/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT status, game_id FROM challenges WHERE id = $1 AND from_id = $2', [
    Number(req.params.id),
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Défi introuvable' });
  res.json({ status: rows[0].status, gameId: rows[0].game_id ? Number(rows[0].game_id) : null });
});

/* ---------------- Notifications ---------------- */

socialRouter.get('/notifications', async (req, res) => {
  const me = req.user.id;
  const [dm, fr, ch, games, accepted, rematchOffers, rematchDone] = await Promise.all([
    pool.query(
      'SELECT count(*) FROM direct_messages WHERE to_id = $1 AND read_at IS NULL AND from_id NOT IN (SELECT muted_id FROM mutes WHERE user_id = $1)',
      [me],
    ),
    pool.query("SELECT count(*) FROM friendships WHERE addressee_id = $1 AND status = 'pending'", [me]),
    pool.query(
      `SELECT c.id, u.username FROM challenges c JOIN users u ON u.id = c.from_id
       WHERE c.to_id = $1 AND c.status = 'pending' AND c.created_at > now() - interval '1 day' ORDER BY c.id DESC`,
      [me],
    ),
    pool.query("SELECT id FROM online_games WHERE (white_id = $1 OR black_id = $1) AND status = 'active' ORDER BY id DESC", [me]),
    // Defis envoyes acceptes recemment : l'auteur rejoint la partie
    pool.query(
      "SELECT game_id FROM challenges WHERE from_id = $1 AND status = 'accepted' AND created_at > now() - interval '1 day' ORDER BY id DESC LIMIT 5",
      [me],
    ),
    // Revanches proposees par l'adversaire (moins de 2 minutes) : pop-up pour accepter ou refuser
    pool.query(
      `SELECT g.id, u.username FROM online_games g
       JOIN users u ON u.id = CASE WHEN g.white_id = $1 THEN g.black_id ELSE g.white_id END
       WHERE g.status = 'over' AND g.rematch_game_id IS NULL AND g.rematch_at > now() - interval '2 minutes'
         AND ((g.white_id = $1 AND g.rematch_b AND NOT g.rematch_w) OR (g.black_id = $1 AND g.rematch_w AND NOT g.rematch_b))
       ORDER BY g.id DESC LIMIT 3`,
      [me],
    ),
    // Revanches acceptees recemment : la nouvelle partie a rejoindre
    pool.query(
      `SELECT rematch_game_id FROM online_games
       WHERE (white_id = $1 OR black_id = $1) AND rematch_game_id IS NOT NULL AND rematch_at > now() - interval '2 minutes'`,
      [me],
    ),
  ]);
  res.json({
    unreadDm: Number(dm.rows[0].count),
    friendRequests: Number(fr.rows[0].count),
    challenges: ch.rows.map((r) => ({ id: Number(r.id), from: r.username })),
    activeGames: games.rows.map((r) => Number(r.id)),
    acceptedGames: [...accepted.rows.map((r) => Number(r.game_id)), ...rematchDone.rows.map((r) => Number(r.rematch_game_id))].filter(Boolean),
    rematchOffers: rematchOffers.rows.map((r) => ({ gameId: Number(r.id), from: r.username })),
  });
});
