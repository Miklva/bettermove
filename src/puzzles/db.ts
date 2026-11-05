// Acces aux problemes stockes dans public/puzzles/ (tranches de 50 Elo, fichiers de 5000 problemes).
import { load, save } from '../lib/storage';

export interface Puzzle {
  id: string;
  fen: string;
  /** Coups UCI : le premier est le coup de l'adversaire, ensuite la solution */
  moves: string[];
  rating: number;
  themes: string[];
  /** Emplacement dans la base (tranche-fichier-id) : sert aux liens directs */
  ref?: string;
}

interface Index {
  total: number;
  bandSize: number;
  themes: string[];
  bands: { min: number; count: number; chunks: number }[];
}

type Raw = [string, string, string, number, number[]?];

const BASE = `${import.meta.env.BASE_URL}puzzles/`;
const SEEN_KEY = 'bettermove.puzzlesSeen';
const MAX_SEEN = 5000;

let indexPromise: Promise<Index> | null = null;
const cache = new Map<string, Raw[]>();

export function loadIndex(): Promise<Index> {
  if (!indexPromise)
    indexPromise = fetch(`${BASE}index.json`).then((r) => {
      if (!r.ok) throw new Error('index des problemes introuvable');
      return r.json();
    });
  return indexPromise;
}

async function loadChunk(band: number, n: number): Promise<Raw[]> {
  const key = `b${band}-${n}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`${BASE}${key}.json`);
  if (!res.ok) throw new Error(`fichier ${key} introuvable`);
  const data = (await res.json()) as Raw[];
  if (cache.size > 30) cache.delete(cache.keys().next().value!);
  cache.set(key, data);
  return data;
}

const seen = new Set<string>(load<string[]>(SEEN_KEY, []));
export function markSeen(id: string) {
  seen.add(id);
  const arr = [...seen].slice(-MAX_SEEN);
  save(SEEN_KEY, arr);
}

function toPuzzle(r: Raw, idx: Index): Puzzle {
  return {
    id: r[0],
    fen: r[1],
    moves: r[2].split(' '),
    rating: r[3],
    themes: (r[4] ?? []).map((i) => idx.themes[i]).filter(Boolean),
  };
}

/** Tire un probleme non vu, proche de l'Elo vise, eventuellement filtre par theme */
export async function nextPuzzle(target: number, theme?: string): Promise<Puzzle> {
  const idx = await loadIndex();
  const themeId = theme ? idx.themes.indexOf(theme) : -1;
  if (theme && themeId < 0) throw new Error('theme indisponible');

  for (let attempt = 0; attempt < 12; attempt++) {
    // Fenetre qui s'elargit si on ne trouve rien
    const width = 100 + attempt * 75;
    let bands = idx.bands.filter((b) => b.min + idx.bandSize > target - width && b.min < target + width);
    if (!bands.length) {
      const nearest = [...idx.bands].sort((x, y) => Math.abs(x.min - target) - Math.abs(y.min - target))[0];
      bands = nearest ? [nearest] : [];
    }
    if (!bands.length) break;
    // Tirage pondere par le nombre de problemes de chaque tranche
    const total = bands.reduce((s, b) => s + b.count, 0);
    let r = Math.random() * total;
    const band = bands.find((b) => (r -= b.count) <= 0) ?? bands[0];
    const n = Math.floor(Math.random() * band.chunks);
    const chunk = await loadChunk(band.min, n);
    const pool = chunk.filter((p) => !seen.has(p[0]) && (themeId < 0 || p[4]?.includes(themeId)));
    if (pool.length) {
      const raw = pool[Math.floor(Math.random() * pool.length)];
      return { ...toPuzzle(raw, idx), ref: `${band.min}-${n}-${raw[0]}` };
    }
  }
  throw new Error('Aucun problème trouvé pour ces critères');
}

/** Probleme precis a partir de son lien (voir Puzzle.ref) */
export async function puzzleByRef(ref: string): Promise<Puzzle> {
  const m = /^(\d+)-(\d+)-(.+)$/.exec(ref);
  if (!m) throw new Error('lien de problème invalide');
  const idx = await loadIndex();
  const band = idx.bands.find((b) => b.min === Number(m[1]));
  if (!band || Number(m[2]) >= band.chunks) throw new Error('problème introuvable');
  const chunk = await loadChunk(band.min, Number(m[2]));
  const raw = chunk.find((p) => p[0] === m[3]);
  if (!raw) throw new Error('problème introuvable');
  return { ...toPuzzle(raw, idx), ref };
}

/* ---------------- Probleme du jour ---------------- */

/** Difficulte selon le jour : facile le lundi, coriace le dimanche */
export const DAILY_TARGET = [2000, 1000, 1200, 1400, 1500, 1650, 1800]; // dimanche = 0

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Date du jour (heure de Paris) au format AAAA-MM-JJ : la meme pour tout le monde */
export function todayKey(d = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d);
}

/** Le meme probleme pour tous les joueurs un jour donne */
export async function dailyPuzzle(day = todayKey()): Promise<Puzzle> {
  const idx = await loadIndex();
  const weekday = new Date(`${day}T12:00:00`).getDay();
  const target = DAILY_TARGET[weekday];
  const bands = idx.bands.filter((b) => b.count > 0).sort((a, b) => Math.abs(a.min - target) - Math.abs(b.min - target));
  if (!bands.length) throw new Error('aucun probleme disponible');
  const h = hash(`bettermove-${day}`);
  // Parmi les 3 tranches les plus proches, pour varier
  const band = bands[h % Math.min(3, bands.length)];
  const chunk = await loadChunk(band.min, (h >>> 3) % Math.max(1, band.chunks));
  const raw = chunk[(h >>> 7) % chunk.length];
  return { ...toPuzzle(raw, idx), ref: `${band.min}-${(h >>> 3) % Math.max(1, band.chunks)}-${raw[0]}` };
}
