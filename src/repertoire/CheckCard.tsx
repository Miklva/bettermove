// Carte de la review : la partie a-t-elle suivi ton repertoire d'ouvertures ?
import { formatSan } from '../lib/notation';
import { useSettings } from '../settings/settings';
import { lineText } from '../pages/RepertoirePage';
import { checkGame, openRepertoireAt, type Side } from './store';

import { t } from '../i18n';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function RepertoireCheckCard({
  sans,
  color,
  startFen,
  onOpen,
}: {
  sans: string[];
  color: Side;
  startFen: string;
  onOpen: () => void;
}) {
  const { settings } = useSettings();
  if (startFen.split(' ').slice(0, 4).join(' ') !== START.split(' ').slice(0, 4).join(' ')) return null;
  const r = checkGame(sans, color);
  const f = (s: string) => formatSan(s, settings.notation);
  const moveNo = (ply: number) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'}`;
  const camp = color === 'w' ? t('Blancs') : t('Noirs');

  let icon = '📖';
  let title = '';
  let body = '';
  let action: { label: string; prefix: string[] } | null = null;

  switch (r.status) {
    case 'empty':
      title = t('Pas encore de répertoire avec les {camp}', { camp });
      body = t('Choisis tes ouvertures dans Apprendre › Répertoire : tu verras ici si tu as suivi ta préparation.');
      action = { label: t('Créer mon répertoire'), prefix: [] };
      break;
    case 'notCovered':
      icon = '🗺️';
      title = t('Ouverture hors de ton répertoire');
      body = t('Ton adversaire a joué {move}, que ton répertoire ne couvre pas encore.', { move: `${moveNo(r.depth)}${f(r.played!)}` });
      action = { label: t('Compléter mon répertoire'), prefix: [] };
      break;
    case 'userLeft':
      icon = '⚠️';
      title = t('Tu es sorti de ta préparation au coup {n}', { n: moveNo(r.depth) });
      body = t('Tu as joué {played} au lieu de {expected} ({name}).', { played: f(r.played!), expected: f(r.expected!), name: r.name ?? '' });
      action = { label: t('Réviser cette ligne'), prefix: r.prefix };
      break;
    case 'oppLeft':
      icon = '✅';
      title = t('Préparation suivie jusqu’au coup {n}', { n: moveNo(r.depth) });
      body = t('Ton adversaire a quitté {name} avec {move}. À partir de là, c’était à toi de jouer sans filet.', { name: r.name ?? '', move: `${moveNo(r.depth)}${f(r.played!)}` });
      break;
    case 'complete':
      icon = '🏁';
      title = t('Répertoire suivi jusqu’au bout');
      body = t('{n} demi-coups de {name} joués exactement comme prévu', { n: r.depth, name: r.name ?? '' }) + (r.depth ? ` (${lineText(r.prefix.slice(0, 6), settings.notation)}…)` : '') + '.';
      break;
  }

  return (
    <div className={`card rep-check rep-${r.status}`}>
      <div className="tc-label">
        {icon}{" "}{t("Répertoire ·")}{" "}{camp}
      </div>
      <strong>{title}</strong>
      <p className="muted small">{body}</p>
      {action && (
        <button
          className="btn"
          onClick={() => {
            if (action!.prefix.length) openRepertoireAt(color, action!.prefix);
            onOpen();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
