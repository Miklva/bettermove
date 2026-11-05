// Classement public : Elo bots, Elo problemes, XP et records du Puzzle Rush
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { JWT_SECRET } from './auth.js';
import { PROVISIONAL_GAMES } from './rating.js';

export const leaderboardRouter = Router();
const PROFILE = "'bettermove.profile.v1'";

const TYPES = {
  // Bots : jamais provisoire. Problemes : "?" pendant les 5 premiers (voir src/rating/elo.ts)
  bots: { field: "(d.value->'bots'->>'rating')::float", prov: null },
  puzzles: {
    field: "(d.value->'puzzles'->>'rating')::float",
    prov: `coalesce((d.value->'puzzleStats'->>'solved')::int, 0) + coalesce((d.value->'puzzleStats'->>'failed')::int, 0) < ${PROVISIONAL_GAMES}`,
  },
  xp: { field: "(d.value->>'xp')::float", prov: null },
};
const RUSH = { rush3: '3', rush5: '5', survival: 'survival' };

function viewer(req) {
  try {
    return jwt.verify(req.cookies?.bm_session ?? '', JWT_SECRET).name;
  } catch {
    return null;
  }
}

leaderboardRouter.get('/', async (req, res) => {
  const type = String(req.query.type ?? 'bots');
  const me = viewer(req);
  let rows;
  if (RUSH[type]) {
    rows = (
      await pool.query(
        `SELECT u.username, max(r.score)::float AS value, false AS provisional
         FROM rush_scores r JOIN users u ON u.id = r.user_id WHERE r.mode = $1
         GROUP BY u.username ORDER BY value DESC, u.username`,
        [RUSH[type]],
      )
    ).rows;
  } else if (type === 'online') {
    rows = (
      await pool.query(
        `SELECT username, online_rating AS value, online_games < ${PROVISIONAL_GAMES} AS provisional FROM users
         WHERE online_rating IS NOT NULL AND online_games > 0 ORDER BY value DESC, username`,
      )
    ).rows;
  } else if (TYPES[type]) {
    const t = TYPES[type];
    rows = (
      await pool.query(
        `SELECT u.username, ${t.field} AS value, ${t.prov ?? 'false'} AS provisional
         FROM user_data d JOIN users u ON u.id = d.user_id
         WHERE d.key = ${PROFILE} AND ${t.field} IS NOT NULL ${type === 'xp' ? `AND ${t.field} > 0` : ''}
         ORDER BY value DESC, u.username`,
      )
    ).rows;
  } else return res.status(400).json({ error: 'Classement inconnu' });

  const list = rows.map((r, i) => ({ rank: i + 1, username: r.username, value: Math.round(Number(r.value)), provisional: r.provisional }));
  const mine = me ? list.find((r) => r.username.toLowerCase() === me.toLowerCase()) ?? null : null;
  res.json({ top: list.slice(0, 50), total: list.length, me: mine });
});
