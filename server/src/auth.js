// Comptes : inscription, connexion, session par cookie httpOnly signe (JWT)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { containsBanned, isAdmin } from './moderation.js';
import { applyReferral } from './events.js';
import crypto from 'node:crypto';
import { ACCOUNT_MAILS, SITE_URL, accountEmail, accountMailReady, reqLang, sendMail } from './mail.js';

// Secret de signature des sessions : obligatoire et long en production
const PROD = process.env.NODE_ENV === 'production';
if (PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /change-moi/.test(process.env.JWT_SECRET))) {
  console.error('JWT_SECRET manquant, trop court (32 caracteres minimum) ou encore a sa valeur d exemple : arret.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET absent : secret de dev utilise (interdit en production)');
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-a-changer';
const SECRET = JWT_SECRET;
const COOKIE = 'bm_session';
const MAX_AGE = 1000 * 60 * 60 * 24 * 90; // 90 jours

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  maxAge: MAX_AGE,
  path: '/',
};

function setSession(res, user) {
  // sv : version de session. Changer le mot de passe ou supprimer le compte invalide toutes les sessions.
  const token = jwt.sign({ uid: user.id, name: user.username, sv: user.session_version ?? 0 }, SECRET, { expiresIn: '90d' });
  res.cookie(COOKIE, token, cookieOptions);
}

/** Session signee (sans verifier la base) : pour les routes publiques qui personnalisent la reponse */
export function sessionOf(req) {
  try {
    const p = jwt.verify(req.cookies?.[COOKIE] ?? '', SECRET);
    return { id: p.uid, username: p.name, sv: p.sv ?? 0 };
  } catch {
    return null;
  }
}

/** Compte encore valide ? (supprime ou mot de passe change : la session tombe). Cache court en memoire. */
const alive = new Map();
async function sessionValid(s) {
  const hit = alive.get(s.id);
  if (hit && Date.now() - hit.at < 30_000) return hit.sv === s.sv;
  const { rows } = await pool.query('SELECT session_version FROM users WHERE id = $1', [s.id]);
  if (!rows[0]) {
    alive.delete(s.id);
    return false;
  }
  alive.set(s.id, { sv: rows[0].session_version, at: Date.now() });
  return rows[0].session_version === s.sv;
}
export const forgetSession = (id) => alive.delete(id);

/** Middleware : refuse la requete sans session valide */
export async function requireUser(req, res, next) {
  const s = sessionOf(req);
  if (!s) return res.status(401).json({ error: req.cookies?.[COOKIE] ? 'Session expiree' : 'Non connecte' });
  if (!(await sessionValid(s))) {
    res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
    return res.status(401).json({ error: 'Session expiree' });
  }
  req.user = { id: s.id, username: s.username };
  next();
}

// Limites simples par IP (en memoire) : connexions et creations de compte
const attempts = new Map();
function tooMany(ip, kind = 'login', max = 20, windowMs = 10 * 60 * 1000) {
  const k = `${kind}:${ip}`;
  const now = Date.now();
  const list = (attempts.get(k) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  attempts.set(k, list);
  return list.length > max;
}
// Menage regulier pour que la table ne grossisse pas indefiniment
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of attempts) if (!list.some((t) => now - t < 60 * 60 * 1000)) attempts.delete(k);
}, 10 * 60 * 1000).unref();

const USERNAME = /^[a-zA-Z0-9_.-]{3,24}$/;

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  if (tooMany(req.ip, 'register', 5, 60 * 60 * 1000))
    return res.status(429).json({ error: 'Trop de comptes crees depuis cette connexion, reessaie plus tard' });
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || !USERNAME.test(username))
    return res.status(400).json({ error: 'Pseudo invalide : 3 a 24 caracteres (lettres, chiffres, . _ -)' });
  if (containsBanned(username)) return res.status(400).json({ error: 'Ce pseudo contient un mot interdit' });
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 caracteres minimum)' });
  if (password.length > 128) return res.status(400).json({ error: 'Mot de passe trop long (128 caracteres maximum)' });
  const email = cleanEmail(req.body?.email);
  if (email === false) return res.status(400).json({ error: 'Adresse e-mail invalide' });
  // Pseudo deja pris, quelle que soit la casse (Bob et bob seraient confondus a la connexion)
  const taken = await pool.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username]);
  if (taken.rows.length) return res.status(409).json({ error: 'Ce pseudo est deja pris' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, session_version',
      [username, hash, email],
    );
    setSession(res, rows[0]);
    // Lien de parrainage (evenement de lancement) : recompenses pour les deux. Le statut est renvoye a l'app.
    const referral = await applyReferral(rows[0].id, req.body?.ref).catch((e) => {
      console.error('Parrainage', e);
      return 'error';
    });
    if (referral !== 'none') console.log(`Parrainage a l'inscription de ${rows[0].username} : ${referral}`);
    // Adresse donnee : lien de confirmation (l'inscription reussit meme si le mail ne part pas)
    const emailSent = email ? await sendVerify(rows[0], email, reqLang(req)).then(() => accountMailReady(), (e) => (console.error('Mail de confirmation', e), false)) : false;
    res.status(201).json({ user: { username: rows[0].username }, referral, emailSent });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ce pseudo est deja pris' });
    throw e;
  }
});

authRouter.post('/login', async (req, res) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Trop de tentatives, reessaie dans quelques minutes' });
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128 || username.length > 40)
    return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
  const { rows } = await pool.query('SELECT id, username, password_hash, session_version FROM users WHERE lower(username) = lower($1)', [
    username,
  ]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
  setSession(res, user);
  res.json({ user: { username: user.username } });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get('/me', requireUser, (req, res) => {
  res.json({ user: { username: req.user.username, admin: isAdmin(req.user.username) } });
});

// Photo de profil : data URL d'image (recadree et compressee par le client)
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE = 400_000;

authRouter.get('/avatar', requireUser, async (req, res) => {
  const { rows } = await pool.query('SELECT avatar FROM users WHERE id = $1', [req.user.id]);
  res.json({ image: rows[0]?.avatar ?? null });
});

authRouter.put('/avatar', requireUser, async (req, res) => {
  const image = req.body?.image ?? null;
  if (image !== null && (typeof image !== 'string' || image.length > MAX_IMAGE || !IMAGE.test(image)))
    return res.status(400).json({ error: 'Image invalide ou trop lourde' });
  await pool.query('UPDATE users SET avatar = $1, avatar_at = $2 WHERE id = $3', [image, Date.now(), req.user.id]);
  res.json({ ok: true });
});

/* ---------------- Mot de passe, export et suppression du compte (RGPD) ---------------- */

async function checkPassword(userId, password) {
  if (typeof password !== 'string' || password.length > 128) return null;
  const { rows } = await pool.query('SELECT id, username, password_hash, session_version FROM users WHERE id = $1', [userId]);
  const u = rows[0];
  return u && (await bcrypt.compare(password, u.password_hash)) ? u : null;
}

/** Changer son mot de passe : deconnecte les autres appareils */
authRouter.put('/password', requireUser, async (req, res) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Trop de tentatives, reessaie dans quelques minutes' });
  const { current, next } = req.body ?? {};
  if (typeof next !== 'string' || next.length < 8 || next.length > 128)
    return res.status(400).json({ error: 'Nouveau mot de passe : 8 a 128 caracteres' });
  const u = await checkPassword(req.user.id, current);
  if (!u) return res.status(403).json({ error: 'Mot de passe actuel incorrect' });
  const { rows } = await pool.query(
    'UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING id, username, session_version',
    [u.id, await bcrypt.hash(next, 10)],
  );
  forgetSession(u.id);
  setSession(res, rows[0]);
  res.json({ ok: true });
});

/** Export de toutes les donnees du compte (droit d'acces et de portabilite) */
authRouter.get('/export', requireUser, async (req, res) => {
  const id = req.user.id;
  const one = (sql) => pool.query(sql, [id]).then((r) => r.rows);
  const [user, data, games, chat, dms, friends, mutes, online, challenges, daily, rush, gameChat, support, referrals] = await Promise.all([
    one('SELECT username, email, email_verified, created_at, last_seen, online_rating, online_games, avatar IS NOT NULL AS has_photo FROM users WHERE id = $1'),
    one('SELECT key, value, updated_at FROM user_data WHERE user_id = $1'),
    one('SELECT id, data, source, result, played_at, deleted FROM games WHERE user_id = $1'),
    one('SELECT text, created_at FROM chat_messages WHERE user_id = $1'),
    one(`SELECT f.username AS de, t.username AS a, d.text, d.created_at FROM direct_messages d
         JOIN users f ON f.id = d.from_id JOIN users t ON t.id = d.to_id WHERE d.from_id = $1 OR d.to_id = $1`),
    one(`SELECT u.username, f.status, f.created_at FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         WHERE f.requester_id = $1 OR f.addressee_id = $1`),
    one('SELECT u.username FROM mutes m JOIN users u ON u.id = m.muted_id WHERE m.user_id = $1'),
    one('SELECT id, moves, result, reason, created_at FROM online_games WHERE white_id = $1 OR black_id = $1'),
    one('SELECT id, status, created_at FROM challenges WHERE from_id = $1 OR to_id = $1'),
    one('SELECT * FROM daily_results WHERE user_id = $1'),
    one('SELECT * FROM rush_scores WHERE user_id = $1'),
    one('SELECT game_id, text, created_at FROM game_messages WHERE user_id = $1'),
    one('SELECT category, subject, message, email, created_at FROM support_messages WHERE user_id = $1'),
    one(`SELECT p.username AS parrain, f.username AS filleul, r.event, r.created_at FROM referrals r
         JOIN users p ON p.id = r.referrer_id JOIN users f ON f.id = r.referee_id WHERE r.referrer_id = $1 OR r.referee_id = $1`),
  ]);
  res.set('Content-Disposition', `attachment; filename="bettermove-${req.user.username}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    account: user[0],
    appData: data,
    games,
    publicChat: chat,
    directMessages: dms,
    friends,
    mutes,
    onlineGames: online,
    challenges,
    dailyPuzzle: daily,
    rush,
    gameChat,
    support,
    referrals,
  });
});

/** Suppression definitive du compte et de toutes ses donnees (droit a l'effacement) */
authRouter.delete('/account', requireUser, async (req, res) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Trop de tentatives, reessaie dans quelques minutes' });
  const u = await checkPassword(req.user.id, req.body?.password);
  if (!u) return res.status(403).json({ error: 'Mot de passe incorrect' });
  // Les tables liees sont en ON DELETE CASCADE ; les demandes au support gardent le message sans le compte
  await pool.query('DELETE FROM users WHERE id = $1', [u.id]);
  forgetSession(u.id);
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

/* ---------------- Adresse e-mail et mot de passe oublie ---------------- */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
/** null = pas d'adresse, false = invalide */
function cleanEmail(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return false;
  const e = v.trim().toLowerCase();
  if (!e) return null;
  return e.length <= 200 && EMAIL_RE.test(e) ? e : false;
}

const VERIFY_TTL = 48 * 60 * 60 * 1000; // 48 h
const RESET_TTL = 60 * 60 * 1000; // 1 h
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

/** Cree un jeton a usage unique (seul son hachage est stocke) ; remplace les precedents du meme type */
async function newToken(userId, kind, ttl, email = null) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM auth_tokens WHERE user_id = $1 AND kind = $2', [userId, kind]);
  await pool.query('INSERT INTO auth_tokens (token_hash, user_id, kind, email, expires_at) VALUES ($1, $2, $3, $4, $5)', [
    hashToken(token),
    userId,
    kind,
    email,
    new Date(Date.now() + ttl),
  ]);
  return token;
}

/** Jeton valide (non expire) : le consomme et renvoie sa ligne */
async function useToken(token, kind) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const { rows } = await pool.query(
    'DELETE FROM auth_tokens WHERE token_hash = $1 AND kind = $2 RETURNING user_id, email, expires_at',
    [hashToken(token), kind],
  );
  const t = rows[0];
  return t && new Date(t.expires_at).getTime() > Date.now() ? t : null;
}

async function sendVerify(user, email, lang = 'fr') {
  if (!accountMailReady()) return;
  const token = await newToken(user.id, 'verify', VERIFY_TTL, email);
  const M = ACCOUNT_MAILS.verify[lang] ?? ACCOUNT_MAILS.verify.fr;
  await sendMail({
    to: email,
    subject: M.subject,
    ...accountEmail({ ...M, username: user.username, url: `${SITE_URL}/compte/confirmer/${token}`, lang }),
  });
}

/** Adresse du compte connecte */
authRouter.get('/email', requireUser, async (req, res) => {
  const { rows } = await pool.query('SELECT email, email_verified FROM users WHERE id = $1', [req.user.id]);
  res.json({ email: rows[0]?.email ?? null, verified: !!rows[0]?.email_verified, mail: accountMailReady() });
});

/** Ajouter, changer ou retirer son adresse : mot de passe exige (une session volee ne peut pas detourner le compte) */
authRouter.put('/email', requireUser, async (req, res) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Trop de tentatives, reessaie dans quelques minutes' });
  const email = cleanEmail(req.body?.email);
  if (email === false) return res.status(400).json({ error: 'Adresse e-mail invalide' });
  const u = await checkPassword(req.user.id, req.body?.password);
  if (!u) return res.status(403).json({ error: 'Mot de passe incorrect' });
  await pool.query('UPDATE users SET email = $2, email_verified = false WHERE id = $1', [u.id, email]);
  await pool.query("DELETE FROM auth_tokens WHERE user_id = $1", [u.id]);
  let sent = false;
  if (email) sent = await sendVerify(u, email, reqLang(req)).then(() => accountMailReady(), (e) => (console.error('Mail de confirmation', e), false));
  res.json({ ok: true, email, verified: false, sent });
});

/** Renvoyer le lien de confirmation */
authRouter.post('/email/resend', requireUser, async (req, res) => {
  if (tooMany(req.ip, 'mail', 5, 60 * 60 * 1000)) return res.status(429).json({ error: 'Trop de mails envoyes, reessaie plus tard' });
  const { rows } = await pool.query('SELECT id, username, email, email_verified FROM users WHERE id = $1', [req.user.id]);
  const u = rows[0];
  if (!u?.email) return res.status(400).json({ error: 'Aucune adresse sur ce compte' });
  if (u.email_verified) return res.json({ ok: true, verified: true });
  if (!accountMailReady()) return res.status(503).json({ error: 'Envoi de mails indisponible pour le moment' });
  try {
    await sendVerify(u, u.email, reqLang(req));
  } catch (e) {
    console.error('Mail de confirmation', e);
    return res.status(502).json({ error: 'Le mail n’a pas pu partir, reessaie plus tard' });
  }
  res.json({ ok: true });
});

/** Lien de confirmation ouvert (sans etre connecte : le jeton suffit) */
authRouter.post('/verify-email', async (req, res) => {
  if (tooMany(req.ip, 'token', 30)) return res.status(429).json({ error: 'Trop de tentatives, reessaie dans quelques minutes' });
  const t = await useToken(req.body?.token, 'verify');
  if (!t) return res.status(400).json({ error: 'Lien invalide ou expire' });
  // L'adresse a pu changer depuis l'envoi : on ne confirme que celle du lien
  const { rowCount } = await pool.query('UPDATE users SET email_verified = true WHERE id = $1 AND email = $2', [t.user_id, t.email]);
  if (!rowCount) return res.status(400).json({ error: 'Cette adresse n’est plus celle du compte' });
  res.json({ ok: true });
});

/** Mot de passe oublie : pseudo ou adresse. Reponse identique dans tous les cas (on ne revele pas qui a un compte). */
authRouter.post('/forgot', async (req, res) => {
  if (tooMany(req.ip, 'forgot', 5, 60 * 60 * 1000)) return res.status(429).json({ error: 'Trop de demandes, reessaie plus tard' });
  const login = typeof req.body?.login === 'string' ? req.body.login.trim() : '';
  if (!login || login.length > 200) return res.status(400).json({ error: 'Indique ton pseudo ou ton adresse e-mail' });
  if (!accountMailReady())
    return res.status(503).json({ error: 'La recuperation par e-mail n’est pas encore disponible : ecris au support depuis la page Aide' });
  const { rows } = await pool.query(
    `SELECT id, username, email FROM users
     WHERE email IS NOT NULL AND email_verified AND (lower(username) = lower($1) OR lower(email) = lower($1)) LIMIT 5`,
    [login],
  );
  for (const u of rows) {
    // Un mail par compte toutes les 2 minutes au plus
    const recent = await pool.query(
      "SELECT 1 FROM auth_tokens WHERE user_id = $1 AND kind = 'reset' AND created_at > now() - interval '2 minutes'",
      [u.id],
    );
    if (recent.rows.length) continue;
    const token = await newToken(u.id, 'reset', RESET_TTL);
    const M = ACCOUNT_MAILS.reset[reqLang(req)];
    await sendMail({
      to: u.email,
      subject: M.subject,
      ...accountEmail({ ...M, username: u.username, url: `${SITE_URL}/compte/reinitialiser/${token}`, lang: reqLang(req) }),
    }).catch((e) => console.error('Mail mot de passe oublie', e));
  }
  res.json({ ok: true });
});

/** Nouveau mot de passe depuis le lien recu par mail : deconnecte tous les appareils */
authRouter.post('/reset', async (req, res) => {
  if (tooMany(req.ip, 'token', 30)) return res.status(429).json({ error: 'Trop de tentatives, reessaie dans quelques minutes' });
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Nouveau mot de passe : 8 a 128 caracteres' });
  const t = await useToken(req.body?.token, 'reset');
  if (!t) return res.status(400).json({ error: 'Lien invalide ou expire : refais une demande' });
  const { rows } = await pool.query(
    'UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING id, username',
    [t.user_id, await bcrypt.hash(password, 10)],
  );
  if (!rows[0]) return res.status(400).json({ error: 'Compte introuvable' });
  await pool.query('DELETE FROM auth_tokens WHERE user_id = $1 AND kind = $2', [t.user_id, 'reset']);
  forgetSession(t.user_id);
  res.json({ ok: true, username: rows[0].username });
});
