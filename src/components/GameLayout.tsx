import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Game } from '../game/useGame';
import type { Color } from '../game/types';
import { COLOR_NAME, tReason } from '../game/rules';
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
import { loadBook, lookup } from '../review/openings';
import { ChevronLeft, ChevronRight, MessageCircle, RefreshCw } from 'lucide-react';

import { t } from '../i18n';
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
  // Telephone : la discussion s'ouvre en tiroir par-dessus le plateau
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;
  useEffect(() => {
    if (!sideExtra) return;
    const on = () => {
      if (!chatOpenRef.current) setUnread((n) => n + 1);
    };
    window.addEventListener('bm-chat-line', on);
    return () => window.removeEventListener('bm-chat-line', on);
  }, [sideExtra]);
  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);
  useEffect(() => {
    setUnread(0);
  }, [g.settings.gameId]);

  // Nom de l'ouverture : derniere position nommee du livre
  const [opening, setOpening] = useState<string | null>(null);
  const fens = g.moves.slice(0, 40).map((m) => m.fen);
  const fensKey = fens.join('|');
  useEffect(() => {
    let off = false;
    if (fens.length === 0) {
      setOpening(null);
      return;
    }
    loadBook().then((book) => {
      if (off) return;
      let name: string | null = null;
      for (const fen of fens) {
        const n = lookup(book, fen);
        if (n === undefined) break;
        if (n) name = n;
      }
      setOpening((old) => name ?? (fens.length > 1 ? old : null));
    });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fensKey]);

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

  // Pastille de tour sur la barre du camp qui doit jouer
  const turnText = g.result
    ? null
    : g.paused
      ? t('Partie en pause')
      : (statusText ?? (userColor === 'both' ? t('Au tour de {name}', { name: names[g.turn] }) : userTurn ? t('À toi de jouer') : t('{name} réfléchit…', { name: names[g.turn] })));
  const bar = (c: Color) => (
    <PlayerBar
      turn={!g.result && g.turn === c ? turnText : null}
      mine={userColor === 'both' || userColor === c}
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
        ? t('Victoire des {color} : {reason}', { color: COLOR_NAME[g.result.winner], reason: tReason(g.result.reason) })
        : t('Nulle : {reason}', { reason: tReason(g.result.reason) })
      : g.paused
        ? t('Partie en pause')
        : t('Au tour de {name} ({color})', { name: names[g.turn], color: COLOR_NAME[g.turn] }));

  const nav = (
    <>
      <button className="btn ghost" onClick={() => g.setViewPly(0)} aria-label={t("Début")} title={t("Début")}>«</button>
      <button className="btn ghost" onClick={() => g.setViewPly(g.viewPly - 1)} aria-label={t("Précédent")} title={t("Précédent")}>‹</button>
      <button className="btn ghost" onClick={() => g.setViewPly(g.viewPly + 1)} aria-label={t("Suivant")} title={t("Suivant")}>›</button>
      <button className="btn ghost" onClick={() => g.setViewPly(g.moves.length)} aria-label={t("Fin")} title={t("Fin")}>»</button>
    </>
  );
  const flip = () => {
    track('flip');
    setFlipped((f) => !f);
  };

  return (
    <div className={`play game ${sideExtra ? 'has-chat' : ''} ${chatOpen ? 'chat-open' : ''}`}>
      {sideExtra && (
        <aside className="chat-col" aria-label={t("Discussion")}>
          <button className="chat-sheet-close btn ghost" onClick={() => setChatOpen(false)} aria-label={t("Fermer la discussion")}>
            ⌄
          </button>
          {sideExtra}
        </aside>
      )}
      {sideExtra && chatOpen && <button className="chat-backdrop" aria-label={t("Fermer la discussion")} onClick={() => setChatOpen(false)} />}

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
              <span>{t("Pause")}</span>
              <small>{t("Clique pour reprendre")}</small>
            </button>
          )}
        </div>
        {bar(bottom)}
      </section>

      <aside className="side game-panel">
        <header className="gp-head">
          <div className="gp-title">{modeLabel}</div>
          <div className="gp-sub">{g.settings.timeControl.label}</div>
          {opening && (
            <div className="gp-opening" title={opening}>
              <span aria-hidden>📖</span> {opening}
            </div>
          )}
          {(g.result || statusExtra || !g.live) && (
            <div className="gp-status">
              {g.result && <div className="status over">{status}</div>}
              {statusExtra}
              {!g.live && (
                <button className="link" onClick={() => g.setViewPly(g.moves.length)}>{t("Tu regardes un ancien coup. Revenir à la partie")}</button>
              )}
            </div>
          )}
        </header>

        <div className="gp-moves">
          <MoveList moves={g.moves} viewPly={g.viewPly} onSelect={g.setViewPly} />
        </div>
        <div className="nav-row gp-nav">{nav}</div>

        <div className="gp-actions game-tools">{actions}</div>
        <div className="gp-tools">
          <button className="btn" onClick={flip} title={t("Retourner le plateau")}>{t("🔄 Retourner")}</button>
          <button className="btn" onClick={copyPgn} disabled={g.moves.length === 0} title={t("Copier le PGN")}>{t("📋 PGN")}</button>
          <FocusButton />
        </div>
      </aside>

      {/* Telephone : barre du bas (coups, discussion) */}
      <nav className="game-dock" aria-label={t("Navigation dans la partie")}>
        <button className="dock-btn" onClick={() => g.setViewPly(g.viewPly - 1)} aria-label={t("Précédent")}>
          <ChevronLeft size={22} aria-hidden />
          <small>{t("Précédent")}</small>
        </button>
        <button className="dock-btn" onClick={() => g.setViewPly(g.viewPly + 1)} aria-label={t("Suivant")}>
          <ChevronRight size={22} aria-hidden />
          <small>{t("Suivant")}</small>
        </button>
        <button className="dock-btn" onClick={flip} aria-label={t("Retourner le plateau")}>
          <RefreshCw size={20} aria-hidden />
          <small>{t("Retourner")}</small>
        </button>
        {sideExtra && (
          <button className="dock-btn" onClick={() => setChatOpen(true)} aria-label={t("Discussion")}>
            <MessageCircle size={20} aria-hidden />
            <small>{t("Discussion")}</small>
            {unread > 0 && <b className="badge">{unread}</b>}
          </button>
        )}
      </nav>

      {children}
    </div>
  );
}

/** Copie du PGN reutilisable dans les modales de fin de partie */
export async function copyText(text: string, notify: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    notify(t('PGN copié dans le presse-papier'));
  } catch {
    window.prompt(t('Copie le PGN :'), text);
  }
}
