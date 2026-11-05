// Petits constructeurs pour ecrire les lecons de facon compacte.
import type { Lesson, Step } from './courses';

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Lecon tactique type : theorie, demonstration tiree d'un vrai probleme, exercices guides, entrainement */
export function themeLesson(o: {
  id: string;
  title: string;
  icon: string;
  summary: string;
  intro: string;
  demo?: { fen: string; line: string[]; title: string; text: string };
  theme: string;
  guided?: number;
  practice?: number;
}): Lesson {
  const steps: Step[] = [{ type: 'theory', title: o.title, text: o.intro }];
  if (o.demo) steps.push({ type: 'theory', title: o.demo.title, text: o.demo.text, fen: o.demo.fen, line: o.demo.line });
  if (o.guided !== 0) steps.push({ type: 'puzzles', title: `${o.title} : exercices`, theme: o.theme, count: o.guided ?? 3, mode: 'guided' });
  if (o.practice !== 0) steps.push({ type: 'puzzles', title: 'À ton niveau', theme: o.theme, count: o.practice ?? 3, mode: 'practice' });
  return { id: o.id, title: o.title, icon: o.icon, summary: o.summary, steps };
}

/** Lecon d'ouverture : ligne de demonstration depuis le debut, quiz, puis problemes d'ouverture */
export function openingLesson(o: {
  id: string;
  title: string;
  icon: string;
  summary: string;
  text: string;
  line: string[];
  extra?: Step[];
  puzzles?: number;
}): Lesson {
  return {
    id: o.id,
    title: o.title,
    icon: o.icon,
    summary: o.summary,
    steps: [
      { type: 'theory', title: o.title, text: o.text, fen: START, line: o.line },
      ...(o.extra ?? []),
      ...(o.puzzles === 0 ? [] : [{ type: 'puzzles', title: 'Pièges et tactiques d’ouverture', theme: 'opening', count: o.puzzles ?? 3, mode: 'practice' } as Step]),
    ],
  };
}

/** Coups en notation "e2e4 e7e5 ..." vers tableau */
export const L = (s: string) => s.trim().split(/\s+/);
