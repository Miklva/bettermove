// Visite guidee de l'application : on navigue de page en page, tout est assombri sauf ce qu'on presente.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { t } from '../i18n';
export interface TourStep<M extends string = string> {
  /** Page a afficher pendant l'etape */
  mode: M;
  /** Elements mis en lumiere (selecteurs CSS) ; vide = message centre */
  targets: string[];
  title: string;
  text: string;
  /** Sous-onglets en pastilles : un clic ouvre leur presentation (sous-visite) */
  chips?: { label: string; step: Omit<TourStep<M>, 'chips'> }[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;

/** Rectangles des cibles visibles, en coordonnees de la fenetre */
function measure(selectors: string[]): Rect[] {
  const out: Rect[] = [];
  for (const sel of selectors) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
    });
  }
  return out;
}

export function SpotlightTour<M extends string>({
  steps,
  step,
  onStep,
  onEnd,
  onMode,
  finalActions,
}: {
  steps: TourStep<M>[];
  step: number;
  onStep: (i: number) => void;
  onEnd: () => void;
  /** Affiche la page de l'etape en cours */
  onMode: (m: M) => void;
  /** Boutons de la derniere etape (ex. lancer le premier cours) */
  finalActions?: React.ReactNode;
}) {
  const parent = steps[step];
  // Pastille depliee dans la carte (detail du sous-onglet, sans quitter l'etape)
  const [sub, setSub] = useState<number | null>(null);
  useEffect(() => setSub(null), [step]);
  const chips = parent.chips ?? [];
  const open = sub !== null ? chips[sub] : undefined;
  // Le sous-onglet deplie est aussi entoure dans la barre (premier selecteur de son etape)
  const s: TourStep<M> = open ? { ...parent, targets: [...parent.targets, open.step.targets[0]] } : parent;
  const last = step === steps.length - 1;
  useEffect(() => {
    onMode(parent.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const [rects, setRects] = useState<Rect[]>([]);
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(220);

  const targets = useRef(s.targets);
  targets.current = s.targets;
  const update = useCallback(() => {
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    setRects(measure(targets.current));
  }, []);

  // A chaque etape : on attend que la page affiche ses elements, on les amene a l'ecran, puis on mesure
  useEffect(() => {
    setRects([]);
    let tries = 0;
    let raf = 0;
    const find = () => {
      const els = s.targets.flatMap((sel) => [...document.querySelectorAll<HTMLElement>(sel)]);
      const ready = s.targets.length === 0 || els.some((el) => el.getBoundingClientRect().height > 0);
      if (!ready && tries++ < 90) {
        raf = requestAnimationFrame(find);
        return;
      }
      const first = els.find((el) => el.getBoundingClientRect().height > 0);
      if (first) {
        const r = first.getBoundingClientRect();
        if (r.top < 70 || r.bottom > window.innerHeight - 40) first.scrollIntoView({ block: 'center' });
      }
      // Laisse le defilement se faire avant de mesurer
      setTimeout(update, first ? 120 : 0);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, update]);

  // Pastille ouverte ou fermee : on remesure tout de suite, sans effacer ni faire defiler (pas de saut)
  useLayoutEffect(() => {
    update();
  }, [sub, update]);

  useEffect(() => {
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [update]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
      else if (e.key === 'ArrowRight' && !last) onStep(step + 1);
      else if (e.key === 'ArrowLeft' && step > 0) onStep(step - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [step, last, onStep, onEnd]);

  // Carte d'explication : sous les cibles si la place le permet, sinon au-dessus ; centree sans cible
  const W = Math.min(380, vw - 24);
  const union = rects.length
    ? {
        x: Math.min(...rects.map((r) => r.x)),
        y: Math.min(...rects.map((r) => r.y)),
        r: Math.max(...rects.map((r) => r.x + r.w)),
        b: Math.max(...rects.map((r) => r.y + r.h)),
      }
    : null;
  let left = (vw - W) / 2;
  // Ancrage par le haut (sous les cibles) ou par le bas (au-dessus) : la carte grandit sans se deplacer
  let pos: React.CSSProperties = { top: Math.max(12, (vh - cardH) / 2) };
  if (union) {
    left = Math.max(12, Math.min(vw - W - 12, (union.x + union.r) / 2 - W / 2));
    if (union.b + 14 + cardH < vh - 12) pos = { top: union.b + 14 };
    else if (union.y - 14 - cardH > 12) pos = { bottom: vh - union.y + 14 };
    else pos = { bottom: 12 };
  }

  return (
    <div className="spot" role="dialog" aria-modal="true" aria-label={s.title}>
      <svg className="spot-shade" width={vw} height={vh} aria-hidden>
        <defs>
          <mask id="spot-mask">
            <rect width={vw} height={vh} fill="white" />
            {rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill="black" />
            ))}
          </mask>
        </defs>
        <rect width={vw} height={vh} fill="rgba(5, 8, 4, 0.74)" mask="url(#spot-mask)" />
        {rects.map((r, i) => (
          <rect key={i} className="spot-ring" x={r.x} y={r.y} width={r.w} height={r.h} rx="10" />
        ))}
      </svg>
      <div ref={card} className="spot-card card" style={{ left, width: W, ...pos }}>
        <div className="spot-progress">
          <span>
            {step + 1} / {steps.length}
          </span>
          <button className="link-btn small" onClick={onEnd}>{t("Passer la visite")}</button>
        </div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        {chips.length > 0 && (
          <>
            <div className="spot-chips">
              {chips.map((c, i) => (
                <button
                  key={c.label}
                  className={`spot-chip ${sub === i ? 'on' : ''}`}
                  aria-expanded={sub === i}
                  onClick={() => setSub(sub === i ? null : i)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {open ? (
              <p className="spot-detail">{open.step.text}</p>
            ) : (
              <p className="spot-hint muted small">{t("Clique sur une pastille pour en savoir plus.")}</p>
            )}
          </>
        )}
        {last && finalActions ? (
          <div className="spot-final">
            {finalActions}
            <button className="link-btn small muted" onClick={() => onStep(step - 1)}>{t("← Précédent")}</button>
          </div>
        ) : (
          <div className="row spot-nav">
            <button className="btn ghost" disabled={step === 0} onClick={() => onStep(step - 1)}>{t("← Précédent")}</button>
            <button className="btn primary" onClick={() => onStep(step + 1)} autoFocus>{t("Suivant →")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
