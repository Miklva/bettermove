// Niveau declare par le joueur a sa premiere visite : fixe l'Elo de depart et l'ordre des cours.
import { load, save } from '../lib/storage';
import type { Profile } from '../rating/profile';

export type Level = 'none' | 'beginner' | 'intermediate' | 'advanced';

export const LEVELS: { id: Level; icon: string; title: string; desc: string; bots: number; puzzles: number }[] = [
  {
    id: 'none',
    icon: '🌱',
    title: 'Aucune connaissance',
    desc: 'Je ne sais pas encore comment bougent les pièces.',
    bots: 400,
    puzzles: 500,
  },
  {
    id: 'beginner',
    icon: '🐣',
    title: 'Débutant',
    desc: 'Je connais les règles mais je perds souvent des pièces.',
    bots: 700,
    puzzles: 800,
  },
  {
    id: 'intermediate',
    icon: '♞',
    title: 'Intermédiaire',
    desc: 'Je joue régulièrement, je connais quelques ouvertures et tactiques (environ 1000 à 1500 en ligne).',
    bots: 1100,
    puzzles: 1300,
  },
  {
    id: 'advanced',
    icon: '👑',
    title: 'Avancé',
    desc: 'Je joue en club ou au-dessus de 1600 en ligne.',
    bots: 1600,
    puzzles: 1800,
  },
];

const KEY = 'bettermove.level.v1';

export interface LevelInfo {
  level: Level;
  at: string;
}

export const getLevel = () => load<LevelInfo | null>(KEY, null);
export const setLevel = (level: Level) => save(KEY, { level, at: new Date().toISOString() });

/** Profil vierge : rien joue, rien appris */
export function isFreshProfile(p: Profile) {
  return p.xp === 0 && p.history.length === 0 && Object.keys(p.lessons).length === 0 && p.puzzleStats.solved + p.puzzleStats.failed === 0;
}

/** Faut-il mettre l'initiation en tete des cours ? */
export function wantsInitiation(p: Profile) {
  const l = getLevel()?.level;
  if (l) return l === 'none' || l === 'beginner';
  return isFreshProfile(p);
}
