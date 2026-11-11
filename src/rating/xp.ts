// Experience et niveaux. Niveau N atteint a 50 * N * (N - 1) XP : 0, 100, 300, 600, 1000...
export const XP = {
  puzzleWin: 8,
  botWin: 30,
  botDraw: 15,
  botLoss: 5,
  quizRight: 5,
  lessonPuzzleFirstTry: 10,
  /** Resolu apres une erreur, sans indice ni solution */
  lessonPuzzleRetry: 3,
  goalFirstTry: 30,
  goalRetry: 15,
  lessonStar: 20,
};

export function levelFromXp(xp: number) {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  const start = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, into: xp - start, needed: next - start, progress: (xp - start) / (next - start) };
}
