// Puzzle Rush : records locaux par mode et historique des dernieres parties
import { load, save } from '../lib/storage';
import { FACTS_EVENT } from '../achievements/facts';

export type RushMode = '3' | '5' | 'survival';

export const RUSH_MODES: { id: RushMode; label: string; icon: string; seconds: number | null; desc: string }[] = [
  { id: '3', label: '3 minutes', icon: '⚡', seconds: 180, desc: 'Un maximum de problèmes en 3 minutes.' },
  { id: '5', label: '5 minutes', icon: '⏱️', seconds: 300, desc: 'Plus de temps, des problèmes plus durs à la fin.' },
  { id: 'survival', label: 'Survie', icon: '🛡️', seconds: null, desc: 'Pas de chrono : tu vas jusqu’à ta 3e erreur.' },
];

export const RUSH_STRIKES = 3;

/** Elo vise pour le n-ieme probleme : on commence facile et ca monte vite */
export function rushTarget(n: number) {
  return Math.min(2700, 500 + n * 55 + Math.max(0, n - 20) * 25);
}

interface RushData {
  best: Partial<Record<RushMode, number>>;
  runs: { mode: RushMode; score: number; at: string }[];
}

const KEY = 'bettermove.rush.v1';

export const loadRush = () => load<RushData>(KEY, { best: {}, runs: [] });

/** Enregistre une partie. Renvoie true si c'est un nouveau record. */
export function recordRun(mode: RushMode, score: number): boolean {
  const d = loadRush();
  const record = score > (d.best[mode] ?? 0);
  if (record) d.best[mode] = score;
  d.runs = [{ mode, score, at: new Date().toISOString() }, ...d.runs].slice(0, 500);
  save(KEY, d);
  window.dispatchEvent(new Event(FACTS_EVENT));
  return record;
}
