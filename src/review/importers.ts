// Import des parties depuis chess.com et Lichess (API publiques, sans compte).
import type { SavedGame } from './store';
export interface RemoteGame {
  id: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  date: string;
  timeControl: string;
  userColor: 'w' | 'b';
  url?: string;
}

const header = (pgn: string, key: string) => pgn.match(new RegExp(`\\[${key} "([^"]*)"\\]`))?.[1] ?? '';

/** chess.com : archives mensuelles, on lit les 2 derniers mois */
export async function fetchChessCom(username: string, max = 20): Promise<RemoteGame[]> {
  const user = username.trim().toLowerCase();
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
  if (res.status === 404) throw new Error('Joueur introuvable sur chess.com');
  if (!res.ok) throw new Error(`chess.com a répondu ${res.status}`);
  const { archives } = (await res.json()) as { archives: string[] };
  const out: RemoteGame[] = [];
  for (const url of [...archives].reverse().slice(0, 2)) {
    const r = await fetch(url);
    if (!r.ok) continue;
    const { games } = (await r.json()) as { games: { pgn?: string; url: string; end_time: number; time_control: string; rules: string }[] };
    for (const g of [...games].reverse()) {
      if (!g.pgn || g.rules !== 'chess') continue;
      const white = header(g.pgn, 'White');
      out.push({
        id: `chesscom-${g.url.split('/').pop()}`,
        pgn: g.pgn,
        white,
        black: header(g.pgn, 'Black'),
        result: header(g.pgn, 'Result'),
        date: new Date(g.end_time * 1000).toLocaleDateString('fr-FR'),
        timeControl: g.time_control,
        userColor: white.toLowerCase() === user ? 'w' : 'b',
        url: g.url,
      });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Lichess : flux NDJSON des dernieres parties */
export async function fetchLichess(username: string, max = 20): Promise<RemoteGame[]> {
  const user = username.trim();
  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${max}&pgnInJson=true&clocks=false&evals=false&opening=false`,
    { headers: { Accept: 'application/x-ndjson' } },
  );
  if (res.status === 404) throw new Error('Joueur introuvable sur Lichess');
  if (!res.ok) throw new Error(`Lichess a répondu ${res.status}`);
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((g) => g.variant === 'standard' && g.pgn)
    .map((g) => {
      const white = g.players?.white?.user?.name ?? 'Blancs';
      return {
        id: `lichess-${g.id}`,
        pgn: g.pgn as string,
        white,
        black: g.players?.black?.user?.name ?? 'Noirs',
        result: header(g.pgn, 'Result'),
        date: new Date(g.createdAt).toLocaleDateString('fr-FR'),
        timeControl: g.speed ?? '',
        userColor: white.toLowerCase() === user.toLowerCase() ? 'w' : 'b',
        url: `https://lichess.org/${g.id}`,
      } as RemoteGame;
    });
}

/* ---------------- Import complet (historique) ---------------- */


/** En-tetes conserves : le reste (commentaires d'horloge, liens...) est retire pour gagner de la place */
const KEEP_HEADERS = ['Event', 'Site', 'Date', 'White', 'Black', 'Result', 'UTCDate', 'UTCTime', 'WhiteElo', 'BlackElo', 'TimeControl', 'Termination', 'ECO', 'Link', 'SetUp', 'FEN'];

export function slimPgn(pgn: string): string {
  const headers = [...pgn.matchAll(/\[(\w+) "([^"]*)"\]/g)].filter((m) => KEEP_HEADERS.includes(m[1])).map((m) => m[0]);
  const body = pgn
    .replace(/\[[^\]]*\]\s*/g, '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.\.\.\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${headers.join('\n')}\n\n${body}`;
}

/** "600+5" -> "10 min | 5", "1/86400" -> "1 jour" */
function tcLabel(tc: string | undefined): string | undefined {
  if (!tc || tc === '-') return undefined;
  if (tc.includes('/')) {
    const days = Math.round(Number(tc.split('/')[1]) / 86400);
    return days ? `${days} jour${days > 1 ? 's' : ''}` : 'Par correspondance';
  }
  const [base, inc] = tc.split('+').map(Number);
  if (!base) return undefined;
  const b = base >= 60 ? `${Math.round(base / 60)} min` : `${base} s`;
  return inc ? `${b} | ${inc}` : b;
}

export type Site = 'chesscom' | 'lichess';

export interface ImportProgress {
  /** Texte d'avancement, ex. "Mois 4/37" */
  step: string;
  found: number;
  added: number;
}

interface ChessComGame {
  url: string;
  pgn?: string;
  end_time: number;
  time_control: string;
  rules: string;
  white: { username: string; rating?: number };
  black: { username: string; rating?: number };
}

function fromChessCom(g: ChessComGame, user: string): SavedGame {
  const white = g.white.username;
  const userColor = white.toLowerCase() === user ? 'w' : 'b';
  const pgn = g.pgn!;
  return {
    id: `chesscom-${g.url.split('/').pop()}`,
    pgn: slimPgn(pgn),
    white,
    black: g.black.username,
    result: header(pgn, 'Result') || '*',
    date: new Date(g.end_time * 1000).toLocaleDateString('fr-FR'),
    playedAt: new Date(g.end_time * 1000).toISOString(),
    source: 'chess.com',
    userColor,
    userRating: (userColor === 'w' ? g.white.rating : g.black.rating) ?? undefined,
    oppRating: (userColor === 'w' ? g.black.rating : g.white.rating) ?? undefined,
    timeControl: tcLabel(g.time_control),
    reason: header(pgn, 'Termination') || undefined,
  };
}

/**
 * Importe les parties chess.com, mois par mois. `since` (ms) limite aux parties plus recentes.
 * onBatch recoit les parties de chaque mois (pour les enregistrer au fur et a mesure).
 */
export async function importChessCom(
  username: string,
  since: number,
  onBatch: (games: SavedGame[]) => number,
  onProgress: (p: ImportProgress) => void,
): Promise<{ added: number; found: number; latest: number }> {
  const user = username.trim().toLowerCase();
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
  if (res.status === 404) throw new Error('Joueur introuvable sur chess.com');
  if (!res.ok) throw new Error(`chess.com a répondu ${res.status}`);
  const { archives } = (await res.json()) as { archives: string[] };
  // Archives de la forme .../games/2024/05 : on saute les mois deja importes
  const sinceMonth = since ? new Date(since).toISOString().slice(0, 7).replace('-', '/') : '';
  const months = archives.filter((u) => !sinceMonth || u.slice(-7) >= sinceMonth).reverse();
  let found = 0;
  let added = 0;
  let latest = since;
  for (let i = 0; i < months.length; i++) {
    onProgress({ step: `Mois ${i + 1}/${months.length} (${months[i].slice(-7)})`, found, added });
    const r = await fetch(months[i]);
    if (r.status === 429) {
      await new Promise((ok) => setTimeout(ok, 3000));
      i--;
      continue;
    }
    if (!r.ok) continue;
    const { games } = (await r.json()) as { games: ChessComGame[] };
    const list = games
      .filter((g) => g.pgn && g.rules === 'chess' && g.end_time * 1000 > since)
      .map((g) => fromChessCom(g, user));
    found += list.length;
    for (const g of games) latest = Math.max(latest, g.end_time * 1000);
    added += onBatch(list);
  }
  onProgress({ step: 'Terminé', found, added });
  return { added, found, latest };
}

interface LichessGame {
  id: string;
  variant: string;
  createdAt: number;
  lastMoveAt?: number;
  speed?: string;
  clock?: { initial: number; increment: number };
  players: {
    white: { user?: { name: string }; rating?: number; aiLevel?: number };
    black: { user?: { name: string }; rating?: number; aiLevel?: number };
  };
  pgn?: string;
}

function fromLichess(g: LichessGame, user: string): SavedGame {
  const name = (p: LichessGame['players']['white'], fallback: string) =>
    p.user?.name ?? (p.aiLevel ? `Stockfish niveau ${p.aiLevel}` : fallback);
  const white = name(g.players.white, 'Blancs');
  const userColor = white.toLowerCase() === user ? 'w' : 'b';
  const pgn = g.pgn!;
  const at = g.lastMoveAt ?? g.createdAt;
  return {
    id: `lichess-${g.id}`,
    pgn: slimPgn(pgn),
    white,
    black: name(g.players.black, 'Noirs'),
    result: header(pgn, 'Result') || '*',
    date: new Date(at).toLocaleDateString('fr-FR'),
    playedAt: new Date(at).toISOString(),
    source: 'lichess',
    userColor,
    userRating: userColor === 'w' ? g.players.white.rating : g.players.black.rating,
    oppRating: userColor === 'w' ? g.players.black.rating : g.players.white.rating,
    timeControl: g.clock ? tcLabel(`${g.clock.initial}+${g.clock.increment}`) : g.speed === 'correspondence' ? 'Par correspondance' : undefined,
    reason: header(pgn, 'Termination') || undefined,
  };
}

/** Importe les parties Lichess (flux NDJSON lu au fil de l'eau) */
export async function importLichess(
  username: string,
  since: number,
  onBatch: (games: SavedGame[]) => number,
  onProgress: (p: ImportProgress) => void,
): Promise<{ added: number; found: number; latest: number }> {
  const user = username.trim();
  const q = `pgnInJson=true&clocks=false&evals=false&opening=false&moves=true${since ? `&since=${since + 1}` : ''}`;
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?${q}`, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (res.status === 404) throw new Error('Joueur introuvable sur Lichess');
  if (res.status === 429) throw new Error('Lichess limite les requêtes : réessaie dans une minute');
  if (!res.ok || !res.body) throw new Error(`Lichess a répondu ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let batch: SavedGame[] = [];
  let found = 0;
  let added = 0;
  let latest = since;
  const flush = () => {
    if (batch.length) added += onBatch(batch);
    batch = [];
    onProgress({ step: `${found} parties lues`, found, added });
  };
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = done ? '' : lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const g = JSON.parse(line) as LichessGame;
        latest = Math.max(latest, g.lastMoveAt ?? g.createdAt);
        if (g.variant !== 'standard' || !g.pgn) continue;
        batch.push(fromLichess(g, user.toLowerCase()));
        found++;
      } catch {
        /* ligne incomplete : ignoree */
      }
    }
    if (batch.length >= 100) flush();
    if (done) break;
  }
  flush();
  onProgress({ step: 'Terminé', found, added });
  return { added, found, latest };
}
