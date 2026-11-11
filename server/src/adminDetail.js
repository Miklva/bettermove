// Page Admin : detail de chaque statistique (quels comptes), fiche d'un joueur et audience des visiteurs.
// Reserve aux administrateurs (le controle d'acces est fait par adminRouter).
import { pool } from './db.js';

const PROFILE = "'bettermove.profile.v1'";
const SHOP = "'bettermove.shop.v1'";
const ACH = "'bettermove.achievements.v1'";
const DAY = "(now() AT TIME ZONE 'Europe/Paris')::date";
const LOCAL_DAY = (col) => `(${col} AT TIME ZONE 'Europe/Paris')::date`;
const q = (sql, params = []) => pool.query(sql, params).then((r) => r.rows);

// Somme des etoiles de cours d'un profil (d = ligne de user_data)
const STARS = `(SELECT coalesce(sum(coalesce((l.v->>'stars')::int, 0)), 0) FROM jsonb_each(CASE WHEN jsonb_typeof(d.value->'lessons') = 'object' THEN d.value->'lessons' ELSE '{}'::jsonb END) AS l(k, v))`;
// Derniere synchronisation (updated_at est en millisecondes)
const LAST_SYNC = `(SELECT to_timestamp(max(x.updated_at) / 1000.0) FROM user_data x WHERE x.user_id = u.id)`;

const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------------- Listes : "quels comptes derriere ce chiffre" ---------------- */

// Colonnes : type user (cliquable), num, date (date et heure), day (jour), text, bool
const C = {
  user: { key: 'username', label: 'Joueur', type: 'user' },
  created: { key: 'created_at', label: 'Inscrit le', type: 'date' },
  seen: { key: 'last_seen', label: 'Dernière visite', type: 'date' },
  sync: { key: 'last_sync', label: 'Dernière synchro', type: 'date' },
  games: { key: 'games', label: 'Parties', type: 'num' },
  xp: { key: 'xp', label: 'XP', type: 'num' },
  stars: { key: 'stars', label: 'Étoiles', type: 'num' },
  bots: { key: 'bots', label: 'Elo bots', type: 'num' },
  puzzles: { key: 'puzzles', label: 'Elo problèmes', type: 'num' },
  online: { key: 'online', label: 'Elo en ligne', type: 'num' },
  email: { key: 'email', label: 'E-mail', type: 'text' },
  verified: { key: 'verified', label: 'Vérifié', type: 'bool' },
  photo: { key: 'photo', label: 'Photo', type: 'bool' },
};

// Une ligne "compte" complete, reutilisee par plusieurs listes
const ACCOUNT_SELECT = `
  u.username, u.created_at, u.last_seen, ${LAST_SYNC} AS last_sync,
  (SELECT count(*) FROM games g WHERE g.user_id = u.id AND NOT g.deleted) AS games,
  (d.value->>'xp')::float AS xp, ${STARS} AS stars,
  (d.value->'bots'->>'rating')::float AS bots, (d.value->'puzzles'->>'rating')::float AS puzzles,
  CASE WHEN u.online_games > 0 THEN u.online_rating END AS online,
  u.email IS NOT NULL AS has_email, u.email_verified AS verified, u.avatar IS NOT NULL AS photo`;
const ACCOUNT_FROM = `users u LEFT JOIN user_data d ON d.user_id = u.id AND d.key = ${PROFILE}`;
const ACCOUNT_COLS = [C.user, C.created, C.seen, C.sync, C.games, C.xp, C.stars, C.bots, C.puzzles, C.online, C.verified, C.photo];
const accounts = (where, order = 'u.created_at DESC', params = []) =>
  q(`SELECT ${ACCOUNT_SELECT} FROM ${ACCOUNT_FROM} WHERE ${where} ORDER BY ${order} LIMIT 2000`, params);

const SOURCES = ['bot', 'local', 'online', 'chess.com', 'lichess', 'pgn'];
const SOURCE_COLS = [
  { key: 'bot', label: 'Bots', type: 'num' },
  { key: 'local', label: 'Écran', type: 'num' },
  { key: 'online', label: 'En ligne', type: 'num' },
  { key: 'imports', label: 'Imports', type: 'num' },
];
const SOURCE_SELECT = `
  count(*) FILTER (WHERE g.source = 'bot') AS bot,
  count(*) FILTER (WHERE g.source = 'local') AS local,
  count(*) FILTER (WHERE g.source = 'online') AS online,
  count(*) FILTER (WHERE g.source IS NULL OR g.source NOT IN ('bot', 'local', 'online')) AS imports`;

const LISTS = {
  online: async () => ({
    title: 'En ligne maintenant (3 dernières minutes)',
    cols: ACCOUNT_COLS,
    rows: await accounts(`u.last_seen > now() - interval '3 minutes'`, 'u.last_seen DESC'),
  }),
  users: async () => ({ title: 'Tous les comptes', cols: ACCOUNT_COLS, rows: await accounts('true') }),
  new7: async () => ({ title: 'Comptes créés ces 7 derniers jours', cols: ACCOUNT_COLS, rows: await accounts(`u.created_at > now() - interval '7 days'`) }),
  new30: async () => ({ title: 'Comptes créés ces 30 derniers jours', cols: ACCOUNT_COLS, rows: await accounts(`u.created_at > now() - interval '30 days'`) }),
  avatars: async () => ({ title: 'Comptes avec une photo', cols: ACCOUNT_COLS, rows: await accounts('u.avatar IS NOT NULL') }),
  emails: async () => ({
    title: 'Comptes avec une adresse e-mail',
    cols: [C.user, C.email, C.verified, C.created, C.seen],
    rows: await q(
      `SELECT u.username, u.email, u.email_verified AS verified, u.created_at, u.last_seen FROM users u
       WHERE u.email IS NOT NULL ORDER BY u.created_at DESC`,
    ),
  }),
  active1: async () => ({
    title: 'Joueurs actifs ces dernières 24 h (visite ou synchro)',
    cols: ACCOUNT_COLS,
    rows: await accounts(
      `(u.last_seen > now() - interval '1 day' OR EXISTS (SELECT 1 FROM user_data x WHERE x.user_id = u.id AND x.updated_at > $1))`,
      'u.last_seen DESC NULLS LAST',
      [Date.now() - 86400_000],
    ),
  }),
  active30: async () => ({
    title: 'Joueurs actifs ces 30 derniers jours (visite, partie ou synchro)',
    cols: ACCOUNT_COLS,
    rows: await accounts(
      `(u.last_seen > now() - interval '30 days'
        OR EXISTS (SELECT 1 FROM games g WHERE g.user_id = u.id AND g.played_at > now() - interval '30 days')
        OR EXISTS (SELECT 1 FROM user_data x WHERE x.user_id = u.id AND x.updated_at > $1))`,
      'u.last_seen DESC NULLS LAST',
      [Date.now() - 30 * 86400_000],
    ),
  }),
  inactive: async () => ({
    title: 'Comptes sans visite depuis plus de 30 jours',
    cols: ACCOUNT_COLS,
    rows: await accounts(`coalesce(u.last_seen, u.created_at) < now() - interval '30 days'`, 'u.last_seen DESC NULLS LAST'),
  }),
  signups: async ({ day }) => {
    if (!isDay(day)) throw new Error('Jour invalide');
    return { title: `Comptes créés le ${day}`, cols: ACCOUNT_COLS, rows: await accounts(`${LOCAL_DAY('u.created_at')} = $1::date`, 'u.created_at', [day]) };
  },
  gamesDay: async ({ day }) => {
    if (!isDay(day)) throw new Error('Jour invalide');
    return {
      title: `Parties jouées le ${day} (bots, écran, en ligne)`,
      cols: [C.user, { key: 'games', label: 'Parties', type: 'num' }, ...SOURCE_COLS.slice(0, 3)],
      rows: await q(
        `SELECT u.username, count(*) AS games, ${SOURCE_SELECT} FROM games g JOIN users u ON u.id = g.user_id
         WHERE NOT g.deleted AND ${LOCAL_DAY('g.played_at')} = $1::date AND g.source IN ('bot', 'local', 'online')
         GROUP BY u.username ORDER BY games DESC, u.username`,
        [day],
      ),
    };
  },
  games30: async () => ({
    title: 'Parties enregistrées ces 30 derniers jours, par joueur',
    cols: [C.user, C.games, ...SOURCE_COLS, { key: 'last', label: 'Dernière', type: 'date' }],
    rows: await q(
      `SELECT u.username, count(*) AS games, ${SOURCE_SELECT}, max(g.played_at) AS last
       FROM games g JOIN users u ON u.id = g.user_id
       WHERE NOT g.deleted AND g.played_at > now() - interval '30 days'
       GROUP BY u.username ORDER BY games DESC, u.username`,
    ),
  }),
  games: async () => ({
    title: 'Toutes les parties enregistrées, par joueur',
    cols: [C.user, C.games, ...SOURCE_COLS, { key: 'last', label: 'Dernière', type: 'date' }],
    rows: await q(
      `SELECT u.username, count(*) AS games, ${SOURCE_SELECT}, max(g.played_at) AS last
       FROM games g JOIN users u ON u.id = g.user_id WHERE NOT g.deleted
       GROUP BY u.username ORDER BY games DESC, u.username`,
    ),
  }),
  source: async ({ src }) => {
    const s = String(src ?? '');
    const where = SOURCES.includes(s) ? 'g.source = $1' : "(g.source IS NULL OR g.source <> ALL($2::text[])) AND $1 = 'autre'";
    return {
      title: `Parties « ${s} » ces 30 derniers jours, par joueur`,
      cols: [C.user, C.games, { key: 'last', label: 'Dernière', type: 'date' }],
      rows: await q(
        `SELECT u.username, count(*) AS games, max(g.played_at) AS last FROM games g JOIN users u ON u.id = g.user_id
         WHERE NOT g.deleted AND g.played_at > now() - interval '30 days' AND ${where}
         GROUP BY u.username ORDER BY games DESC, u.username`,
        SOURCES.includes(s) ? [s] : [s, SOURCES],
      ),
    };
  },
  onlineGames: async () => ({
    title: 'Parties en ligne ces 30 derniers jours',
    cols: [
      { key: 'created_at', label: 'Début', type: 'date' },
      { key: 'white', label: 'Blancs', type: 'user' },
      { key: 'black', label: 'Noirs', type: 'user' },
      { key: 'cadence', label: 'Cadence', type: 'text' },
      { key: 'moves', label: 'Coups', type: 'num' },
      { key: 'result', label: 'Résultat', type: 'text' },
      { key: 'reason', label: 'Fin', type: 'text' },
      { key: 'rated', label: 'Classée', type: 'bool' },
    ],
    rows: await q(
      `SELECT g.id, g.created_at, w.username AS white, b.username AS black,
              CASE WHEN g.initial_ms IS NULL THEN 'sans pendule' ELSE (g.initial_ms / 60000) || '+' || (g.increment_ms / 1000) END AS cadence,
              CASE WHEN g.moves = '' THEN 0 ELSE ceil(array_length(string_to_array(g.moves, ' '), 1) / 2.0) END AS moves,
              CASE WHEN g.status = 'active' THEN 'en cours' ELSE coalesce(g.result, g.status) END AS result,
              g.reason, g.rated
       FROM online_games g JOIN users w ON w.id = g.white_id JOIN users b ON b.id = g.black_id
       WHERE g.created_at > now() - interval '30 days' ORDER BY g.created_at DESC LIMIT 1000`,
    ),
  }),
  eloOnline: async () => ({
    title: 'Elo en ligne',
    cols: [C.user, C.online, { key: 'n', label: 'Parties classées', type: 'num' }, C.seen],
    rows: await q(
      `SELECT u.username, u.online_rating AS online, u.online_games AS n, u.last_seen FROM users u
       WHERE u.online_games > 0 ORDER BY online DESC`,
    ),
  }),
  eloBots: async () => ({
    title: 'Elo bots',
    cols: [C.user, C.bots, { key: 'beaten', label: 'Bots battus', type: 'num' }, C.games, C.seen],
    rows: await q(
      `SELECT u.username, (d.value->'bots'->>'rating')::float AS bots,
              CASE WHEN jsonb_typeof(d.value->'beaten') = 'array' THEN jsonb_array_length(d.value->'beaten') ELSE 0 END AS beaten,
              (SELECT count(*) FROM games g WHERE g.user_id = u.id AND g.source = 'bot' AND NOT g.deleted) AS games, u.last_seen
       FROM user_data d JOIN users u ON u.id = d.user_id WHERE d.key = ${PROFILE} ORDER BY bots DESC NULLS LAST`,
    ),
  }),
  eloBucket: async ({ b }) => {
    const lo = Number(b);
    if (!Number.isFinite(lo)) throw new Error('Tranche invalide');
    return {
      title: `Elo bots entre ${lo} et ${lo + 199}`,
      cols: [C.user, C.bots, C.games, C.seen],
      rows: await q(
        `SELECT u.username, (d.value->'bots'->>'rating')::float AS bots, u.last_seen,
                (SELECT count(*) FROM games g WHERE g.user_id = u.id AND g.source = 'bot' AND NOT g.deleted) AS games
         FROM user_data d JOIN users u ON u.id = d.user_id
         WHERE d.key = ${PROFILE} AND floor((d.value->'bots'->>'rating')::float / 200) * 200 = $1 ORDER BY bots DESC`,
        [lo],
      ),
    };
  },
  eloPuzzles: async () => ({
    title: 'Elo problèmes',
    cols: [C.user, C.puzzles, { key: 'solved', label: 'Réussis', type: 'num' }, { key: 'failed', label: 'Ratés', type: 'num' }, { key: 'best', label: 'Meilleure série', type: 'num' }, C.seen],
    rows: await q(
      `SELECT u.username, (d.value->'puzzles'->>'rating')::float AS puzzles,
              (d.value->'puzzleStats'->>'solved')::int AS solved, (d.value->'puzzleStats'->>'failed')::int AS failed,
              (d.value->'puzzleStats'->>'bestStreak')::int AS best, u.last_seen
       FROM user_data d JOIN users u ON u.id = d.user_id WHERE d.key = ${PROFILE} ORDER BY puzzles DESC NULLS LAST`,
    ),
  }),
  xp: async () => ({
    title: 'XP et étoiles de cours',
    cols: [C.user, C.xp, C.stars, { key: 'lessons', label: 'Leçons finies', type: 'num' }, { key: 'coins', label: 'Pièces', type: 'num' }, C.seen],
    rows: await q(
      `SELECT u.username, (d.value->>'xp')::float AS xp, ${STARS} AS stars,
              CASE WHEN jsonb_typeof(d.value->'lessons') = 'object' THEN (SELECT count(*) FROM jsonb_object_keys(d.value->'lessons')) ELSE 0 END AS lessons,
              (s.value->>'coins')::int AS coins, u.last_seen
       FROM user_data d JOIN users u ON u.id = d.user_id
       LEFT JOIN user_data s ON s.user_id = u.id AND s.key = ${SHOP}
       WHERE d.key = ${PROFILE} ORDER BY xp DESC NULLS LAST`,
    ),
  }),
  rush: async () => ({
    title: 'Puzzle Rush ces 30 derniers jours',
    cols: [
      C.user,
      { key: 'runs', label: 'Parties', type: 'num' },
      { key: 'r3', label: 'Record 3 min', type: 'num' },
      { key: 'r5', label: 'Record 5 min', type: 'num' },
      { key: 'surv', label: 'Record survie', type: 'num' },
      { key: 'last', label: 'Dernière', type: 'date' },
    ],
    rows: await q(
      `SELECT u.username, count(*) AS runs, max(r.score) FILTER (WHERE r.mode = '3') AS r3,
              max(r.score) FILTER (WHERE r.mode = '5') AS r5, max(r.score) FILTER (WHERE r.mode = 'survival') AS surv,
              max(r.created_at) AS last
       FROM rush_scores r JOIN users u ON u.id = r.user_id WHERE r.created_at > now() - interval '30 days'
       GROUP BY u.username ORDER BY runs DESC, u.username`,
    ),
  }),
  daily: async () => ({
    title: 'Problème du jour ces 30 derniers jours',
    cols: [
      C.user,
      { key: 'tries', label: 'Jours joués', type: 'num' },
      { key: 'solved', label: 'Résolus', type: 'num' },
      { key: 'first', label: 'Du 1er coup', type: 'num' },
      { key: 'secs', label: 'Temps moyen (s)', type: 'num' },
      { key: 'last', label: 'Dernier', type: 'text' },
    ],
    rows: await q(
      `SELECT u.username, count(*) AS tries, count(*) FILTER (WHERE r.solved) AS solved, count(*) FILTER (WHERE r.first_try) AS first,
              avg(r.seconds) FILTER (WHERE r.solved) AS secs, max(r.day) AS last
       FROM daily_results r JOIN users u ON u.id = r.user_id WHERE r.day > to_char(${DAY} - 30, 'YYYY-MM-DD')
       GROUP BY u.username ORDER BY tries DESC, u.username`,
    ),
  }),
  chat: async () => ({
    title: 'Auteurs du salon ces 30 derniers jours',
    cols: [C.user, { key: 'n', label: 'Messages', type: 'num' }, { key: 'censored', label: 'Censurés', type: 'num' }, { key: 'last', label: 'Dernier', type: 'date' }],
    rows: await q(
      `SELECT u.username, count(*) AS n, count(*) FILTER (WHERE m.censored) AS censored, max(m.created_at) AS last
       FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.created_at > now() - interval '30 days'
       GROUP BY u.username ORDER BY n DESC, u.username`,
    ),
  }),
  referrals: async () => ({
    title: 'Parrainages',
    cols: [
      { key: 'created_at', label: 'Date', type: 'date' },
      { key: 'referrer', label: 'Parrain', type: 'user' },
      { key: 'referee', label: 'Filleul', type: 'user' },
      { key: 'event', label: 'Événement', type: 'text' },
    ],
    rows: await q(
      `SELECT r.created_at, a.username AS referrer, b.username AS referee, r.event FROM referrals r
       JOIN users a ON a.id = r.referrer_id JOIN users b ON b.id = r.referee_id ORDER BY r.created_at DESC`,
    ),
  }),
};

export async function adminList(kind, params) {
  const fn = LISTS[kind];
  if (!fn) return null;
  const r = await fn(params);
  const num = (v) => (v === null || v === undefined ? null : typeof v === 'number' ? v : typeof v === 'boolean' ? v : Number.isNaN(Number(v)) ? v : Number(v));
  return {
    title: r.title,
    cols: r.cols,
    rows: r.rows.map((row) => {
      const o = {};
      for (const c of r.cols) {
        const v = row[c.key];
        o[c.key] = c.type === 'num' ? num(v) : v instanceof Date ? v.toISOString() : (v ?? null);
      }
      return o;
    }),
  };
}

/* ---------------- Fiche d'un joueur ---------------- */

export async function adminUser(name) {
  const [u] = await q(
    `SELECT u.id, u.username, u.created_at, u.last_seen, u.email, u.email_verified, u.avatar IS NOT NULL AS photo,
            u.online_rating, u.online_games, u.invite_code, ${LAST_SYNC} AS last_sync
     FROM users u WHERE lower(u.username) = lower($1)`,
    [name],
  );
  if (!u) return null;
  const id = u.id;
  const [data, games, sources, lastGames, online, rush, daily, chat, friends, referrer, referees, support, rewards, dms] = await Promise.all([
    q(`SELECT key, value, updated_at FROM user_data WHERE user_id = $1 AND key IN (${PROFILE}, ${SHOP}, ${ACH}, 'bettermove.settings.v1')`, [id]),
    q(
      `SELECT count(*) AS total, count(*) FILTER (WHERE played_at > now() - interval '30 days') AS d30,
              count(*) FILTER (WHERE played_at > now() - interval '7 days') AS d7, min(played_at) AS first, max(played_at) AS last
       FROM games WHERE user_id = $1 AND NOT deleted`,
      [id],
    ),
    q(`SELECT coalesce(source, 'autre') AS source, count(*) AS n FROM games WHERE user_id = $1 AND NOT deleted GROUP BY 1 ORDER BY 2 DESC`, [id]),
    q(
      `SELECT played_at, source, result, data->>'white' AS white, data->>'black' AS black, data->>'timeControl' AS tc
       FROM games WHERE user_id = $1 AND NOT deleted ORDER BY played_at DESC NULLS LAST LIMIT 15`,
      [id],
    ),
    q(
      `SELECT count(*) AS n,
              count(*) FILTER (WHERE (white_id = $1 AND result = '1-0') OR (black_id = $1 AND result = '0-1')) AS won,
              count(*) FILTER (WHERE result = '1/2-1/2') AS drawn,
              count(*) FILTER (WHERE (white_id = $1 AND result = '0-1') OR (black_id = $1 AND result = '1-0')) AS lost,
              count(*) FILTER (WHERE status = 'active') AS live
       FROM online_games WHERE white_id = $1 OR black_id = $1`,
      [id],
    ),
    q(`SELECT mode, count(*) AS runs, max(score) AS best FROM rush_scores WHERE user_id = $1 GROUP BY mode`, [id]),
    q(
      `SELECT count(*) AS n, count(*) FILTER (WHERE solved) AS solved, count(*) FILTER (WHERE first_try) AS first, max(day) AS last
       FROM daily_results WHERE user_id = $1`,
      [id],
    ),
    q(`SELECT count(*) AS n, count(*) FILTER (WHERE censored) AS censored, max(created_at) AS last FROM chat_messages WHERE user_id = $1`, [id]),
    q(
      `SELECT count(*) FILTER (WHERE status = 'accepted') AS friends, count(*) FILTER (WHERE status = 'pending') AS pending
       FROM friendships WHERE requester_id = $1 OR addressee_id = $1`,
      [id],
    ),
    q(`SELECT a.username, r.created_at FROM referrals r JOIN users a ON a.id = r.referrer_id WHERE r.referee_id = $1`, [id]),
    q(`SELECT b.username, r.created_at FROM referrals r JOIN users b ON b.id = r.referee_id WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`, [id]),
    q(`SELECT id, subject, category, handled, created_at FROM support_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
    q(`SELECT coins, items, reason, created_at, claimed_at FROM pending_rewards WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
    q(`SELECT count(*) FILTER (WHERE from_id = $1) AS sent, count(*) FILTER (WHERE to_id = $1) AS received FROM direct_messages WHERE from_id = $1 OR to_id = $1`, [id]),
  ]);
  const val = (k) => data.find((r) => r.key === `bettermove.${k}`)?.value ?? null;
  const p = val('profile.v1') ?? {};
  const shop = val('shop.v1') ?? {};
  const ach = val('achievements.v1');
  const settings = val('settings.v1') ?? {};
  const lessons = p.lessons && typeof p.lessons === 'object' ? Object.values(p.lessons) : [];
  const n = (v) => (v === null || v === undefined ? null : Number(v));
  const g = games[0] ?? {};
  const o = online[0] ?? {};
  const d = daily[0] ?? {};
  const c = chat[0] ?? {};
  return {
    username: u.username,
    createdAt: u.created_at,
    lastSeen: u.last_seen,
    lastSync: u.last_sync,
    email: u.email,
    emailVerified: u.email_verified,
    photo: u.photo,
    inviteCode: u.invite_code,
    synced: data.length > 0,
    keys: data.length,
    settings: { lang: settings.lang ?? null, notation: settings.notation ?? null },
    ratings: {
      bots: n(p.bots?.rating),
      puzzles: n(p.puzzles?.rating),
      online: u.online_games > 0 ? n(u.online_rating) : null,
      onlineGames: n(u.online_games),
    },
    xp: n(p.xp),
    lessons: { done: lessons.length, stars: lessons.reduce((s, l) => s + (Number(l?.stars) || 0), 0) },
    beaten: Array.isArray(p.beaten) ? p.beaten : [],
    puzzleStats: p.puzzleStats ?? null,
    coins: n(shop.coins),
    owned: Array.isArray(shop.owned) ? shop.owned.length : null,
    achievements: ach && typeof ach === 'object' ? Object.keys(ach).length : null,
    games: { total: n(g.total) ?? 0, d30: n(g.d30) ?? 0, d7: n(g.d7) ?? 0, first: g.first ?? null, last: g.last ?? null },
    sources: sources.map((r) => ({ source: r.source, n: n(r.n) })),
    lastGames: lastGames.map((r) => ({ at: r.played_at, source: r.source, result: r.result, white: r.white, black: r.black, tc: r.tc })),
    online: { n: n(o.n) ?? 0, won: n(o.won) ?? 0, drawn: n(o.drawn) ?? 0, lost: n(o.lost) ?? 0, live: n(o.live) ?? 0 },
    rush: rush.map((r) => ({ mode: r.mode, runs: n(r.runs), best: n(r.best) })),
    daily: { n: n(d.n) ?? 0, solved: n(d.solved) ?? 0, first: n(d.first) ?? 0, last: d.last ?? null },
    chat: { n: n(c.n) ?? 0, censored: n(c.censored) ?? 0, last: c.last ?? null },
    dms: { sent: n(dms[0]?.sent) ?? 0, received: n(dms[0]?.received) ?? 0 },
    friends: { n: n(friends[0]?.friends) ?? 0, pending: n(friends[0]?.pending) ?? 0 },
    referrer: referrer[0] ? { username: referrer[0].username, at: referrer[0].created_at } : null,
    referees: referees.map((r) => ({ username: r.username, at: r.created_at })),
    support: support.map((r) => ({ id: Number(r.id), subject: r.subject, category: r.category, handled: r.handled, at: r.created_at })),
    rewards: rewards.map((r) => ({ coins: r.coins, items: r.items, reason: r.reason, at: r.created_at, claimed: r.claimed_at })),
  };
}

/* ---------------- Audience : visiteurs connectes ou non (anonyme, agrege) ---------------- */

export async function adminAudience(days, who) {
  const span = Math.min(395, Math.max(1, Math.round(Number(days) || 30)));
  // who : anon (non connectes), logged (connectes) ou all
  const cond = who === 'anon' ? 'AND NOT v.logged' : who === 'logged' ? 'AND v.logged' : '';
  const base = `FROM visits v WHERE v.day > ${DAY} - ${span} ${cond}`;
  // Seulement les visites mesurees en detail (les plus anciennes n'ont que le compte)
  const share = (col, none = 'inconnu') =>
    q(`SELECT coalesce(${col}, '${none}') AS label, count(*) AS n ${base} AND v.hits IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 25`).then((rows) =>
      rows.map((r) => ({ label: r.label, n: Number(r.n) })),
    );
  const [totals, devices, browsers, oses, langs, referrers, entries, pages, hours, weekdays, depth] = await Promise.all([
    q(
      `SELECT count(*) AS visitors, coalesce(sum(v.hits), 0) AS hits,
              count(*) FILTER (WHERE v.hits = 1) AS bounce, count(*) FILTER (WHERE v.hits IS NOT NULL) AS measured,
              avg(extract(epoch FROM v.last_at - v.first_at)) FILTER (WHERE v.last_at IS NOT NULL) AS secs
       ${base}`,
    ),
    share('v.device'),
    share('v.browser'),
    share('v.os'),
    share('v.lang'),
    share('v.referrer', 'accès direct'),
    share('v.first_path'),
    q(
      `SELECT p.path AS label, sum(p.n) AS views, count(DISTINCT p.visitor) AS visitors
       FROM visit_pages p JOIN visits v ON v.day = p.day AND v.visitor = p.visitor
       WHERE v.day > ${DAY} - ${span} ${cond} GROUP BY 1 ORDER BY 3 DESC, 2 DESC LIMIT 40`,
    ),
    q(
      `SELECT extract(hour FROM v.first_at AT TIME ZONE 'Europe/Paris')::int AS h, count(*) AS n
       ${base} AND v.first_at IS NOT NULL GROUP BY 1 ORDER BY 1`,
    ),
    q(`SELECT extract(isodow FROM v.day)::int AS d, count(*) AS n ${base} GROUP BY 1 ORDER BY 1`),
    q(
      `SELECT CASE WHEN v.hits >= 10 THEN '10+' WHEN v.hits >= 5 THEN '5–9' WHEN v.hits >= 2 THEN '2–4' ELSE '1' END AS label, count(*) AS n
       ${base} AND v.hits IS NOT NULL GROUP BY 1`,
    ),
  ]);
  const t = totals[0] ?? {};
  const measured = Number(t.measured) || 0;
  const order = ['1', '2–4', '5–9', '10+'];
  return {
    days: span,
    who: who === 'anon' || who === 'logged' ? who : 'all',
    visitors: Number(t.visitors) || 0,
    hits: Number(t.hits) || 0,
    measured,
    bounce: measured ? Number(t.bounce) / measured : null,
    pagesPerVisitor: measured ? Number(t.hits) / measured : null,
    avgSeconds: t.secs === null || t.secs === undefined ? null : Number(t.secs),
    devices,
    browsers,
    oses,
    langs,
    referrers,
    entries,
    pages: pages.map((r) => ({ label: r.label, views: Number(r.views), visitors: Number(r.visitors) })),
    hours: Array.from({ length: 24 }, (_, h) => ({ h, n: Number(hours.find((r) => r.h === h)?.n ?? 0) })),
    weekdays: Array.from({ length: 7 }, (_, i) => ({ d: i + 1, n: Number(weekdays.find((r) => r.d === i + 1)?.n ?? 0) })),
    depth: order.map((label) => ({ label, n: Number(depth.find((r) => r.label === label)?.n ?? 0) })),
  };
}
