// Pieces capturees par un camp : regroupees par type, lisibles sur fond clair comme sombre,
// avec l'avantage materiel en badge.
import { Piece } from './Piece';
import { t } from '../i18n';
import type { Color } from '../game/types';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const NAME: Record<string, [string, string]> = {
  q: ['dame', 'dames'],
  r: ['tour', 'tours'],
  b: ['fou', 'fous'],
  n: ['cavalier', 'cavaliers'],
  p: ['pion', 'pions'],
};

/**
 * `pieces` : pieces prises par ce camp (types en minuscules), donc de la couleur adverse.
 * `color` : camp qui a capture.
 */
export function CapturedPieces({ pieces, color, diff }: { pieces: string[]; color: Color; diff: number }) {
  const victim: Color = color === 'w' ? 'b' : 'w';
  const groups = ['q', 'r', 'b', 'n', 'p']
    .map((t) => ({ t, n: pieces.filter((p) => p === t).length }))
    .filter((g) => g.n > 0);
  const total = pieces.reduce((s, p) => s + (VALUE[p] ?? 0), 0);
  const title = groups.length
    ? t('Capturé : {list} ({total} points)', { list: groups.map((g) => `${g.n} ${t(NAME[g.t][g.n > 1 ? 1 : 0])}`).join(', '), total })
    : t('Aucune pièce capturée');
  return (
    <div className="captured cg-wrap mini-pieces" title={title} aria-label={title}>
      {groups.map((g) => (
        <span key={g.t} className={`cap-group cap-${victim === 'w' ? 'white' : 'black'}`}>
          {Array.from({ length: g.n }, (_, i) => (
            <Piece key={i} type={g.t} color={victim} />
          ))}
        </span>
      ))}
      {diff > 0 && <span className="diff">+{diff}</span>}
    </div>
  );
}
