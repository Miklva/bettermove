// Anti-triche : le professeur (Stockfish) est indisponible tant qu'une partie est en cours.
import { load, save } from '../lib/storage';
import { t, tn } from '../i18n';
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
    return { kind, label: tn(g.moves.length, 'Partie contre {opp} ({n} demi-coup joué)', 'Partie contre {opp} ({n} demi-coups joués)', { opp: opp ?? t('un bot') }) };
  }
  return { kind, label: tn(g.moves.length, 'Partie 1v1 sur écran ({n} demi-coup joué)', 'Partie 1v1 sur écran ({n} demi-coups joués)') };
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
      if (r.game) out.push({ kind: 'online', label: t('Partie en ligne contre {name}', { name: r.game.opponent }), gameId: r.game.id });
    } catch {
      /* serveur injoignable : on ne bloque pas pour autant */
    }
  }
  return out;
}

/** Une partie 1v1 sur ecran n'a pas d'enjeu : on peut l'abandonner d'ici pour debloquer le professeur */
export function dropLocalGame() {
  const g = load<SavedGame | null>(LOCAL_KEYS.local, null);
  if (g) save(LOCAL_KEYS.local, { ...g, result: { winner: null, reason: t('Partie arrêtée') } });
}
