// Photos de profil publiques : /api/avatar/:username renvoie l'image, 404 sinon
import { Router } from 'express';
import { pool } from './db.js';

export const avatarRouter = Router();

avatarRouter.get('/:username', async (req, res) => {
  const { rows } = await pool.query('SELECT avatar, avatar_at FROM users WHERE lower(username) = lower($1)', [
    req.params.username,
  ]);
  const data = rows[0]?.avatar;
  if (!data) return res.status(404).json({ error: 'Pas de photo' });
  // Uniquement des images matricielles (jamais de SVG, qui peut contenir du script)
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data);
  if (!m) return res.status(404).json({ error: 'Pas de photo' });
  const etag = `"${rows[0].avatar_at ?? 0}"`;
  res.set('ETag', etag);
  res.set('Cache-Control', 'public, max-age=300');
  res.set('Content-Security-Policy', "default-src 'none'");
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
});
