import { Chess } from 'chess.js';

export type Notation = 'fr' | 'en';

const FR: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };

/** Convertit un coup SAN anglais (Nf3) en notation francaise (Cf3) si besoin */
export function formatSan(san: string, notation: Notation): string {
  if (notation === 'en') return san;
  return san.replace(/[KQRBN]/g, (c) => FR[c]);
}

/** Formate une suite de coups UCI depuis une position : "12. Cxe5 dxe5 13. Dh5+" */
export function formatLine(fen: string, ucis: string[], notation: Notation, max = 8): string {
  const c = new Chess(fen);
  const parts: string[] = [];
  for (let i = 0; i < Math.min(ucis.length, max); i++) {
    const u = ucis[i];
    const n = c.moveNumber();
    const white = c.turn() === 'w';
    let san: string;
    try {
      san = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
    } catch {
      break;
    }
    if (white) parts.push(`${n}. ${formatSan(san, notation)}`);
    else parts.push(i === 0 ? `${n}... ${formatSan(san, notation)}` : formatSan(san, notation));
  }
  if (ucis.length > max) parts.push('…');
  return parts.join(' ');
}
