// Mesure d'audience anonyme, sans cookie ni stockage sur l'appareil :
// un visiteur = empreinte hachee (IP + navigateur + sel du jour). Le sel change chaque jour et
// n'est pas garde au-dela : impossible de suivre quelqu'un d'un jour a l'autre ou de retrouver son IP.
// En plus du compte : pages vues (adresse sans pseudo ni numero), type d'appareil, navigateur, systeme,
// langue du navigateur et site d'origine (nom de domaine seulement). Rien de tout cela n'identifie la personne.
import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from './db.js';
import { sessionOf } from './auth.js';

export const visitsRouter = Router();

const BOT_RE = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|lighthouse/i;
const salts = new Map(); // jour -> sel aleatoire (en memoire uniquement)

const parisDay = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

function saltOf(day) {
  if (!salts.has(day)) {
    salts.clear(); // le sel de la veille est oublie
    salts.set(day, crypto.randomBytes(32).toString('hex'));
  }
  return salts.get(day);
}

export function deviceOf(ua) {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablette';
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile';
  return 'ordinateur';
}
export function browserOf(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome|CriOS/.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  return 'autre';
}
export function osOf(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'autre';
}
/** Page sans pseudo ni numero : /jouer/bot, /profil, /partie... */
export function cleanPath(p) {
  if (typeof p !== 'string') return null;
  const s = p.split(/[?#]/)[0].toLowerCase();
  if (!/^\/[a-z0-9/-]{0,60}$/.test(s)) return null;
  const segs = s.split('/').filter(Boolean);
  if (['profil', 'partie', 'invite', 'reinitialiser'].includes(segs[0])) return `/${segs[0]}`;
  return '/' + segs.slice(0, 2).filter((x) => !/^\d+$/.test(x)).join('/');
}
/** Site d'origine : nom de domaine seulement, et rien si on vient du site lui-meme */
export function refOf(r, host) {
  if (typeof r !== 'string' || !r) return null;
  try {
    const h = new URL(r).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || h === String(host ?? '').split(':')[0].replace(/^www\./, '').toLowerCase()) return null;
    return h.slice(0, 60);
  } catch {
    return null;
  }
}
const langOf = (l) => (typeof l === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2})?$/.test(l) ? l.slice(0, 2).toLowerCase() : null);

visitsRouter.post('/hit', async (req, res) => {
  const ua = String(req.headers['user-agent'] ?? '');
  if (!ua || BOT_RE.test(ua)) return res.status(204).end();
  const day = parisDay();
  const visitor = crypto
    .createHash('sha256')
    .update(`${saltOf(day)}|${req.ip}|${ua}`)
    .digest('hex')
    .slice(0, 32);
  const logged = !!sessionOf(req);
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const path = cleanPath(b.page);
  try {
    await pool.query(
      `INSERT INTO visits (day, visitor, logged, hits, first_path, referrer, lang, device, browser, os, first_at, last_at)
       VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, now(), now())
       ON CONFLICT (day, visitor) DO UPDATE SET logged = visits.logged OR EXCLUDED.logged,
         hits = coalesce(visits.hits, 0) + 1, last_at = now(),
         first_path = coalesce(visits.first_path, EXCLUDED.first_path),
         referrer = coalesce(visits.referrer, EXCLUDED.referrer),
         lang = coalesce(visits.lang, EXCLUDED.lang), device = coalesce(visits.device, EXCLUDED.device),
         browser = coalesce(visits.browser, EXCLUDED.browser), os = coalesce(visits.os, EXCLUDED.os),
         first_at = coalesce(visits.first_at, EXCLUDED.first_at)`,
      [day, visitor, logged, path, refOf(b.ref, req.headers.host), langOf(b.lang), deviceOf(ua), browserOf(ua), osOf(ua)],
    );
    if (path)
      await pool.query(
        `INSERT INTO visit_pages (day, visitor, path) VALUES ($1, $2, $3)
         ON CONFLICT (day, visitor, path) DO UPDATE SET n = visit_pages.n + 1`,
        [day, visitor, path],
      );
  } catch (e) {
    console.error('Mesure d audience', e);
  }
  res.status(204).end();
});
