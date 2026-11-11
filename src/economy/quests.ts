// Quetes du jour, defi de la semaine et coffre de connexion.
// La progression vient des compteurs du jour / de la semaine (achievements/events.ts).
import { useEffect, useState } from 'react';
import { load, save } from '../lib/storage';
import { dayId, periodCounts, PERIOD_EVENT, track, trackMax, weekId } from '../achievements/events';
import { reward } from './rewards';
import { t, tn } from '../i18n';

export interface Quest {
  id: string;
  icon: string;
  label: string;
  /** Compteur suivi (achievements/events) */
  event: string;
  target: number;
  coins: number;
  xp: number;
  /** Page ou faire la quete */
  go: string;
  /** Compte requis (jeu en ligne) */
  account?: boolean;
}

export const DAILY_QUESTS: Quest[] = [
  { id: 'bot-win', icon: '🤖', label: 'Gagner une partie contre un bot', event: 'bot-win', target: 1, coins: 20, xp: 40, go: 'bots' },
  { id: 'bot-3', icon: '♟️', label: 'Jouer 3 parties contre les bots', event: 'bot-game', target: 3, coins: 25, xp: 50, go: 'bots' },
  { id: 'pz-5', icon: '🧩', label: 'Réussir 5 problèmes', event: 'puzzle-win', target: 5, coins: 20, xp: 40, go: 'puzzles' },
  { id: 'pz-15', icon: '🧠', label: 'Réussir 15 problèmes', event: 'puzzle-win', target: 15, coins: 35, xp: 70, go: 'puzzles' },
  { id: 'daily', icon: '📅', label: 'Résoudre le problème du jour', event: 'daily-puzzle', target: 1, coins: 15, xp: 30, go: 'home' },
  { id: 'lesson', icon: '📚', label: 'Terminer une leçon', event: 'lesson-done', target: 1, coins: 20, xp: 40, go: 'lessons' },
  { id: 'review', icon: '🔬', label: 'Analyser une partie en review', event: 'review', target: 1, coins: 15, xp: 30, go: 'review' },
  { id: 'rush', icon: '⚡', label: 'Marquer 15 points en Puzzle Rush (au total)', event: 'rush-points', target: 15, coins: 25, xp: 50, go: 'rush' },
  { id: 'teacher', icon: '👨‍🏫', label: 'Finir une partie contre le professeur', event: 'teacher-game', target: 1, coins: 20, xp: 40, go: 'teacher' },
  { id: 'rep', icon: '📖', label: 'Réviser 5 lignes de répertoire', event: 'rep-line', target: 5, coins: 15, xp: 30, go: 'repertoire' },
  { id: 'online', icon: '🌍', label: 'Jouer une partie en ligne', event: 'online-game', target: 1, coins: 25, xp: 50, go: 'world', account: true },
  { id: 'online-win', icon: '🏆', label: 'Gagner une partie en ligne', event: 'online-win', target: 1, coins: 35, xp: 70, go: 'world', account: true },
  { id: 'chat', icon: '💬', label: 'Écrire un message dans un chat de partie', event: 'chat-msg', target: 1, coins: 10, xp: 20, go: 'bots' },
];

export const WEEKLY_QUESTS: Quest[] = [
  { id: 'w-wins', icon: '🏅', label: 'Gagner 10 parties (bots ou en ligne)', event: 'win-any', target: 10, coins: 150, xp: 250, go: 'bots' },
  { id: 'w-pz', icon: '🧩', label: 'Réussir 50 problèmes', event: 'puzzle-win', target: 50, coins: 120, xp: 200, go: 'puzzles' },
  { id: 'w-quests', icon: '🎯', label: 'Terminer 10 quêtes du jour', event: 'quest-done', target: 10, coins: 150, xp: 250, go: 'home' },
  { id: 'w-lessons', icon: '🎓', label: 'Terminer 3 leçons', event: 'lesson-done', target: 3, coins: 120, xp: 200, go: 'lessons' },
  { id: 'w-online', icon: '🌍', label: 'Jouer 5 parties en ligne', event: 'online-game', target: 5, coins: 150, xp: 250, go: 'world', account: true },
];

/** Toutes les quetes du jour terminees */
export const DAILY_BONUS = { coins: 40, xp: 80 };

/** Coffre de connexion : jour 1, 2, 3... de la serie (au-dela du 7e : comme le 7e) */
export const CHEST = [10, 15, 20, 25, 30, 40, 60];
export const chestFor = (streak: number) => {
  const coins = CHEST[Math.min(streak, CHEST.length) - 1];
  return { coins, xp: coins * 2 };
};

interface QuestState {
  day: string;
  daily: string[];
  claimed: string[];
  bonus: boolean;
  week: string;
  weekly: string;
  weekClaimed: boolean;
  /** Coffre : dernier jour ouvert et serie */
  chestDay: string | null;
  streak: number;
}

const KEY = 'bettermove.quests.v1';

/** Tirage deterministe (le meme pour un jour donne) */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function pick(pool: Quest[], n: number, seed: string): string[] {
  const rnd = seeded(seed);
  const left = [...pool];
  const out: Quest[] = [];
  while (out.length < n && left.length) {
    const q = left.splice(Math.floor(rnd() * left.length), 1)[0];
    // Pas deux quetes sur le meme compteur le meme jour
    if (!out.some((o) => o.event === q.event)) out.push(q);
  }
  return out.map((q) => q.id);
}

function fresh(prev: QuestState | null, hasAccount: boolean): QuestState {
  const day = dayId();
  const week = weekId();
  const pool = DAILY_QUESTS.filter((q) => hasAccount || !q.account);
  const wpool = WEEKLY_QUESTS.filter((q) => hasAccount || !q.account);
  let s: QuestState = prev ?? { day: '', daily: [], claimed: [], bonus: false, week: '', weekly: '', weekClaimed: false, chestDay: null, streak: 0 };
  if (s.day !== day) s = { ...s, day, daily: pick(pool, 3, `d${day}`), claimed: [], bonus: false };
  if (s.week !== week) s = { ...s, week, weekly: pick(wpool, 1, `w${week}`)[0], weekClaimed: false };
  return s;
}

export function loadQuests(hasAccount: boolean): QuestState {
  const prev = load<QuestState | null>(KEY, null);
  const s = fresh(prev, hasAccount);
  if (s !== prev) save(KEY, s);
  return s;
}

export const questById = (id: string) => [...DAILY_QUESTS, ...WEEKLY_QUESTS].find((q) => q.id === id);

export function progressOf(q: Quest, kind: 'day' | 'week') {
  const v = periodCounts(kind)[q.event] ?? 0;
  return { value: Math.min(v, q.target), done: v >= q.target };
}

export function claimDaily(hasAccount: boolean, id: string): boolean {
  const s = loadQuests(hasAccount);
  const q = questById(id);
  if (!q || !s.daily.includes(id) || s.claimed.includes(id) || !progressOf(q, 'day').done) return false;
  s.claimed = [...s.claimed, id];
  save(KEY, s);
  reward(q.coins, q.xp, t('Quête : {label}', { label: t(q.label) }));
  track('quest-done');
  return true;
}

export function claimBonus(hasAccount: boolean): boolean {
  const s = loadQuests(hasAccount);
  if (s.bonus || s.claimed.length < s.daily.length) return false;
  s.bonus = true;
  save(KEY, s);
  reward(DAILY_BONUS.coins, DAILY_BONUS.xp, t('Toutes les quêtes du jour'));
  return true;
}

export function claimWeekly(hasAccount: boolean): boolean {
  const s = loadQuests(hasAccount);
  const q = questById(s.weekly);
  if (!q || s.weekClaimed || !progressOf(q, 'week').done) return false;
  s.weekClaimed = true;
  save(KEY, s);
  reward(q.coins, q.xp, t('Défi de la semaine : {label}', { label: t(q.label) }));
  return true;
}

/** Ouvre le coffre du jour. Renvoie la recompense, ou null s'il est deja ouvert. */
export function openChest(hasAccount: boolean): { coins: number; xp: number; streak: number } | null {
  const s = loadQuests(hasAccount);
  const today = dayId();
  if (s.chestDay === today) return null;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  s.streak = s.chestDay === dayId(y) ? s.streak + 1 : 1;
  s.chestDay = today;
  save(KEY, s);
  const r = chestFor(s.streak);
  reward(r.coins, r.xp, tn(s.streak, 'Coffre du jour (série de {n} jour)', 'Coffre du jour (série de {n} jours)'));
  track('chest');
  trackMax('chest-streak', s.streak);
  return { ...r, streak: s.streak };
}

/** Recharge l'affichage quand un compteur change */
export function useQuestTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const on = () => setT((x) => x + 1);
    window.addEventListener(PERIOD_EVENT, on);
    const id = window.setInterval(on, 60_000);
    return () => {
      window.removeEventListener(PERIOD_EVENT, on);
      clearInterval(id);
    };
  }, []);
  return t;
}

/** Quetes du jour terminees mais pas encore recuperees (pastille) */
export function claimableCount(hasAccount: boolean) {
  const s = loadQuests(hasAccount);
  let n = s.chestDay === dayId() ? 0 : 1;
  for (const id of s.daily) {
    const q = questById(id);
    if (q && !s.claimed.includes(id) && progressOf(q, 'day').done) n++;
  }
  if (!s.bonus && s.claimed.length >= s.daily.length && s.daily.length) n++;
  const w = questById(s.weekly);
  if (w && !s.weekClaimed && progressOf(w, 'week').done) n++;
  return n;
}
