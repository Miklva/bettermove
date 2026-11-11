// Compteurs d'actions du joueur (messages, achats, plein ecran...) pour les succes.
// Stockes localement et synchronises avec le compte.
import { load, save } from '../lib/storage';
import { FACTS_EVENT } from './facts';

const KEY = 'bettermove.events.v1';

export type Events = Record<string, number>;

export const loadEvents = () => load<Events>(KEY, {});

let pending = false;
function changed() {
  // Plusieurs actions dans le meme instant : une seule reevaluation des succes
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    window.dispatchEvent(new Event(FACTS_EVENT));
  }, 50);
}

/* ---- Compteurs du jour et de la semaine (quetes) ---- */

const DAY_KEY = 'bettermove.today.v1';
const WEEK_KEY = 'bettermove.week.v1';
export const PERIOD_EVENT = 'bettermove-period';

/** Jour local AAAA-MM-JJ */
export function dayId(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Semaine : date du lundi */
export function weekId(d = new Date()) {
  const m = new Date(d);
  m.setHours(12, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return dayId(m);
}
interface Period {
  id: string;
  c: Events;
}
export function periodCounts(kind: 'day' | 'week'): Events {
  const id = kind === 'day' ? dayId() : weekId();
  const p = load<Period>(kind === 'day' ? DAY_KEY : WEEK_KEY, { id, c: {} });
  return p.id === id ? p.c : {};
}
function bumpPeriod(kind: 'day' | 'week', name: string, n: number) {
  const id = kind === 'day' ? dayId() : weekId();
  const key = kind === 'day' ? DAY_KEY : WEEK_KEY;
  const p = load<Period>(key, { id, c: {} });
  const c = p.id === id ? p.c : {};
  c[name] = (c[name] ?? 0) + n;
  save(key, { id, c });
}

/** Ajoute n a un compteur (total, du jour et de la semaine) */
export function track(name: string, n = 1) {
  if (!n) return;
  const e = loadEvents();
  e[name] = (e[name] ?? 0) + n;
  save(KEY, e);
  bumpPeriod('day', name, n);
  bumpPeriod('week', name, n);
  window.dispatchEvent(new CustomEvent(PERIOD_EVENT, { detail: name }));
  changed();
}

/** Garde le maximum atteint */
export function trackMax(name: string, value: number) {
  const e = loadEvents();
  if ((e[name] ?? 0) >= value) return;
  e[name] = value;
  save(KEY, e);
  changed();
}

/** Marque une action unique (0 ou 1) */
export const mark = (name: string) => trackMax(name, 1);
