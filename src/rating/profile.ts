import { useCallback, useState } from 'react';
import { load, save } from '../lib/storage';
import type { Rating } from './glicko2';
import { XP } from './xp';
import { eloDelta, PROVISIONAL_GAMES } from './elo';

const KEY = 'bettermove.profile.v1';

export interface GameRecord {
  date: string;
  botId: string;
  botRating: number;
  color: 'w' | 'b';
  score: number;
  before: number;
  after: number;
}

export interface PuzzleRecord {
  id: string;
  rating: number;
  win: boolean;
  /** Resolu avec un indice : ne rapporte rien */
  assisted?: boolean;
  delta: number;
  seconds: number;
  /** Date (absente sur les anciens enregistrements) */
  at?: string;
}

export interface Profile {
  bots: Rating;
  puzzles: Rating;
  puzzleStats: { solved: number; failed: number; streak: number; bestStreak: number };
  puzzleHistory: PuzzleRecord[];
  /** Experience totale (parties, problemes, cours) */
  xp: number;
  /** Lecons terminees : meilleur nombre d'etoiles */
  lessons: Record<string, { stars: number; at: string }>;
  /** Bots deja battus (pour le deblocage) */
  beaten: string[];
  history: GameRecord[];
}

const DEFAULT_PROFILE: Profile = {
  bots: { rating: 1000, rd: 200, vol: 0.06 },
  puzzles: { rating: 1200, rd: 200, vol: 0.06 },
  puzzleStats: { solved: 0, failed: 0, streak: 0, bestStreak: 0 },
  puzzleHistory: [],
  xp: 0,
  lessons: {},
  beaten: [],
  history: [],
};

/** Nombre de problemes joues (comptent pour le classement) */
export const puzzleGames = (p: Pick<Profile, 'puzzleStats'>) => (p.puzzleStats?.solved ?? 0) + (p.puzzleStats?.failed ?? 0);
/** Problemes : "?" pendant les 5 premiers. Bots : jamais (le niveau choisi au depart donne directement le bon classement). */
export const isPuzzleProvisional = (p: Pick<Profile, 'puzzleStats'>) => puzzleGames(p) < PROVISIONAL_GAMES;

export function usePlayerProfile() {
  const [profile, setProfile] = useState<Profile>(() => ({ ...DEFAULT_PROFILE, ...load(KEY, DEFAULT_PROFILE) }));

  /** Enregistre le resultat d'une partie contre un bot et renvoie la variation d'Elo */
  const recordBotGame = useCallback(
    (bot: { id: string; rating: number }, color: 'w' | 'b', score: number): { before: number; after: number } => {
      let out = { before: 0, after: 0 };
      setProfile((p) => {
        // Elo simple, K stable : pas de periode provisoire contre les bots
        const next = { ...p.bots, rating: p.bots.rating + eloDelta(p.bots.rating, bot.rating, score) };
        out = { before: p.bots.rating, after: next.rating };
        const record: GameRecord = {
          date: new Date().toISOString(),
          botId: bot.id,
          botRating: bot.rating,
          color,
          score,
          before: Math.round(p.bots.rating),
          after: Math.round(next.rating),
        };
        const updated: Profile = {
          ...p,
          xp: p.xp + (score === 1 ? XP.botWin : score === 0.5 ? XP.botDraw : XP.botLoss),
          bots: next,
          beaten: score === 1 && !p.beaten.includes(bot.id) ? [...p.beaten, bot.id] : p.beaten,
          history: [record, ...p.history].slice(0, 1000),
        };
        save(KEY, updated);
        return updated;
      });
      // Calcul direct pour l'affichage immediat (setProfile est asynchrone)
      out = { before: profile.bots.rating, after: profile.bots.rating + eloDelta(profile.bots.rating, bot.rating, score) };
      return out;
    },
    [profile.bots],
  );

  /**
   * Enregistre un probleme. `factor` module le gain en cas de reussite
   * (bonus de rapidite, malus d'indice). Renvoie l'ancien et le nouvel Elo.
   */
  const recordPuzzle = useCallback(
    (
      puzzle: { id: string; rating: number },
      outcome: 'win' | 'fail' | 'assisted',
      factor: number,
      seconds: number,
    ) => {
      const win = outcome === 'win';
      // Avec un indice : aucun changement d'Elo ni d'XP, la serie n'avance pas
      if (outcome === 'assisted') {
        setProfile((p) => {
          const updated: Profile = {
            ...p,
            puzzleHistory: [
              { id: puzzle.id, rating: puzzle.rating, win: true, assisted: true, delta: 0, seconds, at: new Date().toISOString() },
              ...p.puzzleHistory,
            ].slice(0, 1000),
          };
          save(KEY, updated);
          return updated;
        });
        return { before: profile.puzzles.rating, after: profile.puzzles.rating };
      }
      // Elo simple : gains et pertes plus forts pendant les 5 premiers problemes
      let delta = eloDelta(profile.puzzles.rating, puzzle.rating, win ? 1 : 0, puzzleGames(profile));
      const base = { ...profile.puzzles, rating: profile.puzzles.rating + delta };
      if (win && delta > 0) delta *= factor;
      const next = { ...base, rating: profile.puzzles.rating + delta };
      setProfile((p) => {
        const streak = win ? p.puzzleStats.streak + 1 : 0;
        const updated: Profile = {
          ...p,
          xp: p.xp + (win ? XP.puzzleWin : 0),
          puzzles: { ...base, rating: p.puzzles.rating + delta },
          puzzleStats: {
            solved: p.puzzleStats.solved + (win ? 1 : 0),
            failed: p.puzzleStats.failed + (win ? 0 : 1),
            streak,
            bestStreak: Math.max(p.puzzleStats.bestStreak, streak),
          },
          puzzleHistory: [
            { id: puzzle.id, rating: puzzle.rating, win, delta: Math.round(delta), seconds, at: new Date().toISOString() },
            ...p.puzzleHistory,
          ].slice(0, 1000),
        };
        save(KEY, updated);
        return updated;
      });
      return { before: profile.puzzles.rating, after: next.rating };
    },
    [profile.puzzles],
  );

  /** Fin de lecon : enregistre les etoiles (on garde le meilleur score) et l'XP gagnee */
  const completeLesson = useCallback((id: string, stars: number, xp: number) => {
    setProfile((p) => {
      const prev = p.lessons[id]?.stars ?? 0;
      const updated: Profile = {
        ...p,
        xp: p.xp + xp,
        lessons: { ...p.lessons, [id]: { stars: Math.max(prev, stars), at: new Date().toISOString() } },
      };
      save(KEY, updated);
      return updated;
    });
  }, []);

  const resetRating = useCallback(() => {
    save(KEY, DEFAULT_PROFILE);
    setProfile(DEFAULT_PROFILE);
  }, []);

  /** XP gagnee hors parties, problemes et cours (succes) */
  const grantXp = useCallback((xp: number) => {
    setProfile((p) => {
      const updated: Profile = { ...p, xp: p.xp + xp };
      save(KEY, updated);
      return updated;
    });
  }, []);

  /** Elo de depart selon le niveau declare (incertitude elevee : s'ajuste vite) */
  const setStartRatings = useCallback((bots: number, puzzles: number) => {
    setProfile((p) => {
      const updated: Profile = {
        ...p,
        bots: { rating: bots, rd: 250, vol: 0.06 },
        puzzles: { rating: puzzles, rd: 250, vol: 0.06 },
      };
      save(KEY, updated);
      return updated;
    });
  }, []);

  return { profile, recordBotGame, recordPuzzle, completeLesson, resetRating, grantXp, setStartRatings };
}

export type PlayerProfile = ReturnType<typeof usePlayerProfile>;
