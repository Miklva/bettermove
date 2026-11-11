// Comptes chess.com / Lichess lies : import complet puis import des nouvelles parties.
import { load, save } from '../lib/storage';
import { saveImported } from '../review/store';
import { importChessCom, importLichess, type ImportProgress, type Site } from '../review/importers';

export interface LinkedAccount {
  username: string;
  /** Date (ms) de la partie la plus recente deja importee */
  lastImport: number;
  /** Nombre total de parties importees */
  count: number;
  importedAt?: string;
}

export interface Linked {
  chesscom?: LinkedAccount;
  lichess?: LinkedAccount;
  /** Importer les nouvelles parties a l'ouverture de l'historique */
  auto: boolean;
  /** Bandeau de suggestion ferme */
  dismissed?: boolean;
  lastAutoCheck?: number;
}

export const LINKED_KEY = 'bettermove.linkedAccounts';
export const SITE_NAME: Record<Site, string> = { chesscom: 'chess.com', lichess: 'Lichess' };

export const getLinked = () => load<Linked>(LINKED_KEY, { auto: true });
export const setLinked = (l: Linked) => save(LINKED_KEY, l);

/** Import (complet si `full`, sinon seulement les parties plus recentes que le dernier import) */
export async function runImport(site: Site, username: string, full: boolean, onProgress: (p: ImportProgress) => void) {
  const linked = getLinked();
  const prev = linked[site];
  const same = prev && prev.username.toLowerCase() === username.trim().toLowerCase();
  const since = full || !same ? 0 : prev!.lastImport;
  const fn = site === 'chesscom' ? importChessCom : importLichess;
  const r = await fn(username, since, saveImported, onProgress);
  const next = getLinked();
  next[site] = {
    username: username.trim(),
    lastImport: Math.max(r.latest, same ? prev!.lastImport : 0),
    count: (same && !full ? prev!.count : 0) + (full ? r.found : r.added),
    importedAt: new Date().toISOString(),
  };
  setLinked(next);
  return r;
}

/** Import automatique des nouvelles parties (au plus toutes les 30 min). Renvoie le nombre ajoute. */
export async function autoImport(): Promise<number> {
  const l = getLinked();
  if (!l.auto || Date.now() - (l.lastAutoCheck ?? 0) < 30 * 60 * 1000) return 0;
  setLinked({ ...l, lastAutoCheck: Date.now() });
  let added = 0;
  for (const site of ['chesscom', 'lichess'] as Site[]) {
    const acc = l[site];
    if (!acc) continue;
    try {
      added += (await runImport(site, acc.username, false, () => undefined)).added;
    } catch {
      /* site injoignable : on reessaiera plus tard */
    }
  }
  return added;
}
