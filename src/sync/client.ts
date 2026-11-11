// Synchronisation avec l'API (docker compose) : le localStorage reste la source de verite
// pour l'app, le serveur garde une copie durable par compte.
// - chaque ecriture locale d'une cle synchronisee est envoyee apres un court delai ;
// - les parties sont envoyees une par une (table games) ;
// - au demarrage et a la connexion, on recupere ce qui est plus recent sur le serveur.
import { setWriteListener } from '../lib/storage';
import { lang, t, tServer } from '../i18n';
import type { SavedGame } from '../review/store';

const API = ((import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? '') + '/api';
export const API_BASE = API;
const META_KEY = 'bettermove.sync.meta';
const GAMES_KEY = 'bettermove.games.v1';

/** Cles copiees sur le serveur (les parties en cours, caches et onglet courant restent locaux) */
const SYNCED = new Set([
  'bettermove.profile.v1',
  'bettermove.achievements.v1',
  'bettermove.events.v1',
  'bettermove.quests.v1',
  'bettermove.today.v1',
  'bettermove.week.v1',
  'bettermove.onlineRewarded.v1',
  'bettermove.reviewRewarded.v1',
  'bettermove.localRewarded.v1',
  'bettermove.facts.v1',
  'bettermove.factsSeeded.v1',
  'bettermove.reviewFacts.v1',
  'bettermove.myMistakes.v1',
  'bettermove.srsMastered.v1',
  'bettermove.rush.v1',
  'bettermove.repertoire.v1',
  'bettermove.tips.v1',
  'bettermove.lessonsFolded.v1',
  'bettermove.settings.v1',
  'bettermove.puzzlesSeen',
  'bettermove.recordedGames',
  'bettermove.importUser',
  'bettermove.linkedAccounts',
  'bettermove.level.v1',
  'bettermove.shop.v1',
  'bettermove.levelRewards.v1',
  'bettermove.coach.analyses.v1',
  'bettermove.coach.snapshots.v1',
  'bettermove.coach.notes.v1',
  'bettermove.coach.mastered.v1',
  'bettermove.puzzleDifficulty',
  'bettermove.puzzleTheme',
  'bettermove.lastBot',
  'bettermove.botTc',
  'bettermove.boardTheme',
  'bettermove.sound',
]);

export type SyncStatus = 'checking' | 'offline' | 'anon' | 'syncing' | 'synced' | 'error';

interface Meta {
  user: string | null;
  /** Derniere modification locale de chaque cle (ms) */
  updatedAt: Record<string, number>;
  /** Horloge serveur du dernier telechargement */
  lastPull: number;
  /** Signature des parties deja envoyees */
  pushedGames: Record<string, string>;
  lastSync: number | null;
}

const emptyMeta = (): Meta => ({ user: null, updatedAt: {}, lastPull: 0, pushedGames: {}, lastSync: null });

function readMeta(): Meta {
  try {
    return { ...emptyMeta(), ...JSON.parse(localStorage.getItem(META_KEY) ?? '{}') };
  } catch {
    return emptyMeta();
  }
}
function writeMeta(m: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* plein : on ignore */
  }
}

const raw = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Signature courte d'une partie (detecte les modifications) */
function sig(g: SavedGame) {
  const s = JSON.stringify(g);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

/* ---------------- Etat observable ---------------- */

let status: SyncStatus = 'checking';
let isAdminUser = false;
export const isAdmin = () => isAdminUser;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function setStatus(s: SyncStatus, err: string | null = null) {
  status = s;
  lastError = err;
  listeners.forEach((l) => l());
}

export function getSyncState() {
  const m = readMeta();
  return { status, user: m.user, lastSync: m.lastSync, error: lastError };
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/* ---------------- HTTP ---------------- */

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Appel de l'API (cookie de session inclus) */
export async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  return call<T>(path, init);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    credentials: 'include',
    ...init,
    // La langue du visiteur : le serveur s'en sert pour les mails (confirmation, mot de passe, reponse du support)
    headers: { 'Content-Type': 'application/json', 'X-Lang': lang(), ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, tServer(body.error ?? `Erreur ${res.status}`));
  return body as T;
}

/* ---------------- Envoi ---------------- */

const dirty = new Set<string>();
let gamesDirty = false;
let timer: number | null = null;
let applying = false;

function onLocalWrite(key: string) {
  if (applying) return;
  if (key === GAMES_KEY) gamesDirty = true;
  else if (SYNCED.has(key)) {
    const m = readMeta();
    m.updatedAt[key] = Date.now();
    writeMeta(m);
    dirty.add(key);
  } else return;
  schedule();
}

function schedule(delay = 1500) {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void push();
  }, delay);
}

let pushing: Promise<void> | null = null;

async function push(): Promise<void> {
  const m = readMeta();
  if (!m.user || status === 'offline') return;
  if (pushing) {
    await pushing;
    if (dirty.size || gamesDirty) schedule(200);
    return;
  }
  pushing = (async () => {
    setStatus('syncing');
    try {
      // Donnees
      const keys = [...dirty];
      dirty.clear();
      if (keys.length) {
        const items: Record<string, { value: unknown; updatedAt: number }> = {};
        for (const k of keys) {
          const r = raw(k);
          if (r === null) continue;
          items[k] = { value: JSON.parse(r), updatedAt: m.updatedAt[k] ?? Date.now() };
        }
        await call('/sync/data', { method: 'PUT', body: JSON.stringify({ items }) });
      }
      // Parties
      if (gamesDirty) {
        gamesDirty = false;
        const games: SavedGame[] = JSON.parse(raw(GAMES_KEY) ?? '[]');
        const now = new Set(games.map((g) => g.id));
        const upsert = games.filter((g) => m.pushedGames[g.id] !== sig(g));
        const remove = Object.keys(m.pushedGames).filter((id) => !now.has(id));
        for (let i = 0; i < Math.max(upsert.length, remove.length); i += 500)
          await call('/sync/games', {
            method: 'PUT',
            body: JSON.stringify({ upsert: upsert.slice(i, i + 500), remove: remove.slice(i, i + 500) }),
          });
        const fresh = readMeta();
        for (const g of upsert) fresh.pushedGames[g.id] = sig(g);
        for (const id of remove) delete fresh.pushedGames[id];
        writeMeta(fresh);
      }
      const done = readMeta();
      done.lastSync = Date.now();
      writeMeta(done);
      setStatus('synced');
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        const x = readMeta();
        x.user = null;
        writeMeta(x);
        setStatus('anon', t('Session expirée, reconnecte-toi'));
      } else {
        // Serveur injoignable : on reessaiera plus tard
        keysBack();
        setStatus('error', e instanceof Error ? e.message : t('Synchronisation impossible'));
        schedule(30_000);
      }
    }
  })().finally(() => {
    pushing = null;
  });
  return pushing;
}

/** Apres un echec, tout ce qui a une date locale est renvoye au prochain essai */
function keysBack() {
  const m = readMeta();
  Object.keys(m.updatedAt).forEach((k) => dirty.add(k));
  gamesDirty = true;
}

/* ---------------- Reception ---------------- */

interface PullResponse {
  now: number;
  data: Record<string, { value: unknown; updatedAt: number }>;
  games: { id: string; data: SavedGame; deleted: boolean; updatedAt: number }[];
}

/** Telecharge les changements. Renvoie true si des donnees locales ont change. */
async function pull(full = false): Promise<boolean> {
  const m = readMeta();
  const res = await call<PullResponse>(`/sync?since=${full ? 0 : m.lastPull}`);
  let changed = false;
  applying = true;
  try {
    for (const [key, item] of Object.entries(res.data)) {
      if (!SYNCED.has(key)) continue;
      const local = m.updatedAt[key] ?? 0;
      if (item.updatedAt > local || raw(key) === null) {
        const next = JSON.stringify(item.value);
        if (raw(key) !== next) {
          localStorage.setItem(key, next);
          changed = true;
        }
        m.updatedAt[key] = item.updatedAt;
        dirty.delete(key);
      } else if (local > item.updatedAt) dirty.add(key);
    }
    if (res.games.length) {
      const games: SavedGame[] = JSON.parse(raw(GAMES_KEY) ?? '[]');
      const byId = new Map(games.map((g) => [g.id, g]));
      for (const g of res.games) {
        if (g.deleted) {
          if (byId.delete(g.id)) changed = true;
          delete m.pushedGames[g.id];
        } else {
          if (!byId.has(g.id)) changed = true;
          byId.set(g.id, { ...byId.get(g.id), ...g.data });
          m.pushedGames[g.id] = sig(byId.get(g.id)!);
        }
      }
      const merged = [...byId.values()].sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''));
      localStorage.setItem(GAMES_KEY, JSON.stringify(merged));
    }
  } finally {
    applying = false;
  }
  m.lastPull = res.now;
  writeMeta(m);
  return changed;
}

/** Synchronisation complete : recupere puis envoie tout ce qui manque au serveur */
async function fullSync(): Promise<boolean> {
  setStatus('syncing');
  const changed = await pull(true);
  const m = readMeta();
  // Cles locales jamais envoyees (premiere connexion avec des donnees existantes)
  for (const k of SYNCED) {
    if (raw(k) === null) continue;
    if (!m.updatedAt[k]) m.updatedAt[k] = Date.now();
    dirty.add(k);
  }
  writeMeta(m);
  gamesDirty = true;
  await push();
  return changed;
}

/* ---------------- API publique ---------------- */

/** A appeler une fois au demarrage */
export async function initSync(onRemoteChange: (atStartup: boolean) => void) {
  setWriteListener(onLocalWrite);
  try {
    await call('/health');
  } catch {
    setStatus('offline');
    return;
  }
  try {
    const me = await call<{ user: { username: string; admin?: boolean } }>('/auth/me');
    isAdminUser = !!me.user.admin;
    const m = readMeta();
    const switched = m.user !== me.user.username;
    if (switched) writeMeta({ ...emptyMeta(), user: me.user.username });
    const changed = switched ? await fullSync() : await pull();
    if (!switched) await push();
    setStatus('synced');
    if (changed) onRemoteChange(true);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      writeMeta({ ...readMeta(), user: null });
      setStatus('anon');
    } else setStatus('error', e instanceof Error ? e.message : t('Erreur'));
  }
  // Retour sur l'onglet : on recupere ce qui a ete joue ailleurs
  window.addEventListener('focus', () => {
    if (!readMeta().user || status === 'offline') return;
    pull()
      .then((changed) => changed && onRemoteChange(false))
      .catch(() => undefined);
  });
}

export async function login(username: string, password: string, create: boolean, email?: string): Promise<boolean> {
  // Lien de parrainage garde depuis la visite de /invite/<pseudo>
  let ref: string | undefined;
  try {
    ref = create ? (JSON.parse(localStorage.getItem('bettermove.ref') ?? 'null')?.code ?? undefined) : undefined;
  } catch {
    ref = undefined;
  }
  const r = await call<{ user: { username: string }; referral?: string; emailSent?: boolean }>(create ? '/auth/register' : '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, ref, email: create && email ? email : undefined }),
  });
  // Message affiche par l'app apres le chargement (la page peut se recharger)
  if (create && email)
    sessionStorage.setItem(
      'bettermove.notice',
      r.emailSent ? t('✉️ Un lien de confirmation a été envoyé à {email}', { email }) : t('Compte créé. Le mail de confirmation n’a pas pu partir : renvoie-le depuis 👤 Compte › Mon adresse e-mail.'),
    );
  if (create && email) window.dispatchEvent(new Event('bettermove-notice'));
  // Resultat du parrainage, affiche par l'app apres l'inscription. Le lien n'est oublie qu'en cas de succes
  // (sinon il reste propose sur la page Evenements).
  if (create && ref) {
    localStorage.setItem('bettermove.refResult', JSON.stringify({ status: r.referral ?? 'error', name: ref }));
    if (r.referral === 'ok') localStorage.removeItem('bettermove.ref');
  }
  writeMeta({ ...emptyMeta(), user: r.user.username });
  return fullSync();
}

export async function logout() {
  await call('/auth/logout', { method: 'POST' }).catch(() => undefined);
  writeMeta(emptyMeta());
  setStatus('anon');
}

export function syncNow() {
  return fullSync();
}
