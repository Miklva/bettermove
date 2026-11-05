// Evenements de la communaute. Le premier : lancement (30 jours) avec parrainage.
// Le parrain partage son lien /invite/<pseudo> ; quand l'ami cree un compte, les deux recoivent des pieces
// et deux skins exclusifs. Les recompenses attendent dans pending_rewards jusqu'a ce que l'app les recupere.
import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { pool } from './db.js';
import { requireUser, sessionOf } from './auth.js';

export const eventsRouter = Router();

export const LAUNCH = {
  id: 'launch',
  days: 30,
  /** Pieces pour le filleul et pour le parrain (par ami) */
  coins: 100,
  /** Skins offerts aux deux (une seule fois) */
  items: ['pieces-parrainage', 'board-parrainage'],
  /** Amis recompenses au maximum par parrain (anti-abus) */
  maxRewarded: 10,
};

/* ---------------- Codes d'invitation ---------------- */

// Sans caracteres ambigus (0/O, 1/I/L) : 8 caracteres = plus de 10^11 possibilites
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE = /^[A-Z0-9]{6,12}$/;
const newCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Code d'invitation d'un joueur (cree a la premiere demande) */
export async function inviteCodeOf(userId) {
  const { rows } = await pool.query('SELECT invite_code FROM users WHERE id = $1', [userId]);
  if (rows[0]?.invite_code) return rows[0].invite_code;
  for (let i = 0; i < 5; i++) {
    try {
      const { rows: r } = await pool.query(
        'UPDATE users SET invite_code = $2 WHERE id = $1 AND invite_code IS NULL RETURNING invite_code',
        [userId, newCode()],
      );
      if (r[0]) return r[0].invite_code;
      const again = await pool.query('SELECT invite_code FROM users WHERE id = $1', [userId]);
      return again.rows[0]?.invite_code ?? null;
    } catch (e) {
      if (e.code !== '23505') throw e; // code deja pris : on en tire un autre
    }
  }
  return null;
}

// Essais de codes (anti force brute), par IP, en memoire
const tries = new Map();
function tooManyTries(ip, kind = 'code', max = 30) {
  const k = `${kind}:${ip}`;
  const now = Date.now();
  const list = (tries.get(k) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  tries.set(k, list);
  return list.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of tries) if (!list.some((t) => now - t < 60 * 60 * 1000)) tries.delete(k);
}, 10 * 60 * 1000).unref();

async function launchWindow() {
  const fromEnv = process.env.LAUNCH_EVENT_START;
  let start = fromEnv && !Number.isNaN(Date.parse(fromEnv)) ? new Date(fromEnv) : null;
  if (!start) {
    const { rows } = await pool.query("SELECT value FROM app_meta WHERE key = 'launch_start'");
    start = rows[0] ? new Date(rows[0].value) : new Date();
  }
  const end = new Date(start.getTime() + LAUNCH.days * 86400_000);
  const now = Date.now();
  return { start, end, active: now >= start.getTime() && now < end.getTime() };
}

/**
 * Rattache un filleul a son parrain et cree les recompenses des deux.
 * Renvoie un statut lisible : ok, none, inactive, unknown, self, already.
 */
export async function applyReferral(newUserId, refCode) {
  const code = typeof refCode === 'string' ? refCode.trim().toUpperCase() : '';
  if (!code) return 'none';
  if (!CODE.test(code)) return 'unknown';
  const w = await launchWindow();
  if (!w.active) return 'inactive';
  const { rows } = await pool.query('SELECT id, username FROM users WHERE invite_code = $1', [code]);
  const referrer = rows[0];
  if (!referrer) return 'unknown';
  if (referrer.id === newUserId) return 'self';
  // Pas de parrainage croise (A parraine B puis B parraine A)
  const cross = await pool.query('SELECT 1 FROM referrals WHERE referee_id = $1 AND referrer_id = $2', [referrer.id, newUserId]);
  if (cross.rowCount) return 'self';
  const ins = await pool.query(
    'INSERT INTO referrals (referee_id, referrer_id, event) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING referee_id',
    [newUserId, referrer.id, LAUNCH.id],
  );
  if (!ins.rowCount) return 'already';
  // Filleul : pieces + skins
  await pool.query('INSERT INTO pending_rewards (user_id, coins, items, reason) VALUES ($1, $2, $3, $4)', [
    newUserId,
    LAUNCH.coins,
    JSON.stringify(LAUNCH.items),
    `Bienvenue ! Parrainé par ${referrer.username}`,
  ]);
  // Parrain : pieces pour chaque ami (plafonne), skins une seule fois
  const { rows: cnt } = await pool.query('SELECT count(*)::int AS n FROM referrals WHERE referrer_id = $1 AND event = $2', [
    referrer.id,
    LAUNCH.id,
  ]);
  if (cnt[0].n <= LAUNCH.maxRewarded)
    await pool.query('INSERT INTO pending_rewards (user_id, coins, items, reason) VALUES ($1, $2, $3, $4)', [
      referrer.id,
      LAUNCH.coins,
      JSON.stringify(cnt[0].n === 1 ? LAUNCH.items : []),
      `Parrainage : ton ami a rejoint BetterMove`,
    ]);
  return 'ok';
}

/** Compte assez recent pour indiquer son parrain apres coup (lien perdu, bandeau ferme...) */
export const LATE_REFERRAL_DAYS = 7;

/** Indiquer son parrain apres l'inscription (compte de moins de 7 jours, une seule fois) */
eventsRouter.post('/referrer', requireUser, async (req, res) => {
  const { rows } = await pool.query('SELECT created_at FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0] || Date.now() - new Date(rows[0].created_at).getTime() > LATE_REFERRAL_DAYS * 86400_000)
    return res.status(403).json({ error: `Possible seulement pendant les ${LATE_REFERRAL_DAYS} jours qui suivent la création du compte.` });
  if (tooManyTries(req.ip)) return res.status(429).json({ error: 'Trop d’essais, réessaie dans une heure.' });
  const status = await applyReferral(req.user.id, req.body?.code);
  const msg = {
    ok: null,
    none: 'Indique le code d’invitation que ton ami t’a envoyé.',
    inactive: 'L’événement de parrainage n’est pas en cours.',
    unknown: 'Ce code d’invitation n’existe pas.',
    self: 'Tu ne peux pas être ton propre parrain (ni parrainer ton parrain).',
    already: 'Tu as déjà un parrain.',
  }[status];
  if (msg) return res.status(400).json({ error: msg, status });
  res.json({ ok: true });
});

/** Qui invite ? (affichage de la fenetre d'invitation a partir du code du lien) */
eventsRouter.get('/invite/:code', async (req, res) => {
  // Plus large : plusieurs amis peuvent ouvrir un lien depuis le meme reseau (ecole, box)
  if (tooManyTries(req.ip, 'lookup', 200)) return res.status(429).json({ error: 'Trop d’essais' });
  const code = String(req.params.code ?? '').toUpperCase();
  if (!CODE.test(code)) return res.status(404).json({ error: 'Code inconnu' });
  const { rows } = await pool.query('SELECT username FROM users WHERE invite_code = $1', [code]);
  if (!rows[0]) return res.status(404).json({ error: 'Code inconnu' });
  const w = await launchWindow();
  res.json({ username: rows[0].username, active: w.active });
});

/** Evenements en cours et a venir, avec ma progression si je suis connecte */
eventsRouter.get('/', async (req, res) => {
  const w = await launchWindow();
  const me = sessionOf(req);
  const [mine, top, total] = await Promise.all([
    me
      ? pool.query(
          `SELECT u.username, r.created_at FROM referrals r JOIN users u ON u.id = r.referee_id
           WHERE r.referrer_id = $1 AND r.event = $2 ORDER BY r.created_at DESC`,
          [me.id, LAUNCH.id],
        )
      : null,
    pool.query(
      `SELECT u.username, count(*)::int AS n FROM referrals r JOIN users u ON u.id = r.referrer_id
       WHERE r.event = $1 GROUP BY u.username ORDER BY n DESC, min(r.created_at) LIMIT 10`,
      [LAUNCH.id],
    ),
    pool.query('SELECT count(*)::int AS n FROM referrals WHERE event = $1', [LAUNCH.id]),
  ]);
  const by = me ? (await pool.query('SELECT u.username FROM referrals r JOIN users u ON u.id = r.referrer_id WHERE r.referee_id = $1', [me.id])).rows[0] : null;
  const created = me ? (await pool.query('SELECT created_at FROM users WHERE id = $1', [me.id])).rows[0]?.created_at : null;
  const canSetReferrer =
    !!me && !by && w.active && !!created && Date.now() - new Date(created).getTime() <= LATE_REFERRAL_DAYS * 86400_000;
  const status = w.active ? 'active' : Date.now() < w.start.getTime() ? 'upcoming' : 'ended';
  res.json({
    now: Date.now(),
    events: [
      {
        id: LAUNCH.id,
        start: w.start.toISOString(),
        end: w.end.toISOString(),
        active: w.active,
        status,
        coins: LAUNCH.coins,
        items: LAUNCH.items,
        maxRewarded: LAUNCH.maxRewarded,
        totalReferrals: total.rows[0].n,
        top: top.rows,
      },
    ],
    me: me
      ? {
          username: me.username,
          inviteCode: await inviteCodeOf(me.id),
          referrals: mine.rows.map((r) => ({ username: r.username, at: r.created_at })),
          referredBy: by?.username ?? null,
          canSetReferrer,
        }
      : null,
  });
});

/** Recompenses en attente (affichees dans une fenetre "Recuperer") */
eventsRouter.get('/rewards', requireUser, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, coins, items, reason FROM pending_rewards WHERE user_id = $1 AND claimed_at IS NULL ORDER BY id',
    [req.user.id],
  );
  res.json({ rewards: rows.map((r) => ({ id: Number(r.id), coins: r.coins, items: r.items, reason: r.reason })) });
});

/** Recompenses en attente : l'app les recupere (et les marque recuperees) en une fois */
eventsRouter.post('/rewards/claim', requireUser, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE pending_rewards SET claimed_at = now() WHERE user_id = $1 AND claimed_at IS NULL
     RETURNING id, coins, items, reason`,
    [req.user.id],
  );
  res.json({ rewards: rows.map((r) => ({ id: Number(r.id), coins: r.coins, items: r.items, reason: r.reason })) });
});
