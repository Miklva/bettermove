// Carte de la review : la partie a-t-elle suivi ton repertoire d'ouvertures ?
import { formatSan } from '../lib/notation';
import { useSettings } from '../settings/settings';
import { lineText } from '../pages/RepertoirePage';
import { checkGame, openRepertoireAt, type Side } from './store';

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
  const camp = color === 'w' ? 'Blancs' : 'Noirs';

  let icon = '📖';
  let title = '';
  let body = '';
  let action: { label: string; prefix: string[] } | null = null;

  switch (r.status) {
    case 'empty':
      title = `Pas encore de répertoire avec les ${camp}`;
      body = 'Choisis tes ouvertures dans Apprendre › Répertoire : tu verras ici si tu as suivi ta préparation.';
      action = { label: 'Créer mon répertoire', prefix: [] };
      break;
    case 'notCovered':
      icon = '🗺️';
      title = 'Ouverture hors de ton répertoire';
      body = `Ton adversaire a joué ${moveNo(r.depth)}${f(r.played!)}, que ton répertoire ne couvre pas encore.`;
      action = { label: 'Compléter mon répertoire', prefix: [] };
      break;
    case 'userLeft':
      icon = '⚠️';
      title = `Tu es sorti de ta préparation au coup ${moveNo(r.depth)}`;
      body = `Tu as joué ${f(r.played!)} au lieu de ${f(r.expected!)} (${r.name}).`;
      action = { label: 'Réviser cette ligne', prefix: r.prefix };
      break;
    case 'oppLeft':
      icon = '✅';
      title = `Préparation suivie jusqu’au coup ${moveNo(r.depth)}`;
      body = `Ton adversaire a quitté ${r.name} avec ${moveNo(r.depth)}${f(r.played!)}. À partir de là, c’était à toi de jouer sans filet.`;
      break;
    case 'complete':
      icon = '🏁';
      title = 'Répertoire suivi jusqu’au bout';
      body = `${r.depth} demi-coups de ${r.name} joués exactement comme prévu${r.depth ? ` (${lineText(r.prefix.slice(0, 6), settings.notation)}…)` : ''}.`;
      break;
  }

  return (
    <div className={`card rep-check rep-${r.status}`}>
      <div className="tc-label">
        {icon} Répertoire · {camp}
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
