import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Game } from '../game/useGame';
import type { Color } from '../game/types';
import { COLOR_NAME } from '../game/rules';
import { useSettings } from '../settings/settings';
import { Board } from './Board';
import { PlayerBar } from './PlayerBar';
import { MoveList } from './MoveList';
import { Piece } from './Piece';
import { Initials } from '../profile/avatar';
import { FocusButton } from './FocusMode';
import { useShop } from '../shop/store';
import { conquestFor, type SkinChoice } from '../game/conquest';
import { track } from '../achievements/events';

const NO_DESTS = new Map<string, string[]>();

interface Props {
  g: Game;
  notify: (msg: string) => void;
  /** Camp(s) que l'utilisateur peut jouer */
  userColor: Color | 'both';
  /** Camp affiche en bas par defaut */
  baseOrientation?: Color;
  modeLabel: string;
  /** Contenu supplementaire dans les barres joueurs (Elo, "reflechit"...) */
  barExtras?: Partial<Record<Color, ReactNode>>;
  /** Avatars des joueurs (initiales par defaut) */
  avatars?: Partial<Record<Color, ReactNode>>;
  /** Boutons propres au mode (annuler, nulle, abandon...) */
  actions: ReactNode;
  /** Contenu sous le statut (message du bot...) */
  statusExtra?: ReactNode;
  /** Message de statut personnalise */
  statusText?: string;
  /** Carte supplementaire dans la colonne de droite (chat...) */
  sideExtra?: ReactNode;
  /** Skins de l'adversaire (bot) : ils envahissent le plateau s'il gagne. Par defaut, ceux du joueur. */
  skins?: Partial<Record<Color, SkinChoice>>;
  children?: ReactNode;
}

export function GameLayout({
  g,
  notify,
  userColor,
  baseOrientation = 'w',
  modeLabel,
  barExtras,
  avatars,
  actions,
  statusExtra,
  statusText,
  sideExtra,
  skins,
  children,
}: Props) {
  const { settings, theme } = useSettings();
  const shop = useShop();
  // Fin de partie : apres le dernier coup, les skins du gagnant envahissent le plateau
  const [conquering, setConquering] = useState(false);
  const winner = g.result?.winner ?? null;
  useEffect(() => {
    setConquering(false);
    if (!winner) return;
    const t = window.setTimeout(() => setConquering(true), 600);
    return () => clearTimeout(t);
  }, [winner, g.settings.gameId]);
  const mySkins: SkinChoice = { pieces: shop.equipped.pieces, board: theme.id };
  const conquest = conquering && winner && g.live ? conquestFor(winner, skins?.[winner] ?? mySkins) : null;
  const [flipped, setFlipped] = useState(false);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [resetToken, setResetToken] = useState(0);

  // Nouvelle partie : on remet l'orientation par defaut
  useEffect(() => {
    if (g.moves.length === 0) setFlipped(false);
  }, [g.moves.length]);

  const onMove = useCallback(
    (from: string, to: string) => {
      if (g.isPromotion(from, to)) {
        if (settings.autoQueen) g.makeMove(from, to, 'q');
        else setPromo({ from, to });
      } else if (!g.makeMove(from, to)) setResetToken((x) => x + 1);
    },
    [g, settings.autoQueen],
  );

  const choosePromotion = (role: string | null) => {
    if (promo && role) g.makeMove(promo.from, promo.to, role);
    else setResetToken((x) => x + 1);
    setPromo(null);
  };

  const copyPgn = () => {
    track('pgn');
    copyText(g.pgn(), notify);
  };

  // Raccourcis clavier : fleches pour naviguer, F pour retourner
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') g.setViewPly(g.viewPly - 1);
      else if (e.key === 'ArrowRight') g.setViewPly(g.viewPly + 1);
      else if (e.key === 'ArrowUp') g.setViewPly(0);
      else if (e.key === 'ArrowDown') g.setViewPly(g.moves.length);
      else if (e.key.toLowerCase() === 'f') setFlipped((f) => !f);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g]);

  const autoBlack = g.settings.autoFlip && userColor === 'both' && g.turn === 'b';
  const base: Color = autoBlack ? 'b' : baseOrientation;
  const bottom: Color = flipped ? (base === 'w' ? 'b' : 'w') : base;
  const top: Color = bottom === 'w' ? 'b' : 'w';
  const names = { w: g.settings.whiteName, b: g.settings.blackName };

  // Droits de jeu : a son tour on joue normalement, sinon (contre un bot) on peut preparer un coup en avance
  const userTurn = userColor === 'both' || userColor === g.turn;
  const premoveMode = userColor !== 'both' && settings.premoves && g.canMove;
  const toCg = (c: Color) => (c === 'w' ? 'white' : 'black');
  const movableColor = !g.canMove
    ? undefined
    : userTurn
      ? toCg(g.turn)
      : premoveMode
        ? toCg(userColor as Color)
        : undefined;
  const dests = g.canMove && userTurn ? g.dests : NO_DESTS;

  const bar = (c: Color) => (
    <PlayerBar
      name={names[c]}
      avatar={avatars?.[c] ?? <Initials name={names[c]} size={34} />}
      color={c}
      extra={barExtras?.[c]}
      captured={g.material.captured[c]}
      diff={g.material.diff[c]}
      clockMs={g.hasClock ? g.remaining(c) : null}
      active={!g.result && g.turn === c}
      running={g.running}
      isWinner={g.result?.winner === c}
    />
  );

  const status =
    statusText ??
    (g.result
      ? g.result.winner
        ? `Victoire des ${COLOR_NAME[g.result.winner]} : ${g.result.reason}`
        : `Nulle : ${g.result.reason}`
      : g.paused
        ? 'Partie en pause'
        : `Au tour de ${names[g.turn]} (${COLOR_NAME[g.turn]})`);

  return (
    <div className="play">
      <section className="board-col">
        {bar(top)}
        <div className="board-stage">
          <Board
            fen={g.viewFen}
            orientation={bottom === 'w' ? 'white' : 'black'}
            turnColor={g.viewTurn === 'w' ? 'white' : 'black'}
            movableColor={movableColor}
            dests={dests}
            premovable={premoveMode}
            lastMove={g.lastMove}
            inCheck={g.inCheck}
            resetToken={resetToken}
            onMove={onMove}
            conquest={conquest}
          />
          {promo && (
            <div className="promo-overlay" onClick={() => choosePromotion(null)}>
              <div className="promo-box cg-wrap mini-pieces" onClick={(e) => e.stopPropagation()}>
                {['q', 'r', 'b', 'n'].map((r) => (
                  <button key={r} className="promo-choice" onClick={() => choosePromotion(r)}>
                    <Piece type={r} color={g.turn} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {g.paused && !g.result && (
            <button className="pause-overlay" onClick={g.togglePause}>
              <span>Pause</span>
              <small>Clique pour reprendre</small>
            </button>
          )}
        </div>
        {bar(bottom)}
      </section>

      <aside className="side">
        <div className="card status-card">
          <div className="tc-label">
            {modeLabel} · {g.settings.timeControl.label}
          </div>
          <div className={`status ${g.result ? 'over' : ''}`}>{status}</div>
          {statusExtra}
          {!g.live && (
            <button className="link" onClick={() => g.setViewPly(g.moves.length)}>
              Tu regardes un ancien coup. Revenir à la partie
            </button>
          )}
        </div>

        {sideExtra}

        <div className="card moves-card">
          <MoveList moves={g.moves} viewPly={g.viewPly} onSelect={g.setViewPly} />
          <div className="nav-row">
            <button className="btn ghost" onClick={() => g.setViewPly(0)} aria-label="Début">«</button>
            <button className="btn ghost" onClick={() => g.setViewPly(g.viewPly - 1)} aria-label="Précédent">‹</button>
            <button className="btn ghost" onClick={() => g.setViewPly(g.viewPly + 1)} aria-label="Suivant">›</button>
            <button className="btn ghost" onClick={() => g.setViewPly(g.moves.length)} aria-label="Fin">»</button>
          </div>
        </div>

        <div className="card actions game-tools">
          {actions}
          <button className="btn" onClick={() => {
              track('flip');
              setFlipped((f) => !f);
            }} title="Retourner le plateau">
            🔄 Retourner
          </button>
          <button className="btn" onClick={copyPgn} disabled={g.moves.length === 0} title="Copier le PGN">
            📋 PGN
          </button>
          <FocusButton />
        </div>
      </aside>

      {children}
    </div>
  );
}

/** Copie du PGN reutilisable dans les modales de fin de partie */
export async function copyText(text: string, notify: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    notify('PGN copié dans le presse-papier');
  } catch {
    window.prompt('Copie le PGN :', text);
  }
}
