// Repertoire d'ouvertures : ouvertures choisies, lignes perso, statistiques d'entrainement (repetition espacee).
import { load, save } from '../lib/storage';
import { dayKey, daysUntil, SRS_DAYS } from '../review/store';
import { REP_OPENINGS, repOpening } from './lines';

export type Side = 'w' | 'b';

export interface CustomLine {
  id: string;
  name: string;
  color: Side;
  line: string;
}

interface LineStat {
  box: number;
  due: string;
  seen: number;
  errors: number;
}

interface RepData {
  chosen: string[];
  custom: CustomLine[];
  stats: Record<string, LineStat>;
}

const KEY = 'bettermove.repertoire.v1';
const listeners = new Set<() => void>();

export const loadRep = () => load<RepData>(KEY, { chosen: [], custom: [], stats: {} });
function store(d: RepData) {
  save(KEY, d);
  listeners.forEach((f) => f());
}
export function subscribeRep(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface RepLine {
  key: string;
  color: Side;
  sans: string[];
  name: string;
  sourceId: string;
  custom: boolean;
}

const lineKey = (color: Side, line: string) => `${color}:${line}`;

/** Toutes les lignes actives d'un camp */
export function activeLines(color: Side, d = loadRep()): RepLine[] {
  const out: RepLine[] = [];
  for (const id of d.chosen) {
    const o = repOpening(id);
    if (!o || o.color !== color) continue;
    for (const l of o.lines)
      out.push({ key: lineKey(color, l), color, sans: l.split(' '), name: o.name, sourceId: o.id, custom: false });
  }
  for (const c of d.custom)
    if (c.color === color)
      out.push({ key: lineKey(color, c.line), color, sans: c.line.split(' '), name: c.name, sourceId: c.id, custom: true });
  return out;
}

const isUserTurn = (ply: number, color: Side) => (ply % 2 === 0) === (color === 'w');

/** Premier conflit entre de nouvelles lignes et le repertoire : deux coups differents pour toi dans la meme position */
export function findConflict(color: Side, lines: string[], name: string, ignoreSource?: string) {
  const mine = new Map<string, { move: string; name: string }>();
  for (const l of activeLines(color)) {
    if (l.sourceId === ignoreSource) continue;
    l.sans.forEach((s, i) => {
      if (isUserTurn(i, color)) mine.set(l.sans.slice(0, i).join(' '), { move: s, name: l.name });
    });
  }
  for (const l of lines) {
    const sans = l.split(' ');
    for (let i = 0; i < sans.length; i++) {
      if (!isUserTurn(i, color)) continue;
      const k = sans.slice(0, i).join(' ');
      const have = mine.get(k);
      if (have && have.move !== sans[i]) return { prefix: sans.slice(0, i), yours: have.move, other: sans[i], with: have.name, name };
    }
  }
  return null;
}

export function toggleOpening(id: string): { ok: boolean; conflict?: ReturnType<typeof findConflict> } {
  const d = loadRep();
  if (d.chosen.includes(id)) {
    store({ ...d, chosen: d.chosen.filter((x) => x !== id) });
    return { ok: true };
  }
  const o = repOpening(id)!;
  const conflict = findConflict(o.color, o.lines, o.name);
  if (conflict) return { ok: false, conflict };
  store({ ...d, chosen: [...d.chosen, id] });
  return { ok: true };
}

/** Remplace les ouvertures en conflit par celle-ci */
export function replaceWith(id: string) {
  const o = repOpening(id)!;
  let d = loadRep();
  for (let guard = 0; guard < 20; guard++) {
    const c = findConflict(o.color, o.lines, o.name);
    if (!c) break;
    const victim = activeLines(o.color, d).find((l) => l.name === c.with);
    if (!victim) break;
    d = victim.custom
      ? { ...d, custom: d.custom.filter((x) => x.id !== victim.sourceId) }
      : { ...d, chosen: d.chosen.filter((x) => x !== victim.sourceId) };
    store(d);
  }
  store({ ...loadRep(), chosen: [...loadRep().chosen, id] });
}

export function addCustomLine(color: Side, sans: string[], name: string) {
  const line = sans.join(' ');
  const conflict = findConflict(color, [line], name);
  if (conflict) return { ok: false as const, conflict };
  const d = loadRep();
  if (d.custom.some((c) => c.color === color && c.line === line)) return { ok: true as const };
  store({ ...d, custom: [...d.custom, { id: `c${Date.now().toString(36)}`, name: name || 'Ma ligne', color, line }] });
  return { ok: true as const };
}

export function removeCustom(id: string) {
  const d = loadRep();
  store({ ...d, custom: d.custom.filter((c) => c.id !== id) });
}

/* ---------------- Entrainement ---------------- */

export function lineStat(key: string, d = loadRep()): LineStat | null {
  return d.stats[key] ?? null;
}

/** Lignes a travailler : nouvelles et dues d'abord, puis les moins bien connues */
export function dueLines(color: Side | 'all', d = loadRep()): RepLine[] {
  const today = dayKey();
  const all = color === 'all' ? [...activeLines('w', d), ...activeLines('b', d)] : activeLines(color, d);
  return all.filter((l) => {
    const s = d.stats[l.key];
    return !s || s.due <= today;
  });
}

export function repSummary(d = loadRep()) {
  const all = [...activeLines('w', d), ...activeLines('b', d)];
  const today = dayKey();
  let learned = 0;
  let due = 0;
  for (const l of all) {
    const s = d.stats[l.key];
    if (s && s.box >= 2) learned++;
    if (!s || s.due <= today) due++;
  }
  return { total: all.length, learned, due };
}

/** Pioche la prochaine ligne a travailler */
export function pickLine(color: Side | 'all', exclude?: string, filter?: (l: RepLine) => boolean): RepLine | null {
  const d = loadRep();
  let pool = dueLines(color, d).filter((l) => (filter ? filter(l) : true));
  if (!pool.length) {
    // Rien de du : on prend les moins bien connues
    const all = color === 'all' ? [...activeLines('w', d), ...activeLines('b', d)] : activeLines(color, d);
    pool = all
      .filter((l) => (filter ? filter(l) : true))
      .sort((a, b) => (d.stats[a.key]?.box ?? 0) - (d.stats[b.key]?.box ?? 0) || (d.stats[a.key]?.due ?? '').localeCompare(d.stats[b.key]?.due ?? ''));
  }
  const candidates = pool.filter((l) => l.key !== exclude);
  const list = candidates.length ? candidates : pool;
  // Les lignes jamais vues passent en premier, dans l'ordre (on apprend l'ouverture de facon progressive)
  const fresh = list.filter((l) => !d.stats[l.key]);
  if (fresh.length) return fresh[0];
  return list[Math.floor(Math.random() * Math.min(list.length, 3))] ?? null;
}

/** Fin d'une ligne : sans erreur elle s'espace, avec erreur elle revient demain */
export function recordLine(key: string, errors: number) {
  const d = loadRep();
  const today = dayKey();
  const s = d.stats[key] ?? { box: 0, due: today, seen: 0, errors: 0 };
  const early = s.seen > 0 && s.due > today;
  let box = s.box;
  if (errors > 0) box = 0;
  else if (!early) box = Math.min(box + 1, SRS_DAYS.length);
  const add = SRS_DAYS[Math.max(0, Math.min(box, SRS_DAYS.length) - 1)] ?? 1;
  const due = errors > 0 ? shift(today, 1) : early ? s.due : shift(today, box === 0 ? 1 : add);
  d.stats[key] = { box, due, seen: s.seen + 1, errors: s.errors + errors };
  store(d);
  return d.stats[key];
}

function shift(day: string, n: number) {
  const x = new Date(`${day}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export const whenText = (day: string) => {
  const n = daysUntil(day);
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`;
};

/** Maitrise d'une ouverture : part des lignes connues (boite 2 ou plus) */
export function openingMastery(id: string, d = loadRep()) {
  const o = repOpening(id) ?? null;
  const lines = o ? o.lines.map((l) => lineKey(o.color, l)) : [];
  if (!lines.length) return 0;
  return lines.filter((k) => (d.stats[k]?.box ?? 0) >= 2).length / lines.length;
}

/* ---------------- Controle d'une partie ---------------- */

export interface RepCheck {
  status: 'userLeft' | 'oppLeft' | 'complete' | 'notCovered' | 'empty';
  /** Nombre de demi-coups suivis dans le repertoire */
  depth: number;
  played?: string;
  expected?: string;
  name?: string;
  prefix: string[];
}

export function checkGame(sans: string[], color: Side): RepCheck {
  const lines = activeLines(color);
  if (!lines.length) return { status: 'empty', depth: 0, prefix: [] };
  let pool = lines;
  for (let i = 0; i < sans.length; i++) {
    const next = pool.filter((l) => l.sans.length > i);
    if (!next.length) return { status: 'complete', depth: i, prefix: sans.slice(0, i), name: pool[0]?.name };
    const match = next.filter((l) => l.sans[i] === sans[i]);
    if (!match.length) {
      const base = { depth: i, prefix: sans.slice(0, i), played: sans[i], name: pool[0]?.name };
      if (isUserTurn(i, color)) return { status: 'userLeft', expected: next[0].sans[i], ...base };
      return { status: i < 2 ? 'notCovered' : 'oppLeft', ...base };
    }
    pool = match;
  }
  return { status: 'complete', depth: sans.length, prefix: sans, name: pool[0]?.name };
}

// Ouverture directe d'une ligne (depuis la review)
let pending: { color: Side; prefix: string[] } | null = null;
export function openRepertoireAt(color: Side, prefix: string[]) {
  pending = { color, prefix };
}
export function takePending() {
  const p = pending;
  pending = null;
  return p;
}

export { REP_OPENINGS };
