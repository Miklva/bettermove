// Astuces : epinglees, acquises, et astuces ecrites par le joueur
import { load, save } from '../lib/storage';
import type { TipCat } from './library';

export interface CustomTip {
  id: string;
  cat: TipCat;
  text: string;
  at: string;
}

export interface TipsData {
  custom: CustomTip[];
  pinned: string[];
  /** id -> date ou le joueur l'a marquee comme acquise */
  learned: Record<string, string>;
}

const KEY = 'bettermove.tips.v1';
export const loadTips = () => load<TipsData>(KEY, { custom: [], pinned: [], learned: {} });
export const saveTips = (d: TipsData) => {
  save(KEY, d);
  window.dispatchEvent(new Event('bettermove-facts'));
};

export function togglePin(id: string) {
  const d = loadTips();
  d.pinned = d.pinned.includes(id) ? d.pinned.filter((x) => x !== id) : [id, ...d.pinned];
  saveTips(d);
  return d;
}

export function toggleLearned(id: string) {
  const d = loadTips();
  if (d.learned[id]) delete d.learned[id];
  else d.learned[id] = new Date().toISOString();
  saveTips(d);
  return d;
}

export function addCustom(text: string, cat: TipCat) {
  const d = loadTips();
  const tip = { id: `u${Date.now().toString(36)}`, cat, text: text.trim().slice(0, 400), at: new Date().toISOString() };
  d.custom = [tip, ...d.custom];
  // Une astuce perso est epinglee d'office : c'est un rappel que le joueur veut voir
  d.pinned = [tip.id, ...d.pinned];
  saveTips(d);
  return d;
}

export function updateCustom(id: string, text: string, cat: TipCat) {
  const d = loadTips();
  d.custom = d.custom.map((c) => (c.id === id ? { ...c, text: text.trim().slice(0, 400), cat } : c));
  saveTips(d);
  return d;
}

export function removeCustom(id: string) {
  const d = loadTips();
  d.custom = d.custom.filter((c) => c.id !== id);
  d.pinned = d.pinned.filter((x) => x !== id);
  delete d.learned[id];
  saveTips(d);
  return d;
}
