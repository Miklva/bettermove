// Parties sauvegardees (pour la review) et deck "Mes erreurs" (pour s'entrainer dessus).
import { load, save } from '../lib/storage';
import type { Puzzle } from '../puzzles/db';

export interface SavedGame {
  id: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  date: string;
  source: 'local' | 'bot' | 'online' | 'chess.com' | 'lichess' | 'pgn';
  /** Camp de l'utilisateur (pour orienter le plateau et cibler ses erreurs) */
  userColor: 'w' | 'b';
  /** Date ISO precise (parties recentes) */
  playedAt?: string;
  userRating?: number;
  oppRating?: number;
  timeControl?: string;
  /** Champs calcules une fois puis memorises (voir enrichGames) */
  opening?: string;
  reason?: string;
  /** Fin de partie normalisee (mate, time, resign...) */
  end?: string;
  moves?: number;
  /** Partie importee ou l'utilisateur n'est aucun des deux joueurs */
  observer?: boolean;
  /** 1v1 : camp a prendre en compte dans le suivi ('none' = ne pas compter) */
  coachSide?: 'w' | 'b' | 'none';
}

const GAMES_KEY = 'bettermove.games.v1';
/** Parties jouees dans l'app (environ 1 Ko chacune) */
const MAX_GAMES = 1500;
/** Parties importees gardees dans le navigateur (PGN allege, environ 1 Ko chacune) */
const MAX_IMPORTED = 3000;

export function listGames(): SavedGame[] {
  return load<SavedGame[]>(GAMES_KEY, []);
}

const isImported = (g: SavedGame) => g.source !== 'bot' && g.source !== 'local' && g.source !== 'online';
const byDateDesc = (a: SavedGame, b: SavedGame) => (b.playedAt ?? '').localeCompare(a.playedAt ?? '');

/**
 * Ecrit la liste en respectant le quota du navigateur : les parties jouees dans l'app sont
 * toujours gardees, les plus anciennes parties importees sautent si la place manque
 * (elles restent sur le serveur quand le compte est synchronise).
 */
function writeGames(list: SavedGame[]): boolean {
  const own = list.filter((g) => !isImported(g)).slice(0, MAX_GAMES);
  let imported = list.filter(isImported).sort(byDateDesc).slice(0, MAX_IMPORTED);
  for (;;) {
    const keep = new Set([...own, ...imported].map((g) => g.id));
    if (save(GAMES_KEY, list.filter((g) => keep.has(g.id)))) return true;
    if (!imported.length) return false;
    imported = imported.slice(0, Math.floor(imported.length * 0.75));
  }
}

export function saveGame(g: SavedGame) {
  const all = listGames();
  const prev = all.find((x) => x.id === g.id);
  const merged = prev ? { ...prev, ...g } : g;
  writeGames([merged, ...all.filter((x) => x.id !== g.id)]);
}

/** Ajoute des parties importees (les doublons sont ignores). Renvoie le nombre de nouvelles parties. */
export function saveImported(games: SavedGame[]): number {
  const all = listGames();
  const known = new Set(all.map((g) => g.id));
  const fresh = games.filter((g) => !known.has(g.id));
  if (!fresh.length) return 0;
  const merged = [...fresh, ...all].sort(byDateDesc);
  writeGames(merged);
  return fresh.length;
}

export function updateGames(patch: Record<string, Partial<SavedGame>>) {
  save(
    GAMES_KEY,
    listGames().map((g) => (patch[g.id] ? { ...g, ...patch[g.id] } : g)),
  );
}

export function deleteGame(id: string) {
  save(
    GAMES_KEY,
    listGames().filter((g) => g.id !== id),
  );
}

/* ---------------- Revisions (repetition espacee) ---------------- */
// Chaque position ratee revient a J+1, J+3, J+7, J+14 puis J+30.
// Reussie du premier coup : elle monte d'une boite. Ratee : retour a la boite 0 (demain).
// Reussie dans la derniere boite : elle est consideree comme memorisee et sort du deck.

export interface MistakeCard extends Puzzle {
  /** Ancien compteur (avant la repetition espacee), garde pour compatibilite */
  successes: number;
  addedAt: string;
  /** Description courte : "Partie contre Hugo, coup 14" */
  origin: string;
  /** Boite de Leitner : 0 = nouvelle ou ratee */
  box?: number;
  /** Date (AAAA-MM-JJ, heure de Paris) a partir de laquelle la carte est a revoir */
  due?: string;
  /** Nombre de passages */
  reviews?: number;
  lastResult?: 'ok' | 'ko';
}

export const SRS_DAYS = [1, 3, 7, 14, 30];
export const SRS_MAX = SRS_DAYS.length;

const MISTAKES_KEY = 'bettermove.myMistakes.v1';
const MASTERED_KEY = 'bettermove.srsMastered.v1';

export function dayKey(d = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d);
}
function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysUntil(day: string) {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${dayKey()}T12:00:00Z`)) / 86400000);
}

export function listMistakes(): MistakeCard[] {
  const today = dayKey();
  return load<MistakeCard[]>(MISTAKES_KEY, []).map((c) => ({
    ...c,
    box: c.box ?? Math.min(c.successes ?? 0, SRS_MAX - 1),
    due: c.due ?? today,
  }));
}

/** Cartes a revoir aujourd'hui (les plus en retard d'abord) */
export function dueMistakes(): MistakeCard[] {
  const today = dayKey();
  return listMistakes()
    .filter((c) => c.due! <= today)
    .sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : a.box! - b.box!));
}

export function srsStats() {
  const all = listMistakes();
  const today = dayKey();
  const due = all.filter((c) => c.due! <= today).length;
  const next = all.filter((c) => c.due! > today).map((c) => c.due!).sort()[0] ?? null;
  return { total: all.length, due, next, mastered: load<number>(MASTERED_KEY, 0) };
}

export function addMistakes(cards: Omit<MistakeCard, 'successes' | 'addedAt'>[]): number {
  const all = listMistakes();
  const ids = new Set(all.map((c) => c.id));
  const today = dayKey();
  const fresh = cards
    .filter((c) => !ids.has(c.id))
    .map((c) => ({ ...c, successes: 0, addedAt: new Date().toISOString(), box: 0, due: today, reviews: 0 }));
  if (!fresh.length) return 0;
  save(MISTAKES_KEY, [...all, ...fresh].slice(-400));
  return fresh.length;
}

/** Enregistre un passage. Renvoie la nouvelle boite (null = memorisee, sortie du deck). */
export function recordMistakeAttempt(id: string, success: boolean): { box: number | null; due: string | null } {
  const today = dayKey();
  let out: { box: number | null; due: string | null } = { box: null, due: null };
  const all: MistakeCard[] = [];
  for (const c of listMistakes()) {
    if (c.id !== id) {
      all.push(c);
      continue;
    }
    // Revoir une carte pas encore due ne la fait pas monter (pas de triche par repetition)
    const early = c.due! > today;
    if (success) {
      if (early) {
        all.push({ ...c, reviews: (c.reviews ?? 0) + 1, lastResult: 'ok' });
        out = { box: c.box!, due: c.due! };
        continue;
      }
      const box = c.box! + 1;
      if (box >= SRS_MAX) {
        save(MASTERED_KEY, load<number>(MASTERED_KEY, 0) + 1);
        out = { box: null, due: null };
        continue;
      }
      const due = addDays(today, SRS_DAYS[box]);
      all.push({ ...c, box, due, successes: box, reviews: (c.reviews ?? 0) + 1, lastResult: 'ok' });
      out = { box, due };
    } else {
      const due = addDays(today, SRS_DAYS[0]);
      all.push({ ...c, box: 0, due, successes: 0, reviews: (c.reviews ?? 0) + 1, lastResult: 'ko' });
      out = { box: 0, due };
    }
  }
  save(MISTAKES_KEY, all);
  return out;
}

/** Prochaine carte a revoir, en evitant de reproposer la meme tout de suite */
export function nextMistake(exclude?: string, early = false): MistakeCard | null {
  const list = early
    ? listMistakes().sort((a, b) => (a.due! < b.due! ? -1 : 1))
    : dueMistakes();
  return list.find((c) => c.id !== exclude) ?? list[0] ?? null;
}

/** Ajoute un probleme rate au deck de revision */
export function addFailedPuzzle(p: Puzzle, origin: string) {
  return addMistakes([{ ...p, origin }]);
}
