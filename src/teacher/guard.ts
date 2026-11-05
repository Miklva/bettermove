// Anti-triche : le professeur (Stockfish) est indisponible tant qu'une partie est en cours.
import { load, save } from '../lib/storage';
import { online } from '../social/api';

export interface OngoingGame {
  kind: 'bot' | 'local' | 'online';
  label: string;
  gameId?: number;
}

interface SavedGame {
  moves?: unknown[];
  result?: unknown;
  settings?: { bot?: { id: string }; whiteName?: string; blackName?: string };
}

const LOCAL_KEYS: Record<'bot' | 'local', string> = { bot: 'bettermove.botGame.v1', local: 'bettermove.localGame.v1' };

function localOngoing(kind: 'bot' | 'local'): OngoingGame | null {
  const g = load<SavedGame | null>(LOCAL_KEYS[kind], null);
  if (!g || !Array.isArray(g.moves) || g.moves.length === 0 || g.result) return null;
  if (kind === 'bot') {
    if (!g.settings?.bot) return null;
    const opp = g.settings.whiteName === 'Toi' ? g.settings.blackName : g.settings.whiteName;
    return { kind, label: `Partie contre ${opp ?? 'un bot'} (${g.moves.length} demi-coup${g.moves.length > 1 ? 's' : ''} joué${g.moves.length > 1 ? 's' : ''})` };
  }
  return { kind, label: `Partie 1v1 sur écran (${g.moves.length} demi-coup${g.moves.length > 1 ? 's' : ''} joué${g.moves.length > 1 ? 's' : ''})` };
}

/** Parties en cours (bots, 1v1 sur cet ecran, en ligne si connecte) */
export async function ongoingGames(logged: boolean): Promise<OngoingGame[]> {
  const out: OngoingGame[] = [];
  const bot = localOngoing('bot');
  if (bot) out.push(bot);
  const local = localOngoing('local');
  if (local) out.push(local);
  if (logged) {
    try {
      const r = await online.current();
      if (r.game) out.push({ kind: 'online', label: `Partie en ligne contre ${r.game.opponent}`, gameId: r.game.id });
    } catch {
      /* serveur injoignable : on ne bloque pas pour autant */
    }
  }
  return out;
}

/** Une partie 1v1 sur ecran n'a pas d'enjeu : on peut l'abandonner d'ici pour debloquer le professeur */
export function dropLocalGame() {
  const g = load<SavedGame | null>(LOCAL_KEYS.local, null);
  if (g) save(LOCAL_KEYS.local, { ...g, result: { winner: null, reason: 'Partie arrêtée' } });
}
