// Lecons BetterMove liees a une ouverture, selon le camp du joueur.
const bare = (name?: string) => (name ?? '').replace(/^[A-E]\d\d /, '');

interface Rule {
  test: (n: string) => boolean;
  w: string[];
  b: string[];
}

const RULES: Rule[] = [
  { test: (n) => n.startsWith('Scandinavian Defense'), w: ['w-vs-scandi'], b: ['b-scandi', 'b-scandi-e5', 'b-scandi-nf6'] },
  { test: (n) => n.includes('Fried Liver'), w: ['w-cg5'], b: ['b-fried-liver', 'b-two-knights'] },
  { test: (n) => n.includes('Evans Gambit'), w: ['w-evans'], b: ['b-e5'] },
  { test: (n) => n.includes('Two Knights Defense'), w: ['w-cg5', 'w-italian'], b: ['b-two-knights', 'b-fried-liver'] },
  { test: (n) => n.startsWith('Italian Game'), w: ['w-italian', 'w-c3d4'], b: ['b-e5', 'b-two-knights'] },
  { test: (n) => n.startsWith('Ruy Lopez'), w: ['w-ruy'], b: ['b-e5'] },
  { test: (n) => n.startsWith('Sicilian Defense'), w: ['w-alapin'], b: ['b-sicilian'] },
  { test: (n) => n.startsWith('French Defense'), w: ['w-advance'], b: ['center'] },
  { test: (n) => n.startsWith('Caro-Kann Defense'), w: ['center'], b: ['b-caro'] },
  { test: (n) => n.includes('London System'), w: ['w-london'], b: ['b-vs-london'] },
  { test: (n) => n.startsWith("Queen's Gambit"), w: ['center'], b: ['b-qgd'] },
  { test: (n) => n.startsWith("King's Pawn Game") || n.startsWith('Four Knights') || n.startsWith('Scotch'), w: ['w-italian'], b: ['b-e5'] },
];

/** Lecons conseillees pour une ouverture (par defaut : principes d'ouverture) */
export function lessonsForOpening(name: string | undefined, side: 'w' | 'b'): string[] {
  const n = bare(name);
  const r = n ? RULES.find((x) => x.test(n)) : undefined;
  return r ? r[side] : ['center', 'develop', 'traps'];
}
