// Routage minimal par l'URL (History API) : chaque page, sous-onglet, partie et profil a son lien.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { lang, saveLang, type Lang } from './i18n';
import { toInternal, toPublic } from './i18n/slugs';

const listeners = new Set<() => void>();
// Page precedente dans l'app (pour les boutons "fermer" qui reviennent en arriere)
let cur = toInternal(window.location.pathname);
let prev: string | null = null;
const emit = () => {
  const now = toInternal(window.location.pathname);
  if (now !== cur) {
    prev = cur;
    cur = now;
  }
  listeners.forEach((l) => l());
};
window.addEventListener('popstate', emit);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
// L'app travaille avec les adresses francaises ; l'adresse affichee est traduite selon la langue (/en/learn/lessons)
const getPath = () => toInternal(window.location.pathname);
/** Adresse interne (francaise) de la page courante */
export const currentPath = getPath;

/** Segments de l'URL courante, decodes (ex. /profil/Ana -> ['profil', 'Ana']) */
export function segmentsOf(path: string): string[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

export function pathOf(segs: (string | number)[]): string {
  return '/' + segs.map((s) => encodeURIComponent(String(s))).join('/');
}

/** Change l'URL ; replace = sans nouvelle entree dans l'historique */
export function navigate(path: string, replace = false) {
  const pub = toPublic(path, lang());
  if (pub === window.location.pathname) return;
  if (replace) window.history.replaceState(null, '', pub);
  else window.history.pushState(null, '', pub);
  emit();
}

/** Revient a la page precedente de l'app ; sinon (lien ouvert directement) va sur `fallback` */
export function goBack(fallback: string) {
  if (prev && prev !== cur) window.history.back();
  else navigate(fallback, true);
}

/** Adresse a mettre dans un lien (href) : traduite dans la langue courante */
export const hrefOf = (path: string) => toPublic(path, lang());

/** Change de langue : meme page, adresse traduite, rechargement */
export function switchLanguage(l: Lang) {
  saveLang(l);
  window.location.assign(toPublic(getPath(), l) + window.location.search);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath);
}

export function useSegments(): string[] {
  const path = usePath();
  return segmentsOf(path);
}

/**
 * Synchronise un etat de page avec un segment de l'URL (dans les deux sens).
 * - index : position du segment (0 = premier)
 * - toSlug / fromSlug : conversion valeur <-> segment (fromSlug renvoie undefined si le segment est invalide)
 * - enabled : false pour ne pas toucher a l'URL (ex. pendant une partie)
 * Au chargement, l'URL est prioritaire ; ensuite chaque changement d'etat remplace le segment
 * (et retire les segments suivants).
 */
export function useRouteSync<T>(
  index: number,
  value: T,
  setValue: (v: T) => void,
  toSlug: (v: T) => string | null,
  fromSlug: (s: string) => T | undefined,
  enabled = true,
  /** Valeur a reprendre quand le segment disparait de l'URL (bouton Precedent), ex. null */
  empty?: { value: T },
) {
  const segs = useSegments();
  const seg = segs[index];
  const first = useRef(true);
  const firstIn = useRef(true);
  const latest = useRef({ toSlug, fromSlug, setValue, value });
  latest.current = { toSlug, fromSlug, setValue, value };

  // URL -> etat
  useEffect(() => {
    const wasFirst = firstIn.current;
    firstIn.current = false;
    if (!enabled) return;
    if (seg === undefined) {
      if (!wasFirst && empty && latest.current.toSlug(latest.current.value) !== null) latest.current.setValue(empty.value);
      return;
    }
    const v = latest.current.fromSlug(seg);
    if (v !== undefined && latest.current.toSlug(v) !== latest.current.toSlug(latest.current.value)) latest.current.setValue(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg, enabled]);

  // Etat -> URL
  useEffect(() => {
    if (!enabled) return;
    const cur = segmentsOf(getPath());
    const urlSeg = cur[index];
    const wasFirst = first.current;
    if (first.current) {
      first.current = false;
      // L'URL porte deja une valeur valide differente : elle gagne (l'effet ci-dessus l'applique)
      if (urlSeg !== undefined && fromSlug(urlSeg) !== undefined && toSlug(fromSlug(urlSeg) as T) !== toSlug(value)) return;
    }
    const slug = toSlug(value);
    // Changer d'onglet remplace l'adresse ; ouvrir ou fermer un element (lecon, conversation...)
    // ajoute une entree d'historique pour que Precedent fonctionne
    if (slug === null) {
      if (cur.length > index) navigate(pathOf(cur.slice(0, index)), wasFirst);
      return;
    }
    if (urlSeg === slug) return;
    if (cur.length < index) return; // page pas encore a la bonne adresse
    navigate(pathOf([...cur.slice(0, index), slug]), wasFirst || urlSeg !== undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled]);
}

/** Variante pour une liste fermee de valeurs : { valeur: 'segment' } */
export function useRouteTab<T extends string>(index: number, value: T, setValue: (v: T) => void, slugs: Record<T, string>, enabled = true) {
  useRouteSync(
    index,
    value,
    setValue,
    (v) => slugs[v] ?? null,
    (s) => (Object.keys(slugs) as T[]).find((k) => slugs[k] === s),
    enabled,
  );
}
