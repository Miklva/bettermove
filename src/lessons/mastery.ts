// Maitrise d'une lecon : apres le cours, des problemes du meme theme, en 5 paliers de plus en plus durs.
// Un palier est valide avec au moins 4 problemes sur 5 reussis du premier coup, sans indice.
import { useSyncExternalStore } from 'react';
import { load, save } from '../lib/storage';
import type { Lesson } from './courses';

export const MASTERY_KEY = 'bettermove.mastery.v1';
export const TIERS = 5;
export const PER_TIER = 5;
export const PASS = 4;

/** Ecart d'Elo de chaque palier par rapport au classement problemes du joueur */
const OFFSETS = [-350, -175, 0, 175, 350];
export const TIER_NAMES = ['Apprenti', 'Initié', 'Confirmé', 'Expert', 'Maître'];

/** Elo vise pour un palier (1 a 5) */
export function tierTarget(tier: number, puzzleRating: number): number {
  const base = Math.max(700, puzzleRating);
  return Math.max(450, Math.round(base + OFFSETS[Math.min(TIERS, Math.max(1, tier)) - 1]));
}

/** Theme de problemes travaille par la lecon (null : lecon sans problemes, ex. ouvertures) */
export function lessonTheme(lesson: Lesson): string | null {
  const s = lesson.steps.find((x) => x.type === 'puzzles');
  return s && s.type === 'puzzles' ? s.theme : null;
}

type State = Record<string, number>;
let state: State = load<State>(MASTERY_KEY, {});
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
// Synchronisation du compte : la cle peut changer depuis un autre appareil
window.addEventListener('storage', (e) => {
  if (e.key === MASTERY_KEY) {
    state = load<State>(MASTERY_KEY, {});
    emit();
  }
});

/** Paliers valides pour une lecon (0 a 5) */
export const masteryOf = (lessonId: string) => state[lessonId] ?? 0;

export function completeTier(lessonId: string, tier: number) {
  if (masteryOf(lessonId) >= tier) return;
  state = { ...state, [lessonId]: tier };
  save(MASTERY_KEY, state);
  emit();
}

/** Relit le stockage (apres une synchronisation du compte) */
export function reloadMastery() {
  state = load<State>(MASTERY_KEY, {});
  emit();
}

export function useMastery(): State {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}
