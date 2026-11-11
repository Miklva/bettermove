import { useEffect, useRef, type ReactNode } from 'react';

/** Fenetres ouvertes, de la plus ancienne a la plus recente : Echap ferme seulement celle du dessus */
const stack: number[] = [];
let nextId = 1;

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = nextId++;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== id || !close.current) return;
      e.stopPropagation();
      close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
