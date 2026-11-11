// API BetterMove : comptes + sauvegarde des donnees dans PostgreSQL
import express from 'express';
import cookieParser from 'cookie-parser';
import { migrate, pool } from './db.js';
import { authRouter } from './auth.js';
import { syncRouter } from './sync.js';
import { chatRouter } from './chat.js';
import { supportRouter } from './support.js';
import { socialRouter } from './social.js';
import { onlineRouter } from './online.js';
import { avatarRouter } from './avatar.js';
import { rushRouter } from './rush.js';
import { adminRouter } from './admin.js';
import { leaderboardRouter } from './leaderboard.js';
import { matchRouter } from './match.js';
import { profileRouter } from './profile.js';
import { dailyRouter } from './daily.js';
import { puzzleTalkRouter } from './puzzleTalk.js';
import { eventsRouter } from './events.js';
import { visitsRouter } from './visits.js';

const app = express();
// Nombre de proxys devant l'API (nginx = 1 ; nginx + Caddy/Cloudflare = 2) pour connaitre la vraie IP
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.disable('x-powered-by');
// En-tetes de securite des reponses de l'API (le site lui-meme est servi par nginx)
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store',
  });
  next();
});
// Limite globale par IP : 600 requetes par minute (l'app en fait au plus une centaine, sondages compris)
const hits = new Map();
app.use('/api', (req, res, next) => {
  const now = Date.now();
  const e = hits.get(req.ip);
  if (!e || now - e.start > 60_000) hits.set(req.ip, { start: now, n: 1 });
  else if (++e.n > 600) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans une minute.' });
  next();
});
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (now - e.start > 60_000) hits.delete(ip);
}, 60_000).unref();
// Corps JSON : gros seulement pour la sauvegarde (parties, historique), 1 Mo ailleurs (photo comprise)
app.use('/api/sync', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
app.use('/api/auth', authRouter);
app.use('/api/sync', syncRouter);
app.use('/api/chat', chatRouter);
app.use('/api/support', supportRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/social', socialRouter);
app.use('/api/online', onlineRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/avatar', avatarRouter);
app.use('/api/rush', rushRouter);
app.use('/api/admin', adminRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/match', matchRouter);
app.use('/api/profile', profileRouter);
app.use('/api/events', eventsRouter);
app.use('/api/puzzle-talk', puzzleTalkRouter);

app.use((err, _req, res, _next) => {
  // Requetes mal formees : refus propre, sans bruit dans les journaux
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Envoi trop volumineux' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête invalide' });
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const port = Number(process.env.PORT ?? 3001);
await migrate();
app.listen(port, () => console.log(`API BetterMove sur le port ${port}`));
