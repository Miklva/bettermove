// Livre d'ouvertures (lichess-org/chess-openings, CC0) : reconnait les coups theoriques et nomme l'ouverture.
interface Book {
  names: string[];
  /** Hash de la position -> indice du nom (-1 = position de livre sans nom propre) */
  pos: Record<string, number>;
}

let bookPromise: Promise<Book> | null = null;

export function loadBook(): Promise<Book> {
  if (!bookPromise)
    bookPromise = fetch(`${import.meta.env?.BASE_URL ?? "/"}data/openings.json`)
      .then((r) => (r.ok ? r.json() : { names: [], pos: {} }))
      .catch(() => ({ names: [], pos: {} }));
  return bookPromise;
}

/** Meme hash que le script de construction : FNV-1a 32 bits sur "pieces trait roques" */
function hashFen(fen: string): string {
  const key = fen.split(' ').slice(0, 3).join(' ');
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(key)) {
    h ^= ch;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Renvoie undefined si la position n'est pas dans le livre, sinon le nom (ou null) */
export function lookup(book: Book, fen: string): string | null | undefined {
  const i = book.pos[hashFen(fen)];
  if (i === undefined) return undefined;
  return i >= 0 ? book.names[i] : null;
}
