// Emojis de chat : packs (boutique ou recompenses de niveau). Un emoji s'envoie sous la forme :e:<id>:
// et s'affiche en grand quand il est seul dans le message.
import type { ReactNode } from 'react';
import type { Intent } from '../bots/chat';
import { owns } from '../shop/store';

type Face = 'happy' | 'cool' | 'cry' | 'angry' | 'wow' | 'gg' | 'think' | 'love' | 'sleep' | 'crown';

export interface EmoteDef {
  id: string;
  pack: string;
  label: string;
  /** Emoji Unicode, ou visage dessine sur une piece */
  glyph?: string;
  face?: { piece: 'pawn' | 'king'; mood: Face };
  /** Pastille d'annotation (comme dans la review : !!, ??, livre...) */
  badge?: { sym: string; bg: string };
  /** Effet d'affichage */
  fx?: 'glow' | 'holo' | 'float' | 'sparkle';
  /** Ce que le bot comprend */
  intent?: Intent;
}

const U = (pack: string, fx: EmoteDef['fx'] | undefined, list: [string, string, string, Intent?][]): EmoteDef[] =>
  list.map(([key, glyph, label, intent]) => ({ id: `${pack}-${key}`, pack: `emotes-${pack}`, glyph, label, fx, intent }));
/** Pastilles d'annotation : [cle, symbole, couleur, nom, intention] */
const B = (pack: string, fx: EmoteDef['fx'] | undefined, list: [string, string, string, string, Intent?][]): EmoteDef[] =>
  list.map(([key, sym, bg, label, intent]) => ({ id: `${pack}-${key}`, pack: `emotes-${pack}`, badge: { sym, bg }, label, fx, intent }));
const F = (pack: string, piece: 'pawn' | 'king', fx: EmoteDef['fx'] | undefined, list: [Face, string, Intent?][]): EmoteDef[] =>
  list.map(([mood, label, intent]) => ({ id: `${pack}-${mood}`, pack: `emotes-${pack}`, face: { piece, mood }, label, fx, intent }));

export const EMOTES: EmoteDef[] = [
  ...U('base', undefined, [
    ['ok', '👍', 'Pouce levé', 'compliment'],
    ['lol', '😂', 'Mort de rire', 'laugh'],
    ['wow', '😮', 'Surpris'],
    ['oups', '😅', 'Oups', 'sorry'],
    ['hand', '🤝', 'Poignée de main', 'greet'],
    ['fire', '🔥', 'En feu', 'compliment'],
  ]),
  ...U('tilt', undefined, [
    ['rage', '😤', 'Énervé', 'taunt'],
    ['boom', '🤯', 'Explosé'],
    ['cry', '😭', 'En larmes', 'sorry'],
    ['hide', '🙈', 'Je ne regarde pas', 'sorry'],
    ['dead', '💀', 'Mort'],
    ['dizzy', '😵', 'Sonné'],
  ]),
  ...U('animaux', undefined, [
    ['horse', '🐴', 'Cavalier'],
    ['owl', '🦉', 'Hibou sage', 'help'],
    ['turtle', '🐢', 'Tortue', 'hurry'],
    ['fox', '🦊', 'Renard rusé', 'taunt'],
    ['octo', '🐙', 'Pieuvre'],
    ['lion', '🦁', 'Lion', 'taunt'],
  ]),
  ...U('fete', undefined, [
    ['party', '🎉', 'Fête', 'compliment'],
    ['yay', '🥳', 'Youpi', 'compliment'],
    ['cup', '🏆', 'Trophée'],
    ['bubbly', '🍾', 'Champagne'],
    ['clap', '👏', 'Bravo', 'compliment'],
    ['target', '🎯', 'Dans le mille', 'compliment'],
  ]),
  ...U('classe', undefined, [
    ['shades', '😎', 'Tranquille'],
    ['monocle', '🧐', 'Intéressant', 'question'],
    ['hat', '🎩', 'Chapeau', 'compliment'],
    ['chef', '🤌', 'Parfait', 'compliment'],
    ['smirk', '😏', 'Sourire en coin', 'taunt'],
    ['coffee', '☕', 'Petit café', 'hurry'],
  ]),
  ...F('pions', 'pawn', undefined, [
    ['happy', 'Pion content', 'greet'],
    ['cool', 'Pion cool'],
    ['cry', 'Pion en larmes', 'sorry'],
    ['angry', 'Pion fâché', 'taunt'],
    ['wow', 'Pion surpris'],
    ['gg', 'Pion GG', 'compliment'],
  ]),
  ...F('rois', 'king', 'glow', [
    ['happy', 'Roi content', 'greet'],
    ['cool', 'Roi cool'],
    ['think', 'Roi pensif', 'question'],
    ['love', 'Roi ravi', 'thanks'],
    ['gg', 'Roi GG', 'compliment'],
    ['sleep', 'Roi endormi', 'hurry'],
  ]),
  ...U('cosmos', 'float', [
    ['galaxy', '🌌', 'Galaxie'],
    ['comet', '☄️', 'Comète', 'compliment'],
    ['planet', '🪐', 'Planète'],
    ['rocket', '🚀', 'Décollage', 'compliment'],
    ['alien', '👽', 'Extraterrestre', 'robot'],
    ['spark', '✨', 'Étincelles', 'compliment'],
  ]),
  // Les coups annotes, avec les couleurs de la review
  ...B('annot', undefined, [
    ['brilliant', '!!', '#1baca6', 'Coup brillant', 'compliment'],
    ['great', '!', '#5c8bb0', 'Très bon coup', 'compliment'],
    ['best', '★', '#81b64c', 'Meilleur coup', 'compliment'],
    ['book', '📖', '#a88865', 'Coup théorique'],
    ['inaccuracy', '?!', '#f7c045', 'Imprécision', 'sorry'],
    ['mistake', '?', '#e58f2a', 'Erreur', 'sorry'],
    ['blunder', '??', '#ca3431', 'Gaffe', 'laugh'],
    ['miss', '✕', '#ff7769', 'Occasion manquée', 'sorry'],
  ]),
  ...B('tactique', undefined, [
    ['fork', '🍴', '#7a5cc2', 'Fourchette', 'taunt'],
    ['pin', '📌', '#c2425c', 'Clouage', 'taunt'],
    ['skewer', '🍢', '#c27a2e', 'Enfilade', 'taunt'],
    ['sac', '🎁', '#2e8bc2', 'Sacrifice'],
    ['mate', '#', '#1f1f28', 'Échec et mat', 'taunt'],
    ['stalemate', '½', '#6b7280', 'Pat'],
    ['castle', 'O-O', '#3f7d4f', 'Roque'],
    ['promo', '♛', '#b8892b', 'Promotion'],
  ]),
  ...B('annotor', 'glow', [
    ['brilliant', '!!', 'linear-gradient(135deg,#fff3b0,#e0a92b 55%,#8a5a00)', 'Brillant doré', 'compliment'],
    ['great', '!', 'linear-gradient(135deg,#fff3b0,#e0a92b 55%,#8a5a00)', 'Très bon doré', 'compliment'],
    ['blunder', '??', 'linear-gradient(135deg,#ffd0c0,#d23b2a 55%,#6b0e05)', 'Gaffe de légende', 'laugh'],
    ['mate', '#', 'linear-gradient(135deg,#fff3b0,#e0a92b 55%,#8a5a00)', 'Mat doré', 'taunt'],
    ['gg', 'GG', 'linear-gradient(135deg,#e7d6ff,#8b5cf6 55%,#3b1a7a)', 'GG royal', 'compliment'],
    ['win', '1-0', 'linear-gradient(135deg,#ffffff,#c9ced6 55%,#5b6170)', 'Victoire des Blancs'],
    ['loss', '0-1', 'linear-gradient(135deg,#6b7280,#262a33 55%,#0b0c10)', 'Victoire des Noirs'],
    ['draw', '½-½', 'linear-gradient(135deg,#e5e7eb,#9ca3af 55%,#4b5563)', 'Nulle'],
  ]),
  // Tout en haut de la route : des etoiles qui scintillent
  ...U('eternite', 'sparkle', [
    ['star', '🌟', 'Étoile éternelle', 'compliment'],
    ['crown', '👑', 'Couronne éternelle', 'compliment'],
    ['gem', '💎', 'Diamant', 'compliment'],
    ['comet', '💫', 'Étoile filante'],
    ['heart', '💖', 'Cœur scintillant', 'thanks'],
    ['infinity', '♾️', 'Infini'],
  ]),
  ...F('legende', 'king', 'holo', [
    ['crown', 'Couronne légendaire', 'compliment'],
    ['gg', 'GG légendaire', 'compliment'],
    ['wow', 'Roi stupéfait'],
    ['cool', 'Roi légendaire'],
  ]),
];

const BY_ID = new Map(EMOTES.map((e) => [e.id, e]));
export const emoteById = (id: string) => BY_ID.get(id);
export const emotesOfPack = (pack: string) => EMOTES.filter((e) => e.pack === pack);
export const emoteToken = (id: string) => `:e:${id}:`;

/** Emojis utilisables par le joueur (packs possedes) */
export function myEmotes(): EmoteDef[] {
  return EMOTES.filter((e) => owns(e.pack));
}

const TOKEN = /:e:([a-z0-9-]+):/g;

/** Le message n'est qu'un emoji ? */
export function soloEmote(text: string): EmoteDef | null {
  const m = /^\s*:e:([a-z0-9-]+):\s*$/.exec(text);
  return m ? (emoteById(m[1]) ?? null) : null;
}

/** Intention d'un message qui contient un emoji (pour les bots) */
export function emoteIntent(text: string): Intent | null {
  const m = /:e:([a-z0-9-]+):/.exec(text);
  if (!m) return null;
  return emoteById(m[1])?.intent ?? 'chat';
}

/** Texte lisible (aperçus, notifications) */
export function emotePlain(text: string): string {
  return text.replace(TOKEN, (all, id) => {
    const e = emoteById(id);
    return e ? (e.glyph ?? e.badge?.sym ?? `[${e.label}]`) : all;
  });
}

/** Texte du chat avec les emojis remplaces par leur dessin */
export function renderChatText(text: string): ReactNode {
  const solo = soloEmote(text);
  if (solo) return <Emote def={solo} size={56} big />;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const e = emoteById(m[1]);
    if (!e) continue;
    out.push(text.slice(last, m.index));
    out.push(<Emote key={m.index} def={e} size={22} />);
    last = m.index! + m[0].length;
  }
  if (!out.length) return text;
  out.push(text.slice(last));
  return out;
}

export function Emote({ def, size = 28, big = false }: { def: EmoteDef; size?: number; big?: boolean }) {
  return (
    <span
      className={`emote ${def.fx ? `fx-${def.fx}` : ''} ${big ? 'emote-big' : ''}`}
      style={{ '--es': `${size}px` } as React.CSSProperties}
      title={def.label}
      role="img"
      aria-label={def.label}
    >
      {def.badge ? (
        <span className={`emote-badge ${def.badge.sym.length > 2 ? 'long' : ''}`} style={{ background: def.badge.bg }}>
          {def.badge.sym}
        </span>
      ) : (
        (def.glyph ?? (def.face && <PieceFace piece={def.face.piece} mood={def.face.mood} gold={def.pack !== 'emotes-pions'} />))
      )}
    </span>
  );
}

/* ---------------- Pieces avec un visage (dessins originaux) ---------------- */

function PieceFace({ piece, mood, gold }: { piece: 'pawn' | 'king'; mood: Face; gold: boolean }) {
  const body = gold ? '#f4c84a' : '#f5f1e8';
  const shade = gold ? '#c48f1c' : '#cfc6b4';
  const line = gold ? '#6b4a08' : '#3b3a40';
  const eyeY = 24;
  const eyes = (() => {
    switch (mood) {
      case 'cool':
        return (
          <g>
            <rect x="20" y={eyeY - 4} width="10" height="6" rx="2" fill="#1d1d24" />
            <rect x="34" y={eyeY - 4} width="10" height="6" rx="2" fill="#1d1d24" />
            <path d={`M30 ${eyeY - 2} h4`} stroke="#1d1d24" strokeWidth="2" />
          </g>
        );
      case 'cry':
        return (
          <g stroke={line} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d={`M22 ${eyeY - 2} q3 3 6 0`} />
            <path d={`M36 ${eyeY - 2} q3 3 6 0`} />
            <path d={`M24 ${eyeY + 2} v7`} stroke="#5ab0ff" strokeWidth="2.5" />
            <path d={`M40 ${eyeY + 2} v7`} stroke="#5ab0ff" strokeWidth="2.5" />
          </g>
        );
      case 'angry':
        return (
          <g>
            <path d={`M21 ${eyeY - 6} l8 3 M43 ${eyeY - 6} l-8 3`} stroke={line} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="26" cy={eyeY} r="2.4" fill={line} />
            <circle cx="38" cy={eyeY} r="2.4" fill={line} />
          </g>
        );
      case 'wow':
        return (
          <g fill={line}>
            <circle cx="26" cy={eyeY} r="3.2" />
            <circle cx="38" cy={eyeY} r="3.2" />
            <circle cx="27" cy={eyeY - 1} r="1" fill="#fff" />
            <circle cx="39" cy={eyeY - 1} r="1" fill="#fff" />
          </g>
        );
      case 'love':
        return (
          <g fill="#e2445c">
            <path d={`M23 ${eyeY - 1} a2 2 0 0 1 3 -1 a2 2 0 0 1 3 1 l-3 4 z`} />
            <path d={`M35 ${eyeY - 1} a2 2 0 0 1 3 -1 a2 2 0 0 1 3 1 l-3 4 z`} />
          </g>
        );
      case 'sleep':
      case 'think':
        return (
          <g stroke={line} strokeWidth="2" strokeLinecap="round">
            <path d={`M23 ${eyeY} h6`} />
            <path d={`M35 ${eyeY} h6`} />
          </g>
        );
      default:
        return (
          <g fill={line}>
            <ellipse cx="26" cy={eyeY} rx="2.2" ry="2.8" />
            <ellipse cx="38" cy={eyeY} rx="2.2" ry="2.8" />
          </g>
        );
    }
  })();
  const mouth = (() => {
    switch (mood) {
      case 'cry':
      case 'angry':
        return <path d="M26 35 q6 -5 12 0" stroke={line} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
      case 'wow':
        return <ellipse cx="32" cy="34" rx="3" ry="3.6" fill={line} />;
      case 'think':
        return <path d="M28 34 h7" stroke={line} strokeWidth="2" strokeLinecap="round" />;
      case 'sleep':
        return <ellipse cx="32" cy="34" rx="2" ry="1.5" fill={line} />;
      case 'cool':
        return <path d="M27 32 q6 4 11 -1" stroke={line} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
      default:
        return <path d="M25 31 q7 7 14 0" stroke={line} strokeWidth="2.2" fill={mood === 'gg' || mood === 'crown' ? '#8b2d2d' : 'none'} strokeLinecap="round" />;
    }
  })();
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
      {/* Corps */}
      <path d="M14 60 h36 q2 0 1 -3 l-4 -8 h-30 l-4 8 q-1 3 1 3z" fill={shade} stroke={line} strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 49 q2 -7 6 -9 h12 q4 2 6 9z" fill={body} stroke={line} strokeWidth="2" strokeLinejoin="round" />
      {/* Tete */}
      <circle cx="32" cy="26" r="15" fill={body} stroke={line} strokeWidth="2" />
      <circle cx="26" cy="30" r="2.6" fill="#ff8f8f" opacity={mood === 'love' || mood === 'happy' || mood === 'gg' ? 0.55 : 0} />
      <circle cx="38" cy="30" r="2.6" fill="#ff8f8f" opacity={mood === 'love' || mood === 'happy' || mood === 'gg' ? 0.55 : 0} />
      {piece === 'king' && (
        <g stroke={line} strokeWidth="1.6" strokeLinejoin="round">
          <path d="M20 13 l3 -8 l5 5 l4 -7 l4 7 l5 -5 l3 8z" fill={mood === 'crown' ? '#ffe27a' : '#f6d25c'} />
          <circle cx="32" cy="4" r="1.6" fill="#e2445c" />
        </g>
      )}
      {eyes}
      {mouth}
      {mood === 'gg' && (
        <g>
          <rect x="40" y="38" width="20" height="13" rx="3" fill="#fff" stroke={line} strokeWidth="1.6" transform="rotate(-8 50 44)" />
          <text x="50" y="48" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2f8f3a" transform="rotate(-8 50 44)" fontFamily="system-ui, sans-serif">
            GG
          </text>
        </g>
      )}
      {mood === 'sleep' && (
        <text x="50" y="14" fontSize="10" fontWeight="800" fill={line} fontFamily="system-ui, sans-serif">
          z
        </text>
      )}
      {mood === 'think' && <circle cx="52" cy="12" r="3" fill="none" stroke={line} strokeWidth="1.6" />}
    </svg>
  );
}
