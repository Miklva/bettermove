// Elo en ligne : classement des parties entre vrais joueurs ("Contre le monde")
// Meme systeme que le client (src/rating/elo.ts) : 5 parties provisoires avec de gros ecarts,
// puis K = 16 (+8 / -8 contre un adversaire de meme niveau)
export const PROVISIONAL_GAMES = 5;
const K_SCHEDULE = [80, 64, 48, 40, 32];
const START = 1200;

/** Coefficient K : bouge vite au debut, puis se stabilise */
const kOf = (games) => K_SCHEDULE[games] ?? 16;

/** Elo en jeu pour un joueur : { win, draw, loss } */
export function stakesFor(me, opp) {
  const e = 1 / (1 + 10 ** ((opp.rating - me.rating) / 400));
  const k = kOf(me.games);
  return { win: Math.round(k * (1 - e)), draw: Math.round(k * (0.5 - e)), loss: Math.round(k * (0 - e)) };
}

/** Elo en ligne d'un joueur. Premiere partie : on part de son Elo bots (borne), sinon 1200. */
export async function onlineRating(client, userId) {
  const { rows } = await client.query(
    `SELECT u.online_rating, u.online_games, (d.value->'bots'->>'rating')::float AS bots
     FROM users u LEFT JOIN user_data d ON d.user_id = u.id AND d.key = 'bettermove.profile.v1' WHERE u.id = $1`,
    [userId],
  );
  const r = rows[0] ?? {};
  if (r.online_rating !== null && r.online_rating !== undefined)
    return { rating: Number(r.online_rating), games: Number(r.online_games) };
  const seed = Number(r.bots) ? Math.max(600, Math.min(2200, Number(r.bots))) : START;
  return { rating: seed, games: 0 };
}

/** Met a jour les deux joueurs. score = resultat des Blancs (1, 0.5, 0). Renvoie les variations. */
export async function applyResult(client, g, score) {
  const w = await onlineRating(client, g.white_id);
  const b = await onlineRating(client, g.black_id);
  const expW = 1 / (1 + 10 ** ((b.rating - w.rating) / 400));
  const dW = Math.round(kOf(w.games) * (score - expW));
  const dB = Math.round(kOf(b.games) * (1 - score - (1 - expW)));
  await client.query('UPDATE users SET online_rating = $2, online_games = online_games + 1 WHERE id = $1', [
    g.white_id,
    Math.max(100, w.rating + dW),
  ]);
  await client.query('UPDATE users SET online_rating = $2, online_games = online_games + 1 WHERE id = $1', [
    g.black_id,
    Math.max(100, b.rating + dB),
  ]);
  return { dW, dB };
}
