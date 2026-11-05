// Acces localStorage protege : peut etre indisponible (navigation privee, iframe...)
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Ecouteur des ecritures (synchronisation avec le serveur) */
let onWrite: ((key: string) => void) | null = null;
export function setWriteListener(fn: (key: string) => void) {
  onWrite = fn;
}

/** Renvoie false si l'ecriture a echoue (quota depasse, stockage indisponible) */
export function save(key: string, value: unknown): boolean {
  let ok = true;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    ok = false;
  }
  if (ok) onWrite?.(key);
  return ok;
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  onWrite?.(key);
}
