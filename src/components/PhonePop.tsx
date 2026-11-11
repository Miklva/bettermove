// Telephone : resultat d'un exercice (reussi / rate) et ses boutons au milieu de l'ecran,
// pour ne jamais avoir a faire defiler. Sur ordinateur, rien n'est affiche (le panneau suffit).
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

const PHONE = '(max-width: 900px)';

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const m = window.matchMedia(PHONE);
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return phone;
}

interface PopProps {
  tone: 'success' | 'fail' | 'info';
  title: ReactNode;
  /** Explication (defile si elle est longue) */
  children?: ReactNode;
  /** Boutons (Continuer, Reessayer...) */
  actions: ReactNode;
}

/** Fenetre centree ; "Voir le plateau" la reduit en barre en bas de l'ecran */
export function PhonePop({ tone, title, children, actions }: PopProps) {
  const phone = useIsPhone();
  const [min, setMin] = useState(false);
  if (!phone) return null;
  return createPortal(
    <div className={`phone-pop ${tone} ${min ? 'min' : ''}`} role="status" aria-live="polite">
      {!min && (
        <>
          <div className="pp-title">{title}</div>
          {children && <div className="pp-body">{children}</div>}
        </>
      )}
      <div className="pp-actions">{actions}</div>
      <button className="pp-toggle" onClick={() => setMin((m) => !m)}>
        {min ? t('Afficher le message') : t('Voir le plateau')}
      </button>
    </div>,
    document.body,
  );
}

/** Barre d'actions fixee en bas (pendant la recherche : indice, solution...) */
export function PhoneBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const phone = useIsPhone();
  if (!phone) return null;
  return createPortal(
    <div className="phone-bar">
      {note && <div className="pb-note">{note}</div>}
      <div className="pb-actions">{children}</div>
    </div>,
    document.body,
  );
}
