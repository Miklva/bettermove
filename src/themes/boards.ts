// Skins de plateau : les premiers sont gratuits, les autres s'achetent dans la boutique.
import { ITEMS } from '../shop/items';
export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
  /** Objet de boutique a posseder (plateaux premium) */
  itemId?: string;
  price?: number;
  texture?: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'bois', name: 'Bois', light: '#f0d9b5', dark: '#b58863' },
  { id: 'foret', name: 'Forêt', light: '#eeeed2', dark: '#769656' },
  { id: 'ocean', name: 'Océan', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'nuit', name: 'Nuit', light: '#9ea6b4', dark: '#4b5466' },
  { id: 'corail', name: 'Corail', light: '#f3e0d4', dark: '#d1826b' },
  { id: 'lavande', name: 'Lavande', light: '#e8e1f2', dark: '#9b84c2' },
];

// Plateaux premium de la boutique
for (const it of ITEMS.filter((i) => i.type === 'board'))
  BOARD_THEMES.push({ id: it.id.replace('board-', ''), name: it.name, light: it.light!, dark: it.dark!, itemId: it.id, price: it.price, texture: it.texture });

export const DEFAULT_BOARD_THEME = BOARD_THEMES[0];
