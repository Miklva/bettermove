// Mesure d'audience anonyme, sans cookie ni stockage sur l'appareil :
// un visiteur = empreinte hachee (IP + navigateur + sel du jour). Le sel change chaque jour et
// n'est pas garde au-dela : impossible de suivre quelqu'un d'un jour a l'autre ou de retrouver son IP.
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
  try {
    await pool.query(
      `INSERT INTO visits (day, visitor, logged) VALUES ($1, $2, $3)
       ON CONFLICT (day, visitor) DO UPDATE SET logged = visits.logged OR EXCLUDED.logged`,
      [day, visitor, logged],
    );
  } catch (e) {
    console.error('Mesure d audience', e);
  }
  res.status(204).end();
});
