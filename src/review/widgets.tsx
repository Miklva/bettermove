// Barre d'evaluation verticale et graphe d'evaluation de la partie.
import { CATEGORY, wpWhite, type MoveReview, type PosEval } from './analysis';

import { t } from '../i18n';
function label(e?: PosEval): string {
  if (!e) return '…';
  if (e.mate !== undefined) return e.mate === 0 ? '#' : `M${Math.abs(e.mate)}`;
  const v = Math.abs(e.cp) / 100;
  return v >= 10 ? Math.round(v).toString() : v.toFixed(1);
}

export function EvalBar({ e, flipped }: { e?: PosEval; flipped: boolean }) {
  const wp = e ? wpWhite(e) : 0.5;
  const whiteBetter = wp >= 0.5;
  return (
    <div className={`eval-bar ${flipped ? 'flipped' : ''}`} title={t("Évaluation de Stockfish")}>
      <div className="eval-white" style={{ height: `${wp * 100}%` }} />
      <span className={`eval-label ${whiteBetter ? 'on-white' : 'on-black'}`}>{label(e)}</span>
    </div>
  );
}

interface GraphProps {
  evals: (PosEval | undefined)[];
  reviews: (MoveReview | undefined)[];
  ply: number;
  userColor: 'w' | 'b';
  onSelect: (ply: number) => void;
}

export function EvalGraph({ evals, reviews, ply, userColor, onSelect }: GraphProps) {
  const n = evals.length - 1;
  if (n < 1) return null;
  const W = 600;
  const H = 90;
  const x = (i: number) => (i / n) * W;
  const y = (e?: PosEval) => (1 - (e ? wpWhite(e) : 0.5)) * H;
  const pts = evals.map((e, i) => `${x(i).toFixed(1)},${y(e).toFixed(1)}`).join(' ');
  return (
    <svg
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onClick={(ev) => {
        const r = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
        onSelect(Math.round(((ev.clientX - r.left) / r.width) * n));
      }}
    >
      <rect x="0" y="0" width={W} height={H} className="eval-graph-bg" />
      <polygon points={`0,${H} ${pts} ${W},${H}`} className="eval-graph-area" />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} className="eval-graph-mid" />
      <line x1={x(ply)} y1="0" x2={x(ply)} y2={H} className="eval-graph-cursor" />
      {reviews.map((r, i) => {
        if (!r || CATEGORY[r.category].good || i % 2 !== (userColor === 'w' ? 0 : 1)) return null;
        if (r.category === 'inaccuracy') return null;
        return <circle key={i} cx={x(i + 1)} cy={y(evals[i + 1])} r="5" fill={CATEGORY[r.category].color} />;
      })}
    </svg>
  );
}
