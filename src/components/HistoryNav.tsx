// Navigation dans les coups deja joues (fleches du clavier + boutons sous le plateau).
import { useEffect, useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';

export interface Position {
  fen: string;
  /** Dernier coup joue pour arriver ici, format "e2e4" */
  lastMove: string;
}

/** Liste des positions successives depuis la position de depart */
export function positionsFrom(startFen: string, history: Move[]): Position[] {
  const out: Position[] = [{ fen: startFen, lastMove: '' }];
  const c = new Chess(startFen);
  for (const m of history) {
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
    out.push({ fen: c.fen(), lastMove: `${m.from}${m.to}` });
  }
  return out;
}

/** Garde l'indice de la position affichee ; revient au direct a chaque nouveau coup */
export function useHistoryNav(positions: Position[]) {
  const [view, setView] = useState<number | null>(null);
  const last = positions.length - 1;
  const idx = view === null ? last : Math.min(view, last);

  // Nouveau coup joue : on revient a la position actuelle
  useEffect(() => setView(null), [positions.length]);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(last, i));
    setView(n >= last ? null : n);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') go(idx - 1);
      else if (e.key === 'ArrowRight') go(idx + 1);
      else if (e.key === 'ArrowUp') go(0);
      else if (e.key === 'ArrowDown') go(last);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isLive = idx === last;
  return useMemo(
    () => ({ idx, last, isLive, current: positions[idx], go }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idx, last, isLive, positions],
  );
}

export function HistoryNavBar({ nav, liveLabel = 'Position actuelle' }: { nav: ReturnType<typeof useHistoryNav>; liveLabel?: string }) {
  if (nav.last === 0) return null;
  return (
    <div className="board-nav">
      <button className="btn ghost" onClick={() => nav.go(0)} disabled={nav.idx === 0} aria-label="Début">
        «
      </button>
      <button className="btn ghost" onClick={() => nav.go(nav.idx - 1)} disabled={nav.idx === 0} aria-label="Coup précédent">
        ‹
      </button>
      <span className="board-nav-label">
        {nav.isLive ? liveLabel : `Coup ${nav.idx} / ${nav.last}`}
      </span>
      <button className="btn ghost" onClick={() => nav.go(nav.idx + 1)} disabled={nav.isLive} aria-label="Coup suivant">
        ›
      </button>
      <button className="btn ghost" onClick={() => nav.go(nav.last)} disabled={nav.isLive} aria-label="Position actuelle">
        »
      </button>
    </div>
  );
}
