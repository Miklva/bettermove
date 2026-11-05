// Deplacements d'une piece seule (initiation) et nombre minimal de coups pour prendre toutes les cibles.
const FILES = 'abcdefgh';
const sqXY = (s: string) => [FILES.indexOf(s[0]), Number(s[1]) - 1] as const;
export const xySq = (x: number, y: number) => `${FILES[x]}${y + 1}`;
const onBoard = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;

const LINES: Record<string, [number, number][]> = {
  R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  Q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};
const JUMPS: Record<string, [number, number][]> = {
  N: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
  K: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

/** Cases atteignables par la piece (les cibles se prennent, les bloqueurs arretent) */
export function collectMoves(piece: string, from: string, targets: Set<string>, blockers: Set<string>): string[] {
  const [x, y] = sqXY(from);
  const out: string[] = [];
  if (piece === 'P') {
    const one = xySq(x, y + 1);
    if (onBoard(x, y + 1) && !targets.has(one) && !blockers.has(one)) {
      out.push(one);
      const two = xySq(x, y + 2);
      if (y === 1 && !targets.has(two) && !blockers.has(two)) out.push(two);
    }
    for (const dx of [-1, 1]) if (onBoard(x + dx, y + 1) && targets.has(xySq(x + dx, y + 1))) out.push(xySq(x + dx, y + 1));
    return out;
  }
  for (const [dx, dy] of LINES[piece] ?? []) {
    for (let k = 1; onBoard(x + dx * k, y + dy * k); k++) {
      const s = xySq(x + dx * k, y + dy * k);
      if (blockers.has(s)) break;
      out.push(s);
      if (targets.has(s)) break;
    }
  }
  for (const [dx, dy] of JUMPS[piece] ?? []) {
    const s = onBoard(x + dx, y + dy) ? xySq(x + dx, y + dy) : null;
    if (s && !blockers.has(s)) out.push(s);
  }
  return out;
}

/** Nombre minimal de coups pour tout prendre (recherche en largeur) */
export function collectPar(piece: string, start: string, targets: string[], blockers: string[]): number {
  const block = new Set(blockers);
  const idx = new Map(targets.map((t, i) => [t, i]));
  const full = (1 << targets.length) - 1;
  const seen = new Set<string>([`${start}|0`]);
  let frontier: [string, number][] = [[start, 0]];
  for (let depth = 0; frontier.length && depth < 40; depth++) {
    const next: [string, number][] = [];
    for (const [sq, mask] of frontier) {
      if (mask === full) return depth;
      const left = new Set(targets.filter((_, i) => !(mask & (1 << i))));
      // Un pion arrive en 8e rangee devient une dame
      const p = piece === 'P' && sq[1] === '8' ? 'Q' : piece;
      for (const to of collectMoves(p, sq, left, block)) {
        const m = idx.has(to) && left.has(to) ? mask | (1 << idx.get(to)!) : mask;
        const k = `${to}|${m}`;
        if (!seen.has(k)) {
          seen.add(k);
          next.push([to, m]);
        }
      }
    }
    frontier = next;
  }
  return 99;
}

