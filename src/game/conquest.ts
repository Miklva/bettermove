// Fin de partie : les skins du gagnant (plateau et pieces) se propagent sur tout le plateau.
import { BOARD_THEMES, DEFAULT_BOARD_THEME } from '../themes/boards';
import { itemById } from '../shop/items';

export interface Conquest {
  winner: 'white' | 'black';
  /** Skin de pieces (id d'objet, ex. pieces-candy) */
  skin: string;
  light: string;
  dark: string;
  texture?: string;
}

/** Skins choisis par un joueur : ids d'objet (pieces-x) et de plateau (x ou board-x) */
export interface SkinChoice {
  pieces?: string | null;
  board?: string | null;
}

/** Skin "signature" de chaque bot, en accord avec son caractere */
export const BOT_SKINS: Record<string, SkinChoice> = {
  pip: { pieces: 'pieces-candy', board: 'bonbon' },
  lea: { pieces: 'pieces-forest', board: 'menthe' },
  hugo: { pieces: 'pieces-lava', board: 'volcan' },
  camille: { pieces: 'pieces-marble', board: 'marbre' },
  malik: { pieces: 'pieces-sapphire', board: 'ardoise' },
  sofia: { pieces: 'pieces-ruby', board: 'cerise' },
  theo: { pieces: 'pieces-jade', board: 'feutre' },
  ines: { pieces: 'pieces-fireice', board: 'automne' },
  prof: { pieces: 'pieces-wood', board: 'ebene' },
  reine: { pieces: 'pieces-royal', board: 'rubis' },
  titan: { pieces: 'pieces-cyber', board: 'neon' },
};

/** Construit l'effet de conquete pour le gagnant */
export function conquestFor(winner: 'w' | 'b', choice: SkinChoice): Conquest {
  const boardId = (choice.board ?? '').replace(/^board-/, '');
  const theme = BOARD_THEMES.find((t) => t.id === boardId) ?? DEFAULT_BOARD_THEME;
  const skin = choice.pieces && itemById(choice.pieces)?.type === 'pieces' ? choice.pieces : 'pieces-classic';
  return { winner: winner === 'w' ? 'white' : 'black', skin, light: theme.light, dark: theme.dark, texture: theme.texture };
}
