import { createElement } from 'react';
import type { Color } from '../game/types';

const ROLE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** Affiche une piece avec le meme set graphique que le plateau (skin de pieces) */
export function Piece({ type, color, className = '' }: { type: string; color: Color; className?: string }) {
  // Les images des pieces sont definies sur l'element <piece> par le CSS de chessground
  return createElement('piece', { className: `${ROLE[type]} ${color === 'w' ? 'white' : 'black'} ${className}` });
}
