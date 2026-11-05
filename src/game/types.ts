export type Color = 'w' | 'b';

export interface TimeControl {
  id: string;
  label: string;
  category: 'Bullet' | 'Blitz' | 'Rapide' | 'Classique' | 'Libre';
  /** Temps initial en secondes, null = sans pendule */
  initial: number | null;
  /** Increment en secondes */
  increment: number;
}

export interface PlayedMove {
  san: string;
  from: string;
  to: string;
  color: Color;
  piece: string;
  captured?: string;
  promotion?: string;
  flags: string;
  /** Position apres le coup */
  fen: string;
  /** Temps restants apres le coup (ms) */
  clockAfter: { w: number; b: number };
}

export interface GameResult {
  winner: Color | null;
  reason: string;
}

export interface GameSettings {
  timeControl: TimeControl;
  whiteName: string;
  blackName: string;
  autoFlip: boolean;
  /** Present si la partie se joue contre un bot */
  bot?: { id: string; color: Color };
  /** Identifiant unique de la partie (sert a ne compter l'Elo qu'une fois) */
  gameId?: string;
}
