// Parties en ligne entre amis : coups valides par le serveur, pendules calculees cote serveur.
import { Router } from 'express';
import { applyResult, onlineRating, PROVISIONAL_GAMES, stakesFor } from './rating.js';
import { censor } from './moderation.js';
import { Chess } from 'chess.js';
import { pool } from './db.js';
import { requireUser } from './auth.js';

export const onlineRouter = Router();
onlineRouter.use(requireUser);

/** Cree une partie (dans une transaction ouverte par l'appelant) */
export async function createGame(client, { white, black, initial, increment, rated = false }) {
  const w = rated ? await onlineRating(client, white) : null;
  const b = rated ? await onlineRating(client, black) : null;
  const wr = w ? Math.round(w.rating) : null;
  const br = b ? Math.round(b.rating) : null;
  // Elo en jeu pour chacun (affiche pendant la partie)
  const stakes = w && b ? { w: { ...stakesFor(w, b), provisional: w.games < PROVISIONAL_GAMES }, b: { ...stakesFor(b, w), provisional: b.games < PROVISIONAL_GAMES } } : null;
  const { rows } = await client.query(
    `INSERT INTO online_games (white_id, black_id, initial_ms, increment_ms, white_ms, black_ms, rated, white_rating, black_rating, stakes)
     VALUES ($1, $2, $3, $4, $3, $3, $5, $6, $7, $8) RETURNING id`,
    [white, black, initial, increment, rated, wr, br, stakes ? JSON.stringify(stakes) : null],
  );
  return Number(rows[0].id);
}

const replay = (moves) => {
  const c = new Chess();
  for (const u of moves) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return c;
};
const listOf = (g) => (g.moves ? g.moves.split(' ') : []);

/** Temps restants a l'instant present (la pendule du camp au trait tourne a partir du 2e coup) */
function clocks(g, now = Date.now()) {
  if (g.initial_ms === null) return null;
  const n = listOf(g).length;
  const turn = n % 2 === 0 ? 'w' : 'b';
  let w = g.white_ms;
  let b = g.black_ms;
  if (g.status === 'active' && n >= 2) {
    const spent = now - new Date(g.turn_started_at).getTime();
    if (turn === 'w') w -= spent;
    else b -= spent;
  }
  return { w: Math.max(0, w), b: Math.max(0, b), turn };
}

async function load(client, id, lock = false) {
  const { rows } = await client.query(
    `SELECT g.*, uw.username AS white_name, ub.username AS black_name,
       (SELECT value->'equipped'->>'pieces' FROM user_data WHERE user_id = g.white_id AND key = 'bettermove.shop.v1') AS white_pieces,
       (SELECT value->>'boardTheme' FROM user_data WHERE user_id = g.white_id AND key = 'bettermove.settings.v1') AS white_board,
       (SELECT value->'equipped'->>'pieces' FROM user_data WHERE user_id = g.black_id AND key = 'bettermove.shop.v1') AS black_pieces,
       (SELECT value->>'boardTheme' FROM user_data WHERE user_id = g.black_id AND key = 'bettermove.settings.v1') AS black_board
     FROM online_games g
     JOIN users uw ON uw.id = g.white_id JOIN users ub ON ub.id = g.black_id WHERE g.id = $1 ${lock ? 'FOR UPDATE OF g' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

async function finish(client, g, result, reason) {
  const c = clocks(g);
  await client.query(
    `UPDATE online_games SET status = 'over', result = $2, reason = $3, draw_offer = NULL, updated_at = now(),
       white_ms = COALESCE($4, white_ms), black_ms = COALESCE($5, black_ms) WHERE id = $1`,
    [g.id, result, reason, c ? Math.round(c.w) : null, c ? Math.round(c.b) : null],
  );
  // Partie classee terminee pour de vrai (pas annulee) : mise a jour de l'Elo en ligne
  const score = { '1-0': 1, '0-1': 0, '1/2-1/2': 0.5 }[result];
  if (g.rated && score !== undefined && g.white_delta === null) {
    const { dW, dB } = await applyResult(client, g, score);
    await client.query('UPDATE online_games SET white_delta = $2, black_delta = $3 WHERE id = $1', [g.id, dW, dB]);
  }
}

/** Delai sans premier coup avant d'annuler une partie (un joueur parti ne bloque pas l'autre) */
const NO_START_MS = 2 * 60_000;

/** Termine la partie si le camp au trait n'a plus de temps, ou l'annule si personne n'a commence */
async function checkFlag(client, g) {
  if (g.status === 'active' && listOf(g).length < 2 && Date.now() - new Date(g.turn_started_at).getTime() > NO_START_MS) {
    await finish(client, g, '*', 'Partie annulée : aucun coup joué');
    return true;
  }
  const c = clocks(g);
  if (g.status !== 'active' || !c) return false;
  const left = c.turn === 'w' ? c.w : c.b;
  if (left > 0) return false;
  const pos = replay(listOf(g));
  // Plus de temps, mais l'adversaire ne peut pas mater : nulle
  const winner = c.turn === 'w' ? 'b' : 'w';
  const board = pos.board().flat().filter((p) => p && p.color === winner && p.type !== 'k');
  const cantMate = board.length === 0 || (board.length === 1 && ['n', 'b'].includes(board[0].type));
  if (cantMate) await finish(client, g, '1/2-1/2', 'Temps écoulé, matériel insuffisant pour mater');
  else await finish(client, g, winner === 'w' ? '1-0' : '0-1', `Temps écoulé pour les ${c.turn === 'w' ? 'Blancs' : 'Noirs'}`);
  return true;
}

/**
 * Partie en ligne en cours d'un joueur (ou null). Les parties terminees au temps ou jamais commencees
 * sont cloturees au passage, pour qu'une vieille partie ne bloque pas le joueur.
 */
export async function activeGameOf(userId) {
  const { rows } = await pool.query(
    "SELECT id FROM online_games WHERE (white_id = $1 OR black_id = $1) AND status = 'active' ORDER BY id DESC",
    [userId],
  );
  for (const { id } of rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const g = await load(client, id, true);
      if (g && g.status === 'active') await checkFlag(client, g);
      const fresh = await load(client, id);
      await client.query('COMMIT');
      if (fresh?.status === 'active') {
        const opp = fresh.white_id === userId ? fresh.black_name : fresh.white_name;
        return { id: Number(fresh.id), opponent: opp, rated: !!fresh.rated };
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return null;
}

function view(g, me) {
  const moves = listOf(g);
  const pos = replay(moves);
  return {
    id: Number(g.id),
    white: g.white_name,
    black: g.black_name,
    you: g.white_id === me ? 'w' : g.black_id === me ? 'b' : null,
    moves,
    fen: pos.fen(),
    timed: g.initial_ms !== null,
    initial: g.initial_ms,
    increment: g.increment_ms,
    clocks: clocks(g),
    status: g.status,
    result: g.result,
    reason: g.reason,
    drawOffer: g.draw_offer,
    rated: !!g.rated,
    ratings: g.rated ? { w: g.white_rating, b: g.black_rating } : null,
    deltas: g.rated && g.white_delta !== null ? { w: g.white_delta, b: g.black_delta } : null,
    stakes: g.rated && g.stakes ? g.stakes : null,
    // Skins equipes de chaque joueur (affiches a la fin de la partie, chez le gagnant)
    skins: {
      w: { pieces: g.white_pieces ?? null, board: g.white_board ?? null },
      b: { pieces: g.black_pieces ?? null, board: g.black_board ?? null },
    },
    rematch: {
      w: !!g.rematch_w,
      b: !!g.rematch_b,
      declinedBy: g.rematch_declined ?? null,
      gameId: g.rematch_game_id ? Number(g.rematch_game_id) : null,
    },
    serverNow: Date.now(),
  };
}

/** Execute fn dans une transaction avec la partie verrouillee */
async function withGame(req, res, fn) {
  if (!/^\d{1,12}$/.test(String(req.params.id))) return res.status(404).json({ error: 'Partie introuvable' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const g = await load(client, Number(req.params.id), true);
    if (!g) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Partie introuvable' });
    }
    const color = g.white_id === req.user.id ? 'w' : g.black_id === req.user.id ? 'b' : null;
    const err = await fn(client, g, color);
    if (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: err });
    }
    const fresh = await load(client, g.id);
    await client.query('COMMIT');
    res.json(view(fresh, req.user.id));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ---------------- Chat de partie (parties classees uniquement) ---------------- */

const CHAT_MAX = 200;
const lastChat = new Map();

async function chatAccess(req) {
  if (!/^\d{1,12}$/.test(String(req.params.id))) return { error: [404, 'Partie introuvable'] };
  const { rows } = await pool.query('SELECT id, white_id, black_id, rated FROM online_games WHERE id = $1', [Number(req.params.id)]);
  const g = rows[0];
  if (!g) return { error: [404, 'Partie introuvable'] };
  const me = req.user.id;
  if (g.white_id !== me && g.black_id !== me) return { error: [403, 'Tu ne joues pas cette partie'] };
  if (!g.rated) return { error: [403, 'Entre amis, utilise les messages privés'] };
  const opp = g.white_id === me ? g.black_id : g.white_id;
  const muted = await pool.query('SELECT 1 FROM mutes WHERE user_id = $1 AND muted_id = $2', [me, opp]).catch(() => ({ rowCount: 0 }));
  return { g, opp, muted: muted.rowCount > 0 };
}

onlineRouter.get('/:id/chat', async (req, res) => {
  const a = await chatAccess(req);
  if (a.error) return res.status(a.error[0]).json({ error: a.error[1] });
  const after = Number(req.query.after ?? 0) || 0;
  const { rows } = await pool.query(
    `SELECT m.id, m.text, m.censored, m.created_at, u.username, m.user_id FROM game_messages m JOIN users u ON u.id = m.user_id
     WHERE m.game_id = $1 AND m.id > $2 ORDER BY m.id ASC LIMIT 100`,
    [a.g.id, after],
  );
  res.json({
    messages: rows
      // Adversaire en sourdine : on ne montre pas ses messages
      .filter((r) => !(a.muted && r.user_id === a.opp))
      .map((r) => ({ id: Number(r.id), user: r.username, mine: r.user_id === req.user.id, text: r.text, censored: r.censored, at: r.created_at })),
  });
});

onlineRouter.post('/:id/chat', async (req, res) => {
  const a = await chatAccess(req);
  if (a.error) return res.status(a.error[0]).json({ error: a.error[1] });
  const now = Date.now();
  if (now - (lastChat.get(req.user.id) ?? 0) < 1000) return res.status(429).json({ error: 'Doucement : un message par seconde.' });
  const raw = typeof req.body?.text === 'string' ? req.body.text.replace(/\s+/g, ' ').trim() : '';
  if (!raw) return res.status(400).json({ error: 'Message vide' });
  if (raw.length > CHAT_MAX) return res.status(400).json({ error: `${CHAT_MAX} caractères maximum` });
  lastChat.set(req.user.id, now);
  const { text, hits } = censor(raw);
  const { rows } = await pool.query(
    'INSERT INTO game_messages (game_id, user_id, text, censored) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
    [a.g.id, req.user.id, text, hits > 0],
  );
  res.json({
    message: { id: Number(rows[0].id), user: req.user.username, mine: true, text, censored: hits > 0, at: rows[0].created_at },
    warning: hits ? 'Langage inapproprié masqué.' : null,
  });
});

/** Partie en cours du joueur connecte (pour la reprendre en revenant sur la page) */
onlineRouter.get('/current', async (req, res) => {
  res.json({ game: await activeGameOf(req.user.id) });
});

onlineRouter.get('/:id', (req, res) =>
  withGame(req, res, async (client, g) => {
    await checkFlag(client, g);
    return null;
  }),
);

onlineRouter.post('/:id/move', (req, res) =>
  withGame(req, res, async (client, g, color) => {
    if (!color) return 'Tu ne joues pas cette partie';
    if (g.status !== 'active') return 'La partie est terminée';
    if (await checkFlag(client, g)) return null;
    const moves = listOf(g);
    const turn = moves.length % 2 === 0 ? 'w' : 'b';
    if (turn !== color) return 'Ce n’est pas ton tour';
    const uci = String(req.body?.uci ?? '');
    const pos = replay(moves);
    let m;
    const piece = pos.get(uci.slice(0, 2));
    const promo = piece?.type === 'p' && (uci[3] === '8' || uci[3] === '1') ? uci[4] || 'q' : undefined;
    try {
      m = pos.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: promo });
    } catch {
      return 'Coup illégal';
    }
    const played = m.lan;
    // Pendule : on retire le temps pense (a partir du 2e coup) puis on ajoute l'increment
    let w = g.white_ms;
    let b = g.black_ms;
    if (g.initial_ms !== null) {
      const spent = moves.length >= 2 ? Date.now() - new Date(g.turn_started_at).getTime() : 0;
      if (color === 'w') w = Math.max(0, w - spent) + (moves.length >= 2 ? g.increment_ms : 0);
      else b = Math.max(0, b - spent) + (moves.length >= 2 ? g.increment_ms : 0);
    }
    // Un coup de l'adversaire de celui qui propose nulle vaut refus
    const drawOffer = g.draw_offer && g.draw_offer !== color ? null : g.draw_offer;
    await client.query(
      `UPDATE online_games SET moves = $2, white_ms = $3, black_ms = $4, turn_started_at = now(), draw_offer = $5, updated_at = now()
       WHERE id = $1`,
      [g.id, [...moves, played].join(' '), w, b, drawOffer],
    );
    const g2 = { ...g, moves: [...moves, played].join(' '), white_ms: w, black_ms: b, turn_started_at: new Date() };
    if (pos.isCheckmate()) await finish(client, g2, color === 'w' ? '1-0' : '0-1', 'Échec et mat');
    else if (pos.isStalemate()) await finish(client, g2, '1/2-1/2', 'Pat');
    else if (pos.isInsufficientMaterial()) await finish(client, g2, '1/2-1/2', 'Matériel insuffisant');
    else if (pos.isThreefoldRepetition()) await finish(client, g2, '1/2-1/2', 'Triple répétition');
    else if (pos.isDrawByFiftyMoves()) await finish(client, g2, '1/2-1/2', 'Règle des 50 coups');
    return null;
  }),
);

onlineRouter.post('/:id/resign', (req, res) =>
  withGame(req, res, async (client, g, color) => {
    if (!color || g.status !== 'active') return 'Action impossible';
    // Avant le 2e coup : partie annulee plutot que perdue
    if (listOf(g).length < 2) await finish(client, g, '*', 'Partie annulée');
    else await finish(client, g, color === 'w' ? '0-1' : '1-0', `${color === 'w' ? g.white_name : g.black_name} abandonne`);
    return null;
  }),
);

onlineRouter.post('/:id/draw', (req, res) =>
  withGame(req, res, async (client, g, color) => {
    if (!color || g.status !== 'active') return 'Action impossible';
    if (g.draw_offer && g.draw_offer !== color) await finish(client, g, '1/2-1/2', 'Nulle par accord mutuel');
    else await client.query('UPDATE online_games SET draw_offer = $2, updated_at = now() WHERE id = $1', [g.id, color]);
    return null;
  }),
);

/* ---------------- Revanche ---------------- */

/** Proposer ou accepter la revanche. Quand les deux ont accepte : nouvelle partie, couleurs inversees. */
onlineRouter.post('/:id/rematch', async (req, res) => {
  if (!/^\d{1,12}$/.test(String(req.params.id))) return res.status(404).json({ error: 'Partie introuvable' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const g = await load(client, Number(req.params.id), true);
    const color = !g ? null : g.white_id === req.user.id ? 'w' : g.black_id === req.user.id ? 'b' : null;
    if (!g || !color) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Partie introuvable' });
    }
    if (g.status !== 'over') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La partie n’est pas terminée' });
    }
    if (!g.rematch_game_id) {
      const otherWants = color === 'w' ? g.rematch_b : g.rematch_w;
      if (otherWants) {
        // Les deux joueurs doivent etre libres
        const busy = (await activeGameOf(g.white_id)) || (await activeGameOf(g.black_id));
        if (busy) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Un des deux joueurs est déjà dans une autre partie.' });
        }
        const id = await createGame(client, {
          white: g.black_id,
          black: g.white_id,
          initial: g.initial_ms,
          increment: g.increment_ms,
          rated: g.rated,
        });
        await client.query(`UPDATE online_games SET rematch_${color} = true, rematch_game_id = $2, rematch_at = now() WHERE id = $1`, [g.id, id]);
      } else {
        await client.query(`UPDATE online_games SET rematch_${color} = true, rematch_declined = NULL, rematch_at = now() WHERE id = $1`, [g.id]);
      }
    }
    const fresh = await load(client, g.id);
    await client.query('COMMIT');
    res.json(view(fresh, req.user.id));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** Retirer sa proposition, ou refuser celle de l'adversaire */
onlineRouter.post('/:id/rematch/decline', (req, res) =>
  withGame(req, res, async (client, g, color) => {
    if (!color || g.status !== 'over' || g.rematch_game_id) return 'Action impossible';
    await client.query('UPDATE online_games SET rematch_w = false, rematch_b = false, rematch_declined = $2 WHERE id = $1', [g.id, color]);
    return null;
  }),
);

onlineRouter.post('/:id/decline-draw', (req, res) =>
  withGame(req, res, async (client, g, color) => {
    if (!color) return 'Action impossible';
    if (g.draw_offer && g.draw_offer !== color) await client.query('UPDATE online_games SET draw_offer = NULL WHERE id = $1', [g.id]);
    return null;
  }),
);
