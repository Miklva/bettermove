import { createElement, memo, useEffect, useRef, useState } from 'react';
import type { Conquest } from '../game/conquest';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key, Piece, PiecesDiff } from '@lichess-org/chessground/types';
import { ANIMATION_MS, useSettings } from '../settings/settings';
import { useShop } from '../shop/store';
import { trackMax } from '../achievements/events';

export interface BoardProps {
  fen: string;
  orientation: 'white' | 'black';
  turnColor: 'white' | 'black';
  /** Camp qui peut bouger (undefined = plateau en lecture seule) */
  movableColor?: 'white' | 'black' | 'both';
  dests: Map<string, string[]>;
  /** Dernier coup au format "e2e4" (chaine pour eviter les rerendus inutiles) */
  lastMove: string;
  inCheck: boolean;
  /** Autorise les coups en avance (quand ce n'est pas le tour du camp jouable) */
  premovable: boolean;
  /** Fleches et cercles affiches sur le plateau (explications) */
  shapes?: { orig: string; dest?: string; brush: string }[];
  /** A incrementer pour forcer la resynchronisation (ex. promotion annulee) */
  resetToken: number;
  onMove: (from: string, to: string) => void;
  /** Apercu boutique : skin de pieces et plateau a essayer sans les equiper */
  skinOverride?: string;
  themeOverride?: { light: string; dark: string; texture?: string };
  /** Fin de partie : les skins du gagnant envahissent le plateau */
  conquest?: Conquest | null;
}

const ROLES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
/** La conquete avance d'une rangee par seconde ; dans une rangee, elle part de la colonne du roi gagnant */
const PER_ROW = 1000;

/**
 * Calque de conquete : rangee apres rangee (une par seconde, en partant du roi gagnant), le plateau du gagnant
 * recouvre l'ancien, et chaque piece touchee est "contaminee" : elle prend le skin du gagnant avec un eclat.
 */
function ConquestLayer({ fen, orientation, c, fromSkin }: { fen: string; orientation: 'white' | 'black'; c: Conquest; fromSkin: string }) {
  const rows = fen.split(' ')[0].split('/');
  const pieces: { file: number; rank: number; color: 'white' | 'black'; role: string }[] = [];
  rows.forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        pieces.push({ file, rank: 7 - i, color: ch === ch.toUpperCase() ? 'white' : 'black', role: ROLES[ch.toLowerCase()] });
        file++;
      }
    }
  });
  // Position a l'ecran (0..7 de gauche a droite et de haut en bas)
  const pos = (file: number, rank: number) => (orientation === 'white' ? { x: file, y: 7 - rank } : { x: 7 - file, y: rank });
  const king = pieces.find((p) => p.role === 'king' && p.color === c.winner);
  const o = king ? pos(king.file, king.rank) : { x: 3.5, y: 3.5 };
  /** Moment ou la vague atteint une case : rangee (1 s chacune) puis colonne, depuis le roi */
  const reach = (x: number, y: number) => Math.abs(y - o.y) * PER_ROW + (Math.abs(x - o.x) / 8) * PER_ROW;
  const boardStyle = { '--sq-light': c.light, '--sq-dark': c.dark } as React.CSSProperties;
  return (
    <div className="conquest" aria-hidden="true">
      {Array.from({ length: 8 }, (_, y) => (
        <div
          key={y}
          className={`conquest-board conquest-row ${c.texture ? `tex-${c.texture}` : ''}`}
          style={
            {
              ...boardStyle,
              '--t': `${y * 12.5}%`,
              '--b': `${(7 - y) * 12.5}%`,
              '--l': `${(o.x + 0.5) * 12.5}%`,
              '--r': `${(7.5 - o.x) * 12.5}%`,
              '--row-dur': `${PER_ROW}ms`,
              animationDelay: `${Math.abs(y - o.y) * PER_ROW}ms`,
            } as React.CSSProperties
          }
        />
      ))}
      {pieces.map((p, i) => {
        const s = pos(p.file, p.rank);
        const loser = p.color !== c.winner;
        // Le gagnant se revele tout de suite ; les pieces du perdant sont contaminees quand la vague les atteint
        const at = loser ? Math.round(reach(s.x, s.y)) : 0;
        const box = { left: `${s.x * 12.5}%`, top: `${s.y * 12.5}%` };
        return (
          <span key={i} className={`cq-cell ${loser ? 'cq-loser' : 'cq-winner'}`} style={box}>
            {/* La piece telle qu'elle etait (elle reste visible au-dessus du nouveau plateau) */}
            <span className={`cg-wrap cq-old skin-${fromSkin.replace('pieces-', '')}`} style={{ animationDelay: `${loser ? at + 850 : 0}ms` }}>
              {createElement('piece', { className: `${p.color} ${p.role}` })}
            </span>
            {/* Le skin du gagnant qui la recouvre, du bas vers le haut, avec un front lumineux */}
            <span className={`cg-wrap cq-new skin-${c.skin.replace('pieces-', '')}`} style={{ animationDelay: `${at}ms` }}>
              {createElement('piece', { className: `${p.color} ${p.role}` })}
            </span>
            {loser && <span className="cq-front" style={{ animationDelay: `${at}ms` }} />}
          </span>
        );
      })}
    </div>
  );
}

export const Board = memo(function Board(p: BoardProps) {
  const { settings, theme: equippedTheme } = useSettings();
  const equippedSkin = useShop().equipped.pieces;
  const skin = p.skinOverride ?? equippedSkin;
  const theme = p.themeOverride ?? equippedTheme;
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(p.onMove);
  onMoveRef.current = p.onMove;
  // Coups joues a l'avance (plusieurs possibles), dans l'ordre
  const queue = useRef<[Key, Key][]>([]);
  const [queued, setQueued] = useState(0);
  const fenRef = useRef(p.fen);
  fenRef.current = p.fen;

  /** Affiche les coups prepares par-dessus la vraie position (pieces deplacees + cases surlignees) */
  const showQueue = () => {
    const a = api.current;
    if (!a) return;
    // On repart de la vraie position puis on rejoue toute la file, SANS animation (sinon le dernier coup
    // se rejouerait a chaque rafraichissement)
    const anim = a.state.animation.enabled;
    a.set({ animation: { enabled: false } });
    a.set({ fen: fenRef.current });
    const custom = new Map<Key, string>();
    for (const [o, d] of queue.current) {
      const piece = a.state.pieces.get(o);
      if (!piece) {
        // La piece a ete prise entre-temps : on annule toute la file
        queue.current = [];
        a.set({ fen: fenRef.current });
        custom.clear();
        break;
      }
      const diff: PiecesDiff = new Map();
      diff.set(o, undefined);
      const lastRank = piece.color === 'white' ? '8' : '1';
      diff.set(d, piece.role === 'pawn' && d[1] === lastRank ? ({ role: 'queen', color: piece.color, promoted: true } as Piece) : piece);
      // Roque : la tour suit le roi
      if (piece.role === 'king' && Math.abs(o.charCodeAt(0) - d.charCodeAt(0)) === 2) {
        const r = o[1];
        const [rf, rt] = d[0] === 'g' ? ['h', 'f'] : ['a', 'd'];
        const rook = a.state.pieces.get(`${rf}${r}` as Key);
        if (rook) {
          diff.set(`${rf}${r}` as Key, undefined);
          diff.set(`${rt}${r}` as Key, rook);
        }
      }
      a.setPieces(diff);
      custom.set(o, 'premove-from');
      custom.set(d, 'premove-to');
    }
    a.set({ highlight: { custom }, animation: { enabled: anim } });
    shownSig.current = `${fenRef.current}|${queue.current.map((m) => m.join('')).join(',')}`;
    setQueued(queue.current.length);
  };
  /** Ce qui est affiche (position reelle + file de coups) : evite de tout reconstruire a chaque rendu */
  const shownSig = useRef('');

  const clearQueue = () => {
    if (!queue.current.length) return;
    queue.current = [];
    api.current?.set({ fen: fenRef.current, highlight: { custom: new Map() } });
    setQueued(0);
  };
  const showQueueRef = useRef(showQueue);
  showQueueRef.current = showQueue;

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      draggable: { enabled: true, showGhost: true },
      drawable: { enabled: true },
      movable: {
        free: false,
        events: { after: (orig, dest) => onMoveRef.current(orig, dest) },
      },
      premovable: {
        events: {
          // Coup prepare : on l'ajoute a la file et on deplace la piece "en vrai" pour pouvoir enchainer
          set: (orig, dest) => {
            api.current?.cancelPremove();
            if (queue.current.length >= 12) return;
            queue.current.push([orig, dest]);
            trackMax('premove-max', queue.current.length);
            showQueueRef.current();
          },
        },
      },
    });
    const ro = new ResizeObserver(() => api.current?.redrawAll());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  // Parametres d'affichage
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const coordsChanged = a.state.coordinates !== settings.coordinates;
    a.set({
      coordinates: settings.coordinates,
      animation: { enabled: settings.animation !== 'none', duration: ANIMATION_MS[settings.animation] },
      highlight: { lastMove: settings.highlightLastMove, check: true },
      movable: { showDests: settings.showDests },
      premovable: { showDests: settings.showDests },
    });
    if (coordsChanged) a.redrawAll();
  }, [settings.coordinates, settings.animation, settings.highlightLastMove, settings.showDests]);

  // Position et droits de jeu
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const myTurn = p.movableColor === p.turnColor;
    const sig = `${p.fen}|${queue.current.map((m) => m.join('')).join(',')}`;
    // Coups prepares deja affiches sur cette position : on ne touche pas aux pieces
    const keepVirtual = !!p.premovable && !myTurn && queue.current.length > 0 && sig === shownSig.current;
    a.set({
      ...(keepVirtual ? {} : { fen: p.fen }),
      orientation: p.orientation,
      turnColor: p.turnColor,
      check: p.inCheck ? p.turnColor : false,
      // Tableau vide (et non undefined) pour effacer le surlignage quand on revient en arriere
      lastMove: p.lastMove ? ([p.lastMove.slice(0, 2), p.lastMove.slice(2, 4)] as Key[]) : [],
      movable: { color: p.movableColor, dests: p.dests as Map<Key, Key[]> },
      premovable: { enabled: p.premovable },
    });
    a.cancelPremove();
    if (!p.premovable) {
      if (queue.current.length) clearQueue();
      return;
    }
    if (p.movableColor === p.turnColor) {
      // C'est notre tour : on joue le premier coup prepare s'il est legal, sinon on annule toute la file
      a.set({ highlight: { custom: new Map() } });
      const next = queue.current[0];
      if (next) {
        if (p.dests.get(next[0])?.includes(next[1])) {
          queue.current.shift();
          setQueued(queue.current.length);
          a.move(next[0], next[1]);
          onMoveRef.current(next[0], next[1]);
        } else clearQueue();
      }
    } else if (queue.current.length && !keepVirtual) showQueue();
  }, [p.fen, p.orientation, p.turnColor, p.inCheck, p.lastMove, p.movableColor, p.dests, p.premovable, p.resetToken]);

  // Fleches automatiques
  const shapesKey = JSON.stringify(p.shapes ?? []);
  useEffect(() => {
    api.current?.setAutoShapes((p.shapes ?? []) as Parameters<Api['setAutoShapes']>[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapesKey]);

  return (
    <div
      onContextMenu={(e) => {
        // Clic droit : annule les coups prepares
        if (queue.current.length) {
          e.preventDefault();
          clearQueue();
        }
      }}
      className={`board-wrap skin-${skin.replace('pieces-', '')} ${theme.texture ? `tex-${theme.texture}` : ''}`} style={{ '--sq-light': theme.light, '--sq-dark': theme.dark } as React.CSSProperties}>
      <div ref={el} className="cg-host" />
      {p.conquest && <ConquestLayer key={`${p.conquest.winner}-${p.conquest.skin}-${p.fen}`} fen={p.fen} orientation={p.orientation} c={p.conquest} fromSkin={skin} />}
      {queued > 0 && (
        <div className="premove-badge">
          {queued} coup{queued > 1 ? 's' : ''} préparé{queued > 1 ? 's' : ''} · clic droit pour annuler
        </div>
      )}
    </div>
  );
});
